import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Membership } from '../auth/auth.module';
import { AssistantQueryService } from './assistant-query.service';
import type { AssistantIntent } from './assistant.types';
import { OpenAiClient } from './openai.client';

const INTERPRET_SYSTEM = `Eres el clasificador de intent del asistente financiero TecnoWallet.
Devuelve SOLO JSON válido con esta forma:
{"intent":"category_spend|top_categories|month_totals|account_balances|goals|general","period":"this_month|last_month|this_year|last_30_days","categoryHint":"texto opcional","complexity":"simple|complex"}

Reglas:
- category_spend: gasto/ingreso de una categoría o sobre concreto (ej. restaurantes, transporte).
- top_categories: en qué gasta más / ranking de categorías.
- month_totals: totales de ingresos, gastos o balance del periodo.
- account_balances: saldos de cuentas.
- goals: avance de metas.
- general: saludo, explicación de la app, o pregunta sin datos concretos.
- period por defecto this_month si no se indica.
- complexity=complex solo si pide comparación multi-periodo profunda, proyección, o consejo elaborado; si no, simple.
- categoryHint: nombre de categoría mencionado por el usuario, sin inventar.
- No inventes cifras. No pidas datos sensibles.`;

@Injectable()
export class AssistantService {
  constructor(
    private readonly openai: OpenAiClient,
    private readonly queries: AssistantQueryService,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
  ) {}

  private async assertMember(workspaceId: string, userId: string) {
    const member = await this.memberships.exists({ workspaceId, userId });
    if (!member) throw new ForbiddenException('Workspace access denied');
  }

  private parseIntent(raw: string): AssistantIntent {
    try {
      const parsed = JSON.parse(raw) as Partial<AssistantIntent>;
      const intent = parsed.intent ?? 'general';
      const allowed = new Set([
        'category_spend',
        'top_categories',
        'month_totals',
        'account_balances',
        'goals',
        'general',
      ]);
      const periods = new Set([
        'this_month',
        'last_month',
        'this_year',
        'last_30_days',
      ]);
      return {
        intent: allowed.has(intent) ? intent : 'general',
        period: periods.has(parsed.period ?? '')
          ? (parsed.period as AssistantIntent['period'])
          : 'this_month',
        categoryHint: parsed.categoryHint?.trim() || undefined,
        complexity: parsed.complexity === 'complex' ? 'complex' : 'simple',
      };
    } catch {
      return {
        intent: 'general',
        period: 'this_month',
        complexity: 'simple',
      };
    }
  }

  async ask(input: {
    workspaceId: string;
    userId: string;
    message: string;
  }) {
    if (!this.openai.configured()) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY no está configurada en el servidor.',
      );
    }

    await this.assertMember(input.workspaceId, input.userId);
    const message = input.message.trim().slice(0, 500);
    if (!message) {
      return {
        answer: 'Escribe una pregunta sobre tus finanzas.',
        intent: 'general' as const,
        model: this.openai.fastModel(),
      };
    }

    // 1) Interpret intent only (tiny prompt, cheap model) — no ledger payload.
    const intentRaw = await this.openai.chat({
      model: this.openai.fastModel(),
      temperature: 0,
      maxTokens: 120,
      json: true,
      messages: [
        { role: 'system', content: INTERPRET_SYSTEM },
        { role: 'user', content: message },
      ],
    });
    const intent = this.parseIntent(intentRaw);

    // 2) Backend computes facts from MongoDB — never send raw transactions to OpenAI.
    const { facts, currency } = await this.queries.run({
      workspaceId: input.workspaceId,
      userId: input.userId,
      intent,
    });

    // 3) Present answer from precomputed facts only.
    const model =
      intent.complexity === 'complex'
        ? this.openai.complexModel()
        : this.openai.fastModel();

    const answer = await this.openai.chat({
      model,
      temperature: 0.3,
      maxTokens: intent.complexity === 'complex' ? 500 : 280,
      messages: [
        {
          role: 'system',
          content: `Eres el asistente de TecnoWallet. Responde en el idioma del usuario, claro y breve (2-5 frases).
Usa ÚNICAMENTE los hechos calculados por TecnoWallet. No inventes montos ni categorías.
No ofrezcas mover dinero. Moneda del libro: ${currency}.
Si faltan datos, dilo sin dramatizar.`,
        },
        {
          role: 'user',
          content: `Usuario pregunta: ${message}

Resultado calculado por TecnoWallet:
${facts}

Responde de manera clara y breve.`,
        },
      ],
    });

    return {
      answer,
      intent: intent.intent,
      period: intent.period,
      complexity: intent.complexity,
      model,
    };
  }
}
