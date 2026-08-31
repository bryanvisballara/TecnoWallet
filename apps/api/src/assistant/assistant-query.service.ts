import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Workspace } from '../auth/auth.module';
import { LedgerService, LedgerTransaction } from '../ledger/ledger';
import { FinanceResource } from '../platform/platform.module';
import type { AssistantIntent } from './assistant.types';

const ZERO_DECIMAL = new Set([
  'COP',
  'CLP',
  'JPY',
  'KRW',
  'VND',
  'PYG',
]);

function monthBounds(year: number, monthIndex: number) {
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function resolvePeriod(intent: AssistantIntent, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  switch (intent.period) {
    case 'last_month': {
      const prev = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      return {
        ...monthBounds(prevYear, prev),
        label: `${prevYear}-${String(prev + 1).padStart(2, '0')}`,
      };
    }
    case 'this_year':
      return {
        start: new Date(Date.UTC(year, 0, 1)),
        end: new Date(Date.UTC(year + 1, 0, 1)),
        label: String(year),
      };
    case 'last_30_days': {
      const end = new Date(now);
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 30);
      return { start, end, label: 'últimos 30 días' };
    }
    case 'this_month':
    default:
      return {
        ...monthBounds(year, month),
        label: `${year}-${String(month + 1).padStart(2, '0')}`,
      };
  }
}

function formatMoney(amountMinor: number, currency: string) {
  const code = currency.toUpperCase();
  const major = ZERO_DECIMAL.has(code)
    ? amountMinor
    : amountMinor / 100;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: ZERO_DECIMAL.has(code) ? 0 : 2,
    }).format(major);
  } catch {
    return `${major} ${code}`;
  }
}

@Injectable()
export class AssistantQueryService {
  constructor(
    @InjectModel(LedgerTransaction.name)
    private readonly transactions: Model<LedgerTransaction>,
    @InjectModel(FinanceResource.name)
    private readonly resources: Model<FinanceResource>,
    @InjectModel(Workspace.name)
    private readonly workspaces: Model<Workspace>,
    private readonly ledger: LedgerService,
  ) {}

  async currencyFor(workspaceId: string) {
    const workspace = await this.workspaces
      .findById(workspaceId)
      .select('baseCurrency')
      .lean();
    return (workspace?.baseCurrency || 'COP').toUpperCase();
  }

  private privacyMatch(userId: string) {
    return {
      $or: [
        { privacy: 'workspace' },
        { privacy: 'private', ownerId: new Types.ObjectId(userId) },
      ],
    };
  }

  private async envelopes(workspaceId: string) {
    return this.resources
      .find({
        workspaceId,
        kind: 'envelope',
        deletedAt: { $exists: false },
      })
      .select('_id name')
      .lean();
  }

  private matchEnvelope(
    envelopes: Array<{ _id: Types.ObjectId; name: string }>,
    categoryHint?: string,
  ) {
    if (!categoryHint?.trim()) return null;
    const needle = categoryHint.trim().toLowerCase();
    const exact = envelopes.find((item) => item.name.toLowerCase() === needle);
    if (exact) return exact;
    const includes = envelopes.find(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        needle.includes(item.name.toLowerCase()),
    );
    return includes ?? null;
  }

  async run(input: {
    workspaceId: string;
    userId: string;
    intent: AssistantIntent;
  }): Promise<{ facts: string; currency: string }> {
    const currency = await this.currencyFor(input.workspaceId);
    const period = resolvePeriod(input.intent);
    const workspaceOid = new Types.ObjectId(input.workspaceId);
    const baseMatch = {
      workspaceId: workspaceOid,
      reversedById: { $exists: false },
      occurredAt: { $gte: period.start, $lt: period.end },
      ...this.privacyMatch(input.userId),
    };

    switch (input.intent.intent) {
      case 'category_spend': {
        const envelopes = await this.envelopes(input.workspaceId);
        const envelope = this.matchEnvelope(
          envelopes,
          input.intent.categoryHint,
        );
        if (!envelope) {
          const names = envelopes.map((item) => item.name).slice(0, 20);
          return {
            currency,
            facts: [
              `Periodo: ${period.label}`,
              `No se encontró un sobre/categoría que coincida con "${input.intent.categoryHint ?? ''}".`,
              names.length
                ? `Sobres disponibles: ${names.join(', ')}`
                : 'El libro no tiene sobres aún.',
            ].join('\n'),
          };
        }

        const [row] = await this.transactions.aggregate<{ total: number }>([
          {
            $match: {
              ...baseMatch,
              kind: 'expense',
            },
          },
          { $unwind: '$entries' },
          {
            $match: {
              'entries.envelopeId': envelope._id,
              'entries.amountMinor': { $lt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $abs: '$entries.amountMinor' } },
            },
          },
        ]);

        // Prior month for cheap comparison context
        const priorIntent: AssistantIntent = {
          ...input.intent,
          period: 'last_month',
        };
        const prior = resolvePeriod(priorIntent);
        const [priorRow] = await this.transactions.aggregate<{
          total: number;
        }>([
          {
            $match: {
              workspaceId: workspaceOid,
              reversedById: { $exists: false },
              kind: 'expense',
              occurredAt: { $gte: prior.start, $lt: prior.end },
              ...this.privacyMatch(input.userId),
            },
          },
          { $unwind: '$entries' },
          {
            $match: {
              'entries.envelopeId': envelope._id,
              'entries.amountMinor': { $lt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $abs: '$entries.amountMinor' } },
            },
          },
        ]);

        return {
          currency,
          facts: [
            `Periodo consultado: ${period.label}`,
            `Categoría/sobre: ${envelope.name}`,
            `Gasto ${envelope.name} ${period.label}: ${formatMoney(row?.total ?? 0, currency)}`,
            `Gasto ${envelope.name} ${prior.label}: ${formatMoney(priorRow?.total ?? 0, currency)}`,
          ].join('\n'),
        };
      }

