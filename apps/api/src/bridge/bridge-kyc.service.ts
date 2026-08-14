import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';

import { User } from '../auth/auth.module';
import {
  RecaudoBridgeService,
  type TecnoKycSnapshot,
} from './recaudo-bridge.service';

@Injectable()
export class BridgeKycService {
  constructor(
    private readonly rail: RecaudoBridgeService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async status(userId: string): Promise<TecnoKycSnapshot> {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
    const stored = user.bridgeKyc;
    if (stored?.kycLinkId) {
      const fresh = await this.rail.getKycLink(stored.kycLinkId);
      if (fresh) {
        await this.persist(user, fresh);
        return fresh;
      }
    }
    const listed = await this.rail.listKycLinks(user.email);
    const latest =
      listed.find((item) => item.verified) ??
      listed.find((item) => item.kycLinkId);
    if (latest) {
      await this.persist(user, latest);
      return latest;
    }
    return {
      kycStatus: stored?.kycStatus || 'not_started',
      tosStatus: stored?.tosStatus,
      customerId: stored?.customerId,
      kycLinkId: stored?.kycLinkId,
      kycUrl: stored?.kycUrl,
      tosUrl: stored?.tosUrl,
      rejectionReasons: [],
      verified: stored?.kycStatus === 'approved',
    };
  }

  async start(userId: string, retry = false): Promise<TecnoKycSnapshot> {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado.');
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
        'Verifica tu identidad antes de crear el recaudo.',
      );
    }
    return snapshot;
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
