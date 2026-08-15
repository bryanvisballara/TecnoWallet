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

export const WALLET_PRICE_USD = 2.99;
export const WALLET_PRICE_MINOR = 299;
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
      amount: WALLET_PRICE_USD,
      currency: 'USD',
      title: 'Wallet digital TecnoWallet',
      configured: this.configured(),
    };
  }

  async isPaid(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    if (user.recaudoActivation?.paidAt) return true;
    await this.recoverApproved(userId);
    const fresh = await this.users.findById(userId);
    return Boolean(fresh?.recaudoActivation?.paidAt);
  }

  async assertPaid(userId: string) {
    if (await this.isPaid(userId)) return;
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message:
          'Compra la wallet digital para verificar tu identidad y recibir aportes.',
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

    const apiOrigin = this.publicApiOrigin();
    const notificationUrl =
      this.config.get<string>('MERCADOPAGO_NOTIFICATION_URL')?.trim() ||
      `${apiOrigin}/webhooks/mercadopago`;

    const preference = await this.mpFetch<MpPreference>(
      '/checkout/preferences',
      {
        method: 'POST',
        body: JSON.stringify({
          items: [
            {
              title: 'Wallet digital TecnoWallet',
              description:
                'Wallet digital. Al completar la verificación podrás recibir aportes en USD, EUR, COP, MXN y R$.',
              quantity: 1,
              currency_id: 'USD',
              unit_price: WALLET_PRICE_USD,
            },
          ],
          payer: {
            email: user.email,
            name: user.name,
          },
          back_urls: {
            success: `${apiOrigin}/payments/wallet-return/success`,
            failure: `${apiOrigin}/payments/wallet-return/failure`,
            pending: `${apiOrigin}/payments/wallet-return/pending`,
          },
          auto_return: 'approved',
          notification_url: notificationUrl,
          external_reference: userId,
          metadata: { purpose: 'wallet_purchase', userId },
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
          'recaudoActivation.amountMinor': WALLET_PRICE_MINOR,
          'recaudoActivation.currency': 'USD',
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
    if (!signature) return;
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

  async handleReturn(query: Record<string, unknown>) {
    this.logger.log(
      `Wallet return ${JSON.stringify({
        result: query.result,
        status: query.status,
        collection_status: query.collection_status,
        payment_id: query.payment_id,
        collection_id: query.collection_id,
      })}`,
    );
    const paymentId =
      this.asId(query.payment_id) ||
      this.asId(query.collection_id) ||
      this.asId(query.id);
    let markedPaid = false;
    if (paymentId) {
      try {
        const applied = await this.applyPayment(paymentId);
        markedPaid = Boolean(
          applied &&
            (applied.paid === true || applied.alreadyPaid === true),
        );
      } catch (error) {
        this.logger.warn(
          `Wallet return could not apply payment ${paymentId}: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
      }
    }
    const result =
      this.asText(query.result) ||
      this.asText(query.status) ||
      this.asText(query.collection_status);
    const paid =
      markedPaid || result === 'success' || result === 'approved';
    const pending = !paid && (result === 'pending' || result === 'in_process');
    return walletReturnHtml({
      paid,
      pending,
      failed: !paid && !pending,
    });
  }

  private async recoverApproved(userId: string) {
    try {
      const listed = await this.mpFetch<{ results?: MpPayment[] }>(
        `/v1/payments/search?external_reference=${encodeURIComponent(userId)}&status=approved&sort=date_created&criteria=desc&limit=5`,
      );
      const approved = (listed.results ?? []).find(
        (item) => item.status === 'approved' && String(item.id ?? ''),
      );
      if (!approved?.id) return;
      await this.applyPayment(String(approved.id));
    } catch (error) {
      this.logger.warn(
        `MP recover failed for ${userId}: ${
          error instanceof Error ? error.message : 'error'
        }`,
      );
    }
  }

  private publicApiOrigin() {
    const fromEnv = this.config.get<string>('PUBLIC_API_ORIGIN')?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    const render = this.config.get<string>('RENDER_EXTERNAL_URL')?.trim();
    if (render) return `${render.replace(/\/$/, '')}/api/v1`;
    return 'https://tecnowallet.onrender.com/api/v1';
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
            amountMinor: WALLET_PRICE_MINOR,
            currency: payment.currency_id || 'USD',
          },
        },
      },
    );
    this.logger.log(`Recaudo activation paid for ${userId} (${paymentId})`);
    return { ok: true, paid: true };
  }

  private paymentIdFrom(query: Record<string, unknown>, body: unknown): string | undefined {
    const fromQuery =
      this.asId(query.payment_id) ||
      this.asId(query.collection_id) ||
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
    const token = this.accessToken();
    // APP_USR is production (incl. test users). sandbox_init_point + APP_USR
    // sends Safari into a redirect loop on sandbox.mercadopago.com.co.
    if (token.startsWith('APP_USR-')) return false;
    if (token.startsWith('TEST-')) return true;
    const flag = this.config.get<boolean | string>('MERCADOPAGO_SANDBOX');
    if (flag === true || flag === 'true' || flag === '1') return true;
    if (flag === false || flag === 'false' || flag === '0') return false;
    return false;
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

function walletReturnHtml(input: {
  paid: boolean;
  pending: boolean;
  failed: boolean;
}) {
  const title = input.paid
    ? 'Wallet digital comprada'
    : input.pending
      ? 'Pago en revisión'
      : 'No se completó la compra';
  const body = input.paid
    ? 'Tu wallet digital TecnoWallet ya está lista. Vuelve a la app para verificar tu identidad y empezar a recibir aportes en USD, EUR, COP, MXN y R$.'
    : input.pending
      ? 'Mercado Pago todavía está confirmando el pago. En unos segundos vuelve a la app de TecnoWallet.'
      : 'El pago no se completó. Vuelve a la app y pulsa Comprar wallet para intentarlo de nuevo.';
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f4f7fb; color: #0b1d3a; }
      main { max-width: 420px; margin: 12vh auto; padding: 28px 22px; background: #fff; border-radius: 24px; box-shadow: 0 12px 40px rgba(11,29,58,.08); }
      h1 { font-size: 28px; margin: 0 0 12px; letter-spacing: -.4px; }
      p { font-size: 16px; line-height: 1.45; color: #4a5a73; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${body}</p>
    </main>
  </body>
</html>`;
}