      case 'top_categories': {
        const envelopes = await this.envelopes(input.workspaceId);
        const byId = new Map(
          envelopes.map((item) => [String(item._id), item.name]),
        );
        const rows = await this.transactions.aggregate<{
          _id: Types.ObjectId;
          total: number;
        }>([
          { $match: { ...baseMatch, kind: 'expense' } },
          { $unwind: '$entries' },
          {
            $match: {
              'entries.envelopeId': { $exists: true, $ne: null },
              'entries.amountMinor': { $lt: 0 },
            },
          },
          {
            $group: {
              _id: '$entries.envelopeId',
              total: { $sum: { $abs: '$entries.amountMinor' } },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 8 },
        ]);

        if (!rows.length) {
          return {
            currency,
            facts: `Periodo: ${period.label}\nNo hay gastos por categoría en este periodo.`,
          };
        }

        const lines = rows.map((row, index) => {
          const name = byId.get(String(row._id)) ?? 'Sin nombre';
          return `${index + 1}. ${name}: ${formatMoney(row.total, currency)}`;
        });
        return {
          currency,
          facts: [`Periodo: ${period.label}`, 'Gastos por categoría:', ...lines].join(
            '\n',
          ),
        };
      }

      case 'month_totals': {
        const [expenseRow] = await this.transactions.aggregate<{
          total: number;
        }>([
          { $match: { ...baseMatch, kind: 'expense' } },
          { $unwind: '$entries' },
          { $match: { 'entries.amountMinor': { $lt: 0 } } },
          {
            $group: {
              _id: null,
              total: { $sum: { $abs: '$entries.amountMinor' } },
            },
          },
        ]);
        const [incomeRow] = await this.transactions.aggregate<{
          total: number;
        }>([
          { $match: { ...baseMatch, kind: 'income' } },
          { $unwind: '$entries' },
          { $match: { 'entries.amountMinor': { $gt: 0 } } },
          {
            $group: {
              _id: null,
              total: { $sum: '$entries.amountMinor' },
            },
          },
        ]);
        const income = incomeRow?.total ?? 0;
        const expense = expenseRow?.total ?? 0;
        const savings = income - expense;
        return {
          currency,
          facts: [
            `Periodo: ${period.label}`,
            `Ingresos: ${formatMoney(income, currency)}`,
            `Gastos: ${formatMoney(expense, currency)}`,
            `Balance (ingresos − gastos): ${formatMoney(savings, currency)}`,
          ].join('\n'),
        };
      }

      case 'account_balances': {
        const accounts = await this.resources
          .find({
            workspaceId: input.workspaceId,
            kind: 'account',
            deletedAt: { $exists: false },
            name: { $ne: '__clearing__' },
          })
          .select('name data')
          .lean();
        if (!accounts.length) {
          return {
            currency,
            facts: 'No hay cuentas registradas en este libro.',
          };
        }
        const balances = await this.ledger.accountBalancesMinor(
          input.workspaceId,
          input.userId,
        );
        const lines = accounts.map((account) => {
          const derived = balances.get(String(account._id));
          const stored = Number.isSafeInteger(account.data?.balanceMinor)
            ? Number(account.data.balanceMinor)
            : 0;
          const balance = derived !== undefined ? derived : stored;
          return `• ${account.name}: ${formatMoney(balance, currency)}`;
        });
        return {
          currency,
          facts: ['Saldos de cuentas:', ...lines].join('\n'),
        };
      }

      case 'goals': {
        const goals = await this.resources
          .find({
            workspaceId: input.workspaceId,
            kind: 'goal',
            deletedAt: { $exists: false },
          })
          .select('name data')
          .lean();
        if (!goals.length) {
          return {
            currency,
            facts: 'No hay metas configuradas en este libro.',
          };
        }
        const lines = goals.map((goal) => {
          const target = Number(goal.data?.targetMinor ?? 0) || 0;
          const current = Number(goal.data?.currentMinor ?? 0) || 0;
          return `• ${goal.name}: ${formatMoney(current, currency)} / ${formatMoney(target, currency)}`;
        });
        return {
          currency,
          facts: ['Metas:', ...lines].join('\n'),
        };
      }

      case 'general':
      default:
        return {
          currency,
          facts:
            'No se ejecutó una consulta financiera específica. Responde de forma breve y útil sin inventar cifras.',
        };
    }
  }
}
