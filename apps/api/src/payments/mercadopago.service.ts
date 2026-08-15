import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Model } from 'mongoose';

import { User } from '../auth/auth.module';

export const RECAUDO_ACTIVATION_COP = 12_000;
const MP_API = 'https://api.mercadopago.com';

type MpPreference = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MpPayment = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  metadata?: { userId?: string; purpose?: string };
  transaction_amount?: number;
  currency_id?: string;
};

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  configured() {
    return Boolean(this.accessToken());
  }

  async status(userId: string) {
    const paid = await this.isPaid(userId);
    return {
      paid,
      amount: RECAUDO_ACTIVATION_COP,
      currency: 'COP',
      title: 'Activación de recaudos',
      configured: this.configured(),
    };
  }

  async isPaid(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    return Boolean(user.recaudoActivation?.paidAt);
  }

  async assertPaid(userId: string) {
    if (await this.isPaid(userId)) return;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message:
          'Paga la activación para crear recaudos y verificar tu identidad.',
        code: 'RECAUDO_ACTIVATION_REQUIRED',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  async createCheckout(userId: string) {
    if (await this.isPaid(userId)) {
      return { paid: true as const };
    }
    const token = this.accessToken();
    if (!token) {
      throw new ServiceUnavailableException(
        'Mercado Pago no está configurado todavía.',
      );
    }
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');

    const webOrigin = (
      this.config.get<string>('PUBLIC_WEB_ORIGIN') ?? 'https://tecnowallet.app'
    ).replace(/\/$/, '');
    const notificationUrl =
      this.config.get<string>('MERCADOPAGO_NOTIFICATION_URL')?.trim() ||
      'https://tecnowallet.onrender.com/api/v1/webhooks/mercadopago';

    const preference = await this.mpFetch<MpPreference>(
      '/checkout/preferences',
      {
        method: 'POST',
        body: JSON.stringify({
          items: [
            {
              title: 'Activación de recaudos TecnoWallet',
              description:
                'Pago único para habilitar recaudos y la verificación de identidad.',
              quantity: 1,
              currency_id: 'COP',
              unit_price: RECAUDO_ACTIVATION_COP,
            },
          ],
          payer: {
            email: user.email,
            name: user.name,
          },
          back_urls: {
            success: `${webOrigin}/recaudos?mp=success`,
            failure: `${webOrigin}/recaudos?mp=failure`,
            pending: `${webOrigin}/recaudos?mp=pending`,
          },
          auto_return: 'approved',
          notification_url: notificationUrl,
          external_reference: userId,
          metadata: { purpose: 'recaudo_activation', userId },
        }),
      },
    );

    const sandbox = this.useSandbox();
    const initPoint = sandbox
      ? preference.sandbox_init_point || preference.init_point
      : preference.init_point || preference.sandbox_init_point;
    if (!initPoint) {
      throw new ServiceUnavailableException(
        'Mercado Pago no devolvió el enlace de pago.',
      );
    }

    await this.users.updateOne(
      { _id: userId },
      {
        $set: {
          'recaudoActivation.mpPreferenceId': preference.id,
          'recaudoActivation.amountMinor': RECAUDO_ACTIVATION_COP,
          'recaudoActivation.currency': 'COP',
        },
      },
    );

    return {
      paid: false as const,
      preferenceId: preference.id,
      initPoint,
    };
  }

  assertWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    query: Record<string, unknown>,
    body: unknown,
  ) {
    const secret =
      this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET')?.trim() || '';
    if (!secret) return;

    const signature = this.header(headers, 'x-signature');
    const requestId = this.header(headers, 'x-request-id');
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const data =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : {};
    const dataId =
      this.asId(query['data.id']) ||
      this.asId(data.id) ||
      this.asId(query.id) ||
      '';

    const parts = signature.split(',').map((part) => part.trim());
    let ts = '';
    let hash = '';
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const key = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (key === 'ts') ts = value;
      if (key === 'v1') hash = value;
    }
    if (!ts || !hash || !requestId) {
      throw new UnauthorizedException('Firma de Mercado Pago incompleta.');
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    const actualBuf = Buffer.from(hash, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      actualBuf.length !== expectedBuf.length ||
      !timingSafeEqual(actualBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Firma de Mercado Pago inválida.');
    }
  }

  async handleNotification(query: Record<string, unknown>, body: unknown) {
    const paymentId = this.paymentIdFrom(query, body);
    if (!paymentId) {
      this.logger.log('Mercado Pago webhook without payment id');
      return { ok: true, ignored: true };
    }
    return this.applyPayment(paymentId);
  }

  private async applyPayment(paymentId: string) {
    const payment = await this.mpFetch<MpPayment>(`/v1/payments/${paymentId}`);
    if (payment.status !== 'approved') {
      return { ok: true, status: payment.status ?? 'unknown' };
    }
    const userId =
      payment.metadata?.userId?.trim() ||
      payment.external_reference?.trim() ||
      '';
    if (!userId) {
      this.logger.warn(`MP payment ${paymentId} without user id`);
      return { ok: true, ignored: true };
    }
    const user = await this.users.findById(userId);
    if (!user) {
      this.logger.warn(`MP payment ${paymentId} user ${userId} not found`);
      return { ok: true, ignored: true };
    }
    if (user.recaudoActivation?.paidAt) {
      return { ok: true, alreadyPaid: true };
    }
    await this.users.updateOne(
      { _id: userId },
      {
        $set: {
          recaudoActivation: {
            paidAt: new Date(),
            mpPaymentId: String(payment.id ?? paymentId),
            mpPreferenceId: user.recaudoActivation?.mpPreferenceId,
            amountMinor: RECAUDO_ACTIVATION_COP,
            currency: payment.currency_id || 'COP',
          },
        },
      },
    );
    this.logger.log(`Recaudo activation paid for ${userId} (${paymentId})`);
    return { ok: true, paid: true };
  }

  private paymentIdFrom(query: Record<string, unknown>, body: unknown): string | undefined {
    const fromQuery =
      this.asId(query.id) ||
      this.asId(query['data.id']) ||
      (this.asText(query.topic) === 'payment' || this.asText(query.type) === 'payment'
        ? this.asId(query.id)
        : undefined);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const data =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : {};
    const type = this.asText(payload.type) || this.asText(payload.topic);
    if (type && type !== 'payment' && !type.startsWith('payment')) {
      return fromQuery;
    }
    return this.asId(data.id) || fromQuery;
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) {
    const raw = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(raw)) return raw[0]?.trim() ?? '';
    return typeof raw === 'string' ? raw.trim() : '';
  }

  private asText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private asId(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && value.trim()) return value.trim();
    return undefined;
  }

  private accessToken() {
    return this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN')?.trim() || '';
  }

  private useSandbox() {
    const flag = this.config.get<boolean | string>('MERCADOPAGO_SANDBOX');
    if (flag === true || flag === 'true' || flag === '1') return true;
    if (flag === false || flag === 'false' || flag === '0') return false;
    return this.accessToken().startsWith('TEST-');
  }

  private async mpFetch<T>(
    path: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> },
  ): Promise<T> {
    const token = this.accessToken();
    if (!token) {
      throw new ServiceUnavailableException(
        'Mercado Pago no está configurado todavía.',
      );
    }
    const response = await fetch(`${MP_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    const raw = await response.text();
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { message: raw };
    }
    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message?: unknown }).message)
          : `Mercado Pago ${response.status}`;
      this.logger.warn(`MP ${path} failed: ${message}`);
      throw new BadRequestException(
        message || 'No se pudo contactar Mercado Pago.',
      );
    }
    return parsed as T;
  }
}
