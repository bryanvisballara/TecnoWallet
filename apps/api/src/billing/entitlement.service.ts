import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription, SubscriptionStatus } from './billing.schemas';

export type PaidAccess = 'plus' | 'business';
export type PlanAccess = 'free' | PaidAccess;

export interface PlusRequirementReason {
  feature?: string;
  action?: string;
  upgradeTo?: PaidAccess;
  seatLimit?: number;
  [key: string]: unknown;
}

export interface EntitlementStatus {
  access: PlanAccess;
  isPlus: boolean;
  isBusiness: boolean;
  seatLimit: number;
  enforcementEnabled: boolean;
  status: SubscriptionStatus | 'bypassed' | 'none';
  entitlementId?: string;
  productId?: string;
  expiresAt?: Date;
  willRenew?: boolean;
}

export class PaymentRequiredException extends HttpException {
  constructor(response: Record<string, unknown>) {
    super(response, HttpStatus.PAYMENT_REQUIRED);
  }
}

@Injectable()
export class EntitlementService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<Subscription>,
    private readonly config: ConfigService,
  ) {}

  async isPlus(userId: string): Promise<boolean> {
    return (await this.statusFor(userId)).isPlus;
  }

  async isBusiness(userId: string): Promise<boolean> {
    return (await this.statusFor(userId)).isBusiness;
  }

  async collaboratorSeatLimit(userId: string): Promise<number> {
    return (await this.statusFor(userId)).seatLimit;
  }

  async statusFor(userId: string): Promise<EntitlementStatus> {
    if (!this.enforcementEnabled()) {
      return {
        access: 'business',
        isPlus: true,
        isBusiness: true,
        seatLimit: 10,
        enforcementEnabled: false,
        status: 'bypassed',
      };
    }

    const subscription = await this.subscriptions
      .findOne({ userId })
      .lean()
      .exec();
    if (!subscription || !this.hasCurrentEntitlement(subscription)) {
      return {
        access: 'free',
        isPlus: false,
        isBusiness: false,
        seatLimit: 0,
        enforcementEnabled: true,
        status: subscription?.status ?? 'none',
        entitlementId: subscription?.entitlementId,
        productId: subscription?.productId,
        expiresAt: subscription?.expiresAt,
        willRenew: subscription?.willRenew,
      };
    }

    const access = this.accessFromEntitlementId(subscription.entitlementId);
    return {
      access,
      isPlus: access === 'plus' || access === 'business',
      isBusiness: access === 'business',
      seatLimit: access === 'business' ? 10 : access === 'plus' ? 5 : 0,
      enforcementEnabled: true,
      status: subscription.status,
      entitlementId: subscription.entitlementId,
      productId: subscription.productId,
      expiresAt: subscription.expiresAt,
      willRenew: subscription.willRenew,
    };
  }

  async assertPlus(
    userId: string,
    reason: PlusRequirementReason = {},
  ): Promise<void> {
    const status = await this.statusFor(userId);
    if (status.isPlus) return;

    throw new PaymentRequiredException({
      statusCode: 402,
      error: 'Payment Required',
      message: 'TecnoWallet Plus is required for this action',
      code: 'PLUS_REQUIRED',
      reason,
      entitlement: status,
    });
  }

  accessFromEntitlementId(entitlementId?: string): PlanAccess {
    const normalized = entitlementId?.trim().toLowerCase();
    if (!normalized) return 'free';
    if (normalized === this.businessEntitlementId().toLowerCase()) {
      return 'business';
    }
    if (normalized === this.plusEntitlementId().toLowerCase()) {
      return 'plus';
    }
    if (normalized.includes('business')) return 'business';
    if (normalized.includes('plus')) return 'plus';
    return 'free';
  }

  plusEntitlementId(): string {
    return this.config.get<string>('REVENUECAT_ENTITLEMENT_ID', 'plus').trim();
  }

  businessEntitlementId(): string {
    return this.config
      .get<string>('REVENUECAT_BUSINESS_ENTITLEMENT_ID', 'business')
      .trim();
  }

  private enforcementEnabled(): boolean {
    const value = this.config.get<string | boolean>(
      'PLUS_ENFORCEMENT_ENABLED',
      false,
    );
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  private hasCurrentEntitlement(
    subscription: Pick<Subscription, 'status' | 'expiresAt'>,
  ): boolean {
    if (
      !['active', 'grace_period', 'billing_retry', 'cancelled'].includes(
        subscription.status,
      )
    ) {
      return false;
    }

    return (
      !subscription.expiresAt || subscription.expiresAt.getTime() > Date.now()
    );
  }
}
