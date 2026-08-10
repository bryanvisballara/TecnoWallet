import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AffiliateService } from '../affiliate/affiliate.service';
import {
  RevenueCatWebhookEvent,
  Subscription,
  SubscriptionStatus,
} from './billing.schemas';

interface RevenueCatEntitlement {
  product_identifier?: string;
  purchase_date?: string;
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
}

interface RevenueCatSubscription {
  original_purchase_date?: string;
  purchase_date?: string;
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  refunded_at?: string | null;
  is_sandbox?: boolean;
  store?: string;
  store_transaction_id?: string;
  original_transaction_id?: string;
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<string, RevenueCatSubscription>;
  };
}

interface RevenueCatWebhookPayload {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    aliases?: string[];
    entitlement_ids?: string[];
    product_id?: string;
    original_transaction_id?: string;
    transaction_id?: string;
    environment?: string;
    store?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number | null;
    price?: number;
    price_in_purchased_currency?: number;
    currency?: string;
    tax_percentage?: number;
    commission_percentage?: number;
  };
}

const HANDLED_EVENT_STATUSES: Record<string, SubscriptionStatus> = {
  INITIAL_PURCHASE: 'active',
  NON_RENEWING_PURCHASE: 'active',
  RENEWAL: 'active',
  UNCANCELLATION: 'active',
  PRODUCT_CHANGE: 'active',
  CANCELLATION: 'cancelled',
  EXPIRATION: 'expired',
  REFUND: 'refunded',
  BILLING_ISSUE: 'billing_retry',
};

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<Subscription>,
    @InjectModel(RevenueCatWebhookEvent.name)
    private readonly webhookEvents: Model<RevenueCatWebhookEvent>,
    private readonly config: ConfigService,
    private readonly affiliates: AffiliateService,
  ) {}

  async sync(userId: string, requestedAppUserId?: string) {
    const appUserId = requestedAppUserId?.trim() || userId;
    if (appUserId !== userId) {
      throw new ForbiddenException(
        'RevenueCat appUserId must match the authenticated user',
      );
    }

    const secret = this.config.get<string>('REVENUECAT_SECRET_API_KEY')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'RevenueCat subscriber sync is not configured',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secret}`,
            Accept: 'application/json',
          },
        },
      );
    } catch {
      throw new BadGatewayException('RevenueCat subscriber request failed');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `RevenueCat subscriber request failed with status ${response.status}`,
      );
    }

    let payload: RevenueCatSubscriberResponse;
    try {
      payload = (await response.json()) as RevenueCatSubscriberResponse;
    } catch {
      throw new BadGatewayException('RevenueCat returned an invalid response');
    }

    return this.persistSubscriber(userId, appUserId, payload);
  }

  async processWebhook(payload: Record<string, unknown>) {
    const webhook = payload as unknown as RevenueCatWebhookPayload;
    const event = webhook?.event;
    const eventId = event?.id?.trim();
    const eventType = event?.type?.trim().toUpperCase();
    if (!event || !eventId || !eventType) {
      throw new BadRequestException(
        'RevenueCat webhook event id and type are required',
      );
    }

    let eventRecord: RevenueCatWebhookEvent | null = null;
    try {
      eventRecord = await this.webhookEvents.create({
        eventId,
        eventType,
        appUserId: event.app_user_id,
        payload,
        processed: false,
      });
    } catch (error: unknown) {
      if (!this.isDuplicateKey(error)) throw error;
      eventRecord = await this.webhookEvents.findOne({ eventId });
      if (eventRecord?.processed) {
        return { received: true, duplicate: true, processed: false };
      }
    }

    try {
      const result = await this.applyWebhookEvent(eventId, eventType, event);
      await this.webhookEvents.updateOne(
        { eventId },
        {
          $set: { processed: true, processedAt: new Date() },
          $unset: { processingError: 1 },
        },
      );
      return { received: true, duplicate: false, ...result };
    } catch (error: unknown) {
      await this.webhookEvents.updateOne(
        { eventId },
        {
          $set: {
            processingError:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Unknown error',
          },
        },
      );
      throw error;
    }
  }

  private async persistSubscriber(
    userId: string,
    appUserId: string,
    payload: RevenueCatSubscriberResponse,
  ) {
    const subscriber = payload.subscriber;
    if (!subscriber) {
      throw new BadGatewayException('RevenueCat response has no subscriber');
    }

    const selected = this.selectHighestEntitlement(subscriber);
    if (!selected) {
      return this.subscriptions.findOneAndUpdate(
        { userId },
        {
          $set: {
            appUserId,
            status: 'expired',
            entitlementId: this.plusEntitlementId(),
            willRenew: false,
            provider: 'revenuecat',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    const { entitlementId, entitlement } = selected;
    const productId = entitlement.product_identifier;
    const subscription = productId
      ? subscriber.subscriptions?.[productId]
      : undefined;
    const expiresAt = this.parseDate(
      entitlement.expires_date ?? subscription?.expires_date,
    );
    const graceExpiresAt = this.parseDate(
      entitlement.grace_period_expires_date ??
        subscription?.grace_period_expires_date,
    );
    const status = this.statusFromSubscriber(
      subscription,
      expiresAt,
      graceExpiresAt,
    );
    const purchasedAt = this.parseDate(
      subscription?.original_purchase_date ??
        subscription?.purchase_date ??
        entitlement.purchase_date,
    );

    return this.subscriptions.findOneAndUpdate(
      { userId },
      {
        $set: this.withoutUndefined({
          appUserId,
          status,
          entitlementId,
          productId,
          originalTransactionId: subscription?.original_transaction_id,
          latestTransactionId: subscription?.store_transaction_id,
          environment: subscription
            ? subscription.is_sandbox
              ? 'SANDBOX'
              : 'PRODUCTION'
            : undefined,
          purchasedAt,
          expiresAt: graceExpiresAt ?? expiresAt,
          willRenew:
            status === 'active' && !subscription?.unsubscribe_detected_at,
          provider: 'revenuecat',
        }),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  private async applyWebhookEvent(
    eventId: string,
    eventType: string,
    event: NonNullable<RevenueCatWebhookPayload['event']>,
  ) {
    const status = HANDLED_EVENT_STATUSES[eventType];
    if (!status) return { processed: true, ignored: true };

    const knownEntitlements = [
      this.plusEntitlementId(),
      this.businessEntitlementId(),
    ];
    const eventEntitlements = event.entitlement_ids ?? [];
    if (
      eventEntitlements.length &&
      !eventEntitlements.some((id) => knownEntitlements.includes(id))
    ) {
      return { processed: true, ignored: true };
    }

    const entitlementId = this.resolveWebhookEntitlementId(
      eventEntitlements,
      event.product_id,
    );

    const appUserIds = [event.app_user_id, ...(event.aliases ?? [])].filter(
      (value): value is string => Boolean(value?.trim()),
    );
    const existing = await this.subscriptions.findOne({
      appUserId: { $in: appUserIds },
    });
    const objectIdAppUserId = appUserIds.find((value) =>
      Types.ObjectId.isValid(value),
    );
    const userId = existing?.userId ?? objectIdAppUserId;
    if (!userId || !event.app_user_id) {
      return { processed: true, ignored: true, reason: 'unmapped_app_user_id' };
    }

    if (
      entitlementId === this.plusEntitlementId() &&
      existing?.entitlementId === this.businessEntitlementId() &&
      this.isStillEntitled(existing) &&
      !['EXPIRATION', 'REFUND'].includes(eventType)
    ) {
      return { processed: true, ignored: true, reason: 'kept_higher_tier' };
    }

    const expiresAt = this.dateFromMilliseconds(event.expiration_at_ms);
    const purchasedAt = this.dateFromMilliseconds(event.purchased_at_ms);
    await this.subscriptions.findOneAndUpdate(
      { userId },
      {
        $set: this.withoutUndefined({
          appUserId: event.app_user_id,
          status,
          entitlementId,
          productId: event.product_id,
          originalTransactionId: event.original_transaction_id,
          latestTransactionId: event.transaction_id,
          environment: event.environment,
          purchasedAt,
          expiresAt,
          willRenew: [
            'INITIAL_PURCHASE',
            'RENEWAL',
            'UNCANCELLATION',
            'PRODUCT_CHANGE',
            'BILLING_ISSUE',
          ].includes(eventType),
          provider: 'revenuecat',
          lastEventId: eventId,
        }),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await this.recordAffiliateCommission(
      eventId,
      eventType,
      String(userId),
      event,
      purchasedAt,
    );

    return { processed: true, ignored: false };
  }

  private async recordAffiliateCommission(
    eventId: string,
    eventType: string,
    userId: string,
    event: NonNullable<RevenueCatWebhookPayload['event']>,
    purchasedAt?: Date,
  ) {
    if (
      ![
        'INITIAL_PURCHASE',
        'NON_RENEWING_PURCHASE',
        'RENEWAL',
        'REFUND',
      ].includes(eventType) ||
      !event.product_id
    ) {
      return;
    }
    const price = event.price_in_purchased_currency ?? event.price;
    const currency = event.currency?.trim().toUpperCase();
    if (
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      !currency ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      return;
    }
    const factor = ['COP', 'CLP', 'JPY', 'KRW', 'VND', 'PYG'].includes(currency)
      ? 1
      : 100;
    const grossAmountMinor = Math.max(0, Math.round(price * factor));
    const storeFeeAmountMinor = Math.round(
      grossAmountMinor * Math.max(0, event.commission_percentage ?? 0),
    );
    const taxAmountMinor = Math.round(
      grossAmountMinor * Math.max(0, event.tax_percentage ?? 0),
    );
    const netAmountMinor = Math.max(
      0,
      grossAmountMinor - storeFeeAmountMinor - taxAmountMinor,
    );
    await this.affiliates.recordCommissionFromRevenueEvent({
      providerEventId: eventId,
      userId,
      product: event.product_id,
      eventType,
      grossAmountMinor,
      netAmountMinor,
      storeFeeAmountMinor,
      currency,
      occurredAt: purchasedAt ?? new Date(),
      status: eventType === 'REFUND' ? 'reversed' : 'pending',
    });
  }

  private statusFromSubscriber(
    subscription: RevenueCatSubscription | undefined,
    expiresAt: Date | undefined,
    graceExpiresAt: Date | undefined,
  ): SubscriptionStatus {
    const now = Date.now();
    if (subscription?.refunded_at) return 'refunded';
    if (graceExpiresAt && graceExpiresAt.getTime() > now) return 'grace_period';
    if (expiresAt && expiresAt.getTime() <= now) return 'expired';
    if (subscription?.billing_issues_detected_at) return 'billing_retry';
    if (subscription?.unsubscribe_detected_at) return 'cancelled';
    return 'active';
  }

  private selectHighestEntitlement(
    subscriber: NonNullable<RevenueCatSubscriberResponse['subscriber']>,
  ):
    | { entitlementId: string; entitlement: RevenueCatEntitlement }
    | undefined {
    const now = Date.now();
    const candidates = [
      this.businessEntitlementId(),
      this.plusEntitlementId(),
    ];
    for (const entitlementId of candidates) {
      const entitlement = subscriber.entitlements?.[entitlementId];
      if (!entitlement) continue;
      const productId = entitlement.product_identifier;
      const subscription = productId
        ? subscriber.subscriptions?.[productId]
        : undefined;
      const expiresAt = this.parseDate(
        entitlement.expires_date ?? subscription?.expires_date,
      );
      const graceExpiresAt = this.parseDate(
        entitlement.grace_period_expires_date ??
          subscription?.grace_period_expires_date,
      );
      const status = this.statusFromSubscriber(
        subscription,
        expiresAt,
        graceExpiresAt,
      );
      if (
        ['active', 'grace_period', 'billing_retry', 'cancelled'].includes(
          status,
        ) &&
        (!(expiresAt && expiresAt.getTime() <= now) || Boolean(graceExpiresAt && graceExpiresAt.getTime() > now))
      ) {
        return { entitlementId, entitlement };
      }
    }
    return undefined;
  }

  private resolveWebhookEntitlementId(
    entitlementIds: string[],
    productId?: string,
  ): string {
    if (entitlementIds.includes(this.businessEntitlementId())) {
      return this.businessEntitlementId();
    }
    if (entitlementIds.includes(this.plusEntitlementId())) {
      return this.plusEntitlementId();
    }
    if (productId?.toLowerCase().includes('business')) {
      return this.businessEntitlementId();
    }
    return this.plusEntitlementId();
  }

  private isStillEntitled(
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

  private plusEntitlementId(): string {
    return this.config.get<string>('REVENUECAT_ENTITLEMENT_ID', 'plus').trim();
  }

  private businessEntitlementId(): string {
    return this.config
      .get<string>('REVENUECAT_BUSINESS_ENTITLEMENT_ID', 'business')
      .trim();
  }


  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private dateFromMilliseconds(
    value: number | null | undefined,
  ): Date | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return new Date(value);
  }

  private withoutUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
