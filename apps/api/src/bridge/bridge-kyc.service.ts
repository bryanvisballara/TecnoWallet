import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';

import { User } from '../auth/auth.module';
import { MercadoPagoService } from '../payments/mercadopago.service';
import {
  RecaudoBridgeService,
  type TecnoKycSnapshot,
} from './recaudo-bridge.service';

@Injectable()
export class BridgeKycService {
  private readonly logger = new Logger(BridgeKycService.name);

  constructor(
    private readonly rail: RecaudoBridgeService,
    private readonly mercadoPago: MercadoPagoService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async status(userId: string): Promise<TecnoKycSnapshot> {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    const empty: TecnoKycSnapshot = {
      kycStatus: 'not_started',
      rejectionReasons: [],
      verified: false,
    };
    if (!(await this.mercadoPago.isPaid(userId))) {
      return empty;
    }
    const stored = user.bridgeKyc;
    if (this.isSandboxDraft(stored)) {
      await this.users.updateOne(
        { _id: user._id },
        { $unset: { bridgeKyc: 1 } },
      );
      user.bridgeKyc = undefined;
      return empty;
    }
    if (stored?.kycLinkId) {
      const fresh = await this.rail.getKycLink(stored.kycLinkId);
      if (fresh) {
        if (this.isSandboxDraft(fresh)) {
          await this.users.updateOne(
            { _id: user._id },
            { $unset: { bridgeKyc: 1 } },
          );
          user.bridgeKyc = undefined;
          return empty;
        }
        await this.persist(user, fresh);
        return fresh;
      }
      await this.users.updateOne(
        { _id: user._id },
        { $unset: { bridgeKyc: 1 } },
      );
      user.bridgeKyc = undefined;
      return empty;
    }
    return empty;
  }

  async resetDraft(userId: string): Promise<TecnoKycSnapshot> {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    const status = user.bridgeKyc?.kycStatus;
    if (status === 'approved' || status === 'under_review') {
      return this.status(userId);
    }
    await this.users.updateOne(
      { _id: user._id },
      { $unset: { bridgeKyc: 1 } },
    );
    user.bridgeKyc = undefined;
    return {
      kycStatus: 'not_started',
      rejectionReasons: [],
      verified: false,
    };
  }

  private isSandboxDraft(stored?: {
    kycUrl?: string;
    tosUrl?: string;
    kycStatus?: string;
  }) {
    const blob = `${stored?.kycUrl ?? ''} ${stored?.tosUrl ?? ''}`;
    if (/sandbox/i.test(blob)) return true;
    return false;
  }

  async start(userId: string, retry = false): Promise<TecnoKycSnapshot> {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    await this.mercadoPago.assertPaid(userId);
    if (retry) {
      await this.users.updateOne(
        { _id: user._id },
        { $unset: { bridgeKyc: 1 } },
      );
      user.bridgeKyc = undefined;
    }
    try {
      const snapshot = await this.rail.createKycLink({
        email: user.email,
        fullName: user.name,
        existingLinkId: retry ? undefined : user.bridgeKyc?.kycLinkId,
        retry,
      });
      await this.persist(user, snapshot);
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'kyc_failed';
      if (message === 'not_configured') {
        throw new ServiceUnavailableException(
          'La verificación no está configurada todavía.',
        );
      }
      if (
        error instanceof ForbiddenException ||
        /invalid credentials|api key/i.test(message)
      ) {
        throw new ServiceUnavailableException(
          'La clave de verificación no es válida. En Render pega BRIDGE_API_KEY live (sk-live) y vuelve a intentar.',
        );
      }
      throw new BadRequestException(
        message === 'kyc_failed'
          ? 'No se pudo abrir la verificación. Inténtalo de nuevo.'
          : message,
      );
    }
  }

  async requireVerified(userId: string): Promise<TecnoKycSnapshot> {
    const snapshot = await this.status(userId);
    if (!snapshot.verified) {
      throw new BadRequestException(
        'Verifica tu identidad para recibir aportes.',
      );
    }
    return snapshot;
  }

  async handleWebhook(body: Record<string, unknown>) {
    const category = String(body.event_category ?? '');
    const type = String(body.event_type ?? '');
    const object =
      body.event_object && typeof body.event_object === 'object'
        ? (body.event_object as Record<string, unknown>)
        : {};
    const objectId = String(
      body.event_object_id ?? object.id ?? '',
    ).trim();
    if (!objectId) return { ok: true, ignored: true };

    if (category === 'kyc_link' || type.startsWith('kyc_link.')) {
      const user = await this.users.findOne({
        'bridgeKyc.kycLinkId': objectId,
      });
      if (!user) return { ok: true, matched: false };
      const snapshot = await this.rail.getKycLink(objectId);
      if (snapshot) await this.persist(user, snapshot);
      return { ok: true, matched: true, kycStatus: snapshot?.kycStatus };
    }

    if (category === 'customer' || type.startsWith('customer.')) {
      const user = await this.users.findOne({
        'bridgeKyc.customerId': objectId,
      });
      if (!user?.bridgeKyc?.kycLinkId) return { ok: true, matched: Boolean(user) };
      const snapshot = await this.rail.getKycLink(user.bridgeKyc.kycLinkId);
      if (snapshot) await this.persist(user, snapshot);
      return { ok: true, matched: true, kycStatus: snapshot?.kycStatus };
    }

    if (category === 'transfer' || type.startsWith('transfer.')) {
      await this.rail.settleTransferWebhook(objectId);
      return { ok: true, transfer: objectId };
    }

    return { ok: true, ignored: true };
  }

  private async persist(
    user: HydratedDocument<User>,
    snapshot: TecnoKycSnapshot,
  ) {
    await this.users.updateOne(
      { _id: user._id },
      {
        $set: {
          bridgeKyc: {
            customerId: snapshot.customerId,
            kycLinkId: snapshot.kycLinkId,
            kycStatus: snapshot.kycStatus,
            tosStatus: snapshot.tosStatus,
            kycUrl: snapshot.kycUrl,
            tosUrl: snapshot.tosUrl,
          },
        },
      },
    );
    user.bridgeKyc = {
      customerId: snapshot.customerId,
      kycLinkId: snapshot.kycLinkId,
      kycStatus: snapshot.kycStatus,
      tosStatus: snapshot.tosStatus,
      kycUrl: snapshot.kycUrl,
      tosUrl: snapshot.tosUrl,
    };
  }
}
