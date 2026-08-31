import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { User } from '../auth/auth.module';
import { Subscription } from '../billing/billing.schemas';
import { EntitlementService } from '../billing/entitlement.service';
import {
  Affiliate,
  AffiliateClick,
  AffiliateInstall,
  CommissionEvent,
  type AffiliateUsdtNetwork,
  type CommissionEventStatus,
  UserAttribution,
} from './affiliate.schemas';
import type { UpdateAffiliatePayoutDto } from './affiliate.dto';
import {
  AFFILIATE_FLAT_BOUNTY_CURRENCY,
  AFFILIATE_FLAT_BOUNTY_MINOR,
  AFFILIATE_PAYOUT_MIN_MINOR,
} from './affiliate.constants';

export interface RecordCommissionFromRevenueEventInput {
  providerEventId: string;
  userId: string;
  product: string;
  eventType: string;
  grossAmountMinor: number;
  netAmountMinor: number;
  storeFeeAmountMinor: number;
  currency: string;
  occurredAt: Date | string;
  status?: CommissionEventStatus;
  subscriptionId?: string;
}

type ClickMetadata = {
  branchClickId?: string;
  campaign?: string;
  userAgent?: string;
  ip?: string;
};

const ACTIVE_SUB_STATUSES = [
  'active',
  'grace_period',
  'billing_retry',
  'cancelled',
] as const;

@Injectable()
export class AffiliateService implements OnModuleInit {
  private readonly logger = new Logger(AffiliateService.name);
  constructor(
    @InjectModel(Affiliate.name)
    private readonly affiliates: Model<Affiliate>,
    @InjectModel(AffiliateClick.name)
    private readonly clicks: Model<AffiliateClick>,
    @InjectModel(AffiliateInstall.name)
    private readonly installs: Model<AffiliateInstall>,
    @InjectModel(UserAttribution.name)
    private readonly attributions: Model<UserAttribution>,
    @InjectModel(CommissionEvent.name)
    private readonly commissions: Model<CommissionEvent>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<Subscription>,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => EntitlementService))
    private readonly entitlements: EntitlementService,
  ) {}

  async onModuleInit() {
    try {
      await this.retireLegacyPercentageCommissions();
    } catch (error) {
      this.logger.error('Could not retire legacy percentage commissions', error);
    }
  }

  async recordClick(code: string, metadata: ClickMetadata) {
    const affiliate = await this.findActiveAffiliate(code);
    const clickId = randomUUID();
    await this.clicks.create({
      affiliateId: affiliate.affiliateId,
      code: affiliate.code,
      clickId,
      branchClickId: this.cleanOptional(metadata.branchClickId),
      campaign: this.cleanOptional(metadata.campaign),
      timestamp: new Date(),
      userAgent: this.cleanOptional(metadata.userAgent)?.slice(0, 512),
      ipHash: this.hashIp(metadata.ip),
    });

    return {
      affiliate: this.displayAffiliate(affiliate),
      branchUrl: affiliate.branchUrl,
      clickId,
    };
  }

  async getByCode(code: string) {
    const affiliate = await this.findActiveAffiliate(code);
    return { affiliate: this.displayAffiliate(affiliate) };
  }

  async recordInstall(input: {
    providerEventId: string;
    code: string;
    branchClickId?: string;
    branchIdentity?: string;
    installedAt?: string | Date;
  }) {
    const providerEventId = input.providerEventId.trim();
    if (!providerEventId) {
      throw new BadRequestException('Branch providerEventId is required');
    }
    const affiliate = await this.findActiveAffiliate(input.code);
    const installedAt = input.installedAt
      ? new Date(input.installedAt)
      : new Date();
    if (Number.isNaN(installedAt.getTime())) {
      throw new BadRequestException('Invalid Branch install timestamp');
    }
    try {
      const install = await this.installs.create({
        providerEventId,
        affiliateId: affiliate.affiliateId,
        code: affiliate.code,
        branchClickId: this.cleanOptional(input.branchClickId),
        branchIdentity: this.cleanOptional(input.branchIdentity),
        installedAt,
      });
      return { received: true, duplicate: false, id: install._id };
    } catch (error) {
      if (!this.isDuplicateKey(error)) throw error;
      return { received: true, duplicate: true };
    }
  }

  async claim(
    userId: string,
    input: { code: string; clickId?: string; branchClickId?: string },
  ) {
    this.assertUserId(userId);

    const existing = await this.attributions.findOne({ userId }).lean();
    if (existing) {
      await this.users.updateOne(
        { _id: userId },
        {
          $set: {
            affiliateId: existing.affiliateId,
            affiliateCode: existing.code,
          },
        },
      );
      return this.claimResponse(existing, false);
    }

    const affiliate = await this.findActiveAffiliate(input.code);
    await this.validateClaimedClick(affiliate.affiliateId, input);
    const source = input.clickId
      ? 'affiliate_click'
      : input.branchClickId
        ? 'branch'
        : 'code';

    const attribution = await this.attributions
      .findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            affiliateId: affiliate.affiliateId,
            code: affiliate.code,
            clickId: this.cleanOptional(input.clickId),
            branchClickId: this.cleanOptional(input.branchClickId),
            source,
            attributedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();

    if (!attribution) {
      throw new ConflictException('Could not persist affiliate attribution');
    }
    await this.users.updateOne(
      { _id: userId },
      {
        $set: {
          affiliateId: attribution.affiliateId,
          affiliateCode: attribution.code,
        },
      },
    );
    return this.claimResponse(
      attribution,
      attribution.affiliateId === affiliate.affiliateId,
    );
  }

  async getMyAttribution(userId: string) {
    this.assertUserId(userId);
    const attribution = await this.attributions.findOne({ userId }).lean();
    if (!attribution) return { attribution: null };

    const affiliate = await this.affiliates
      .findOne({ affiliateId: attribution.affiliateId })
      .lean();
    return {
      attribution: this.displayAttribution(attribution),
      affiliate: affiliate ? this.displayAffiliate(affiliate) : null,
    };
  }

  async enrollPartner(userId: string, requestedCode?: string) {
    this.assertUserId(userId);
    await this.entitlements.assertBusiness(userId, {
      feature: 'affiliate',
      action: 'enroll',
      upgradeTo: 'business',
    });
    const existing = await this.affiliates
      .findOne({ ownerUserId: userId })
      .lean();
    if (existing) {
      return {
        enrolled: true as const,
        created: false as const,
        affiliate: this.displayAffiliate(existing, { includePayout: true }),
        shareUrl: this.shareUrlFor(existing.code),
      };
    }

    const user = await this.users.findById(userId).lean();
    if (!user?.active) throw new NotFoundException('User not found');

    const code = await this.allocatePartnerCode(
      requestedCode,
      user.name,
      user.email,
    );
    try {
      const created = await this.affiliates.create({
        code,
        name: user.name.trim() || code,
        commissionPercent: 0,
        revenueShareMonths: 0,
        active: true,
        ownerUserId: new Types.ObjectId(userId),
      });
      return {
        enrolled: true as const,
        created: true as const,
        affiliate: this.displayAffiliate(created, { includePayout: true }),
        shareUrl: this.shareUrlFor(created.code),
      };
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException(
          'Ese código ya está en uso. Prueba con otro.',
        );
      }
      throw error;
    }
  }

  async getPartnerDashboard(userId: string) {
    this.assertUserId(userId);
    await this.entitlements.assertBusiness(userId, {
      feature: 'affiliate',
      action: 'dashboard',
      upgradeTo: 'business',
    });
    const affiliate = await this.affiliates
      .findOne({ ownerUserId: userId, active: true })
      .lean();
    if (!affiliate) {
      return { enrolled: false as const };
    }

    await this.retireLegacyPercentageCommissions();
    await this.grantFlatBountiesForAffiliate(affiliate.affiliateId);

    const affiliateId = affiliate.affiliateId;
    const [attributions, commissionRows] = await Promise.all([
      this.attributions.find({ affiliateId }).lean(),
      this.commissions.find({ affiliateId }).lean(),
    ]);

    const referredUserIds = attributions.map((row) => row.userId);
    const [users, subscriptions] = await Promise.all([
      referredUserIds.length
        ? this.users
            .find({ _id: { $in: referredUserIds } })
            .select('name email active')
            .lean()
        : Promise.resolve([]),
      referredUserIds.length
        ? this.subscriptions.find({ userId: { $in: referredUserIds } }).lean()
        : Promise.resolve([]),
    ]);

    const userById = new Map(users.map((u) => [u._id.toString(), u]));
    const subByUser = new Map(
      subscriptions.map((s) => [s.userId.toString(), s]),
    );

    const commissionsByUser = new Map<string, number>();
    let commissionTotalMinor = 0;
    let commissionPaidMinor = 0;
    let commissionPendingMinor = 0;

    for (const event of commissionRows) {
      if (event.status === 'reversed') continue;
      if (!this.isFlatBounty(event)) continue;
      commissionTotalMinor += event.commissionAmountMinor;
      if (event.status === 'paid') {
        commissionPaidMinor += event.commissionAmountMinor;
      } else if (event.status === 'pending' || event.status === 'approved') {
        commissionPendingMinor += event.commissionAmountMinor;
      }
      const uid = event.userId.toString();
      commissionsByUser.set(
        uid,
        (commissionsByUser.get(uid) ?? 0) + event.commissionAmountMinor,
      );
    }

    const referred = attributions
      .map((attr) => {
        const uid = attr.userId.toString();
        const user = userById.get(uid);
        const sub = subByUser.get(uid);
        const paidActive = Boolean(sub && this.subscriptionIsActivePaid(sub));
        const earned = (commissionsByUser.get(uid) ?? 0) > 0;
        const plan = paidActive
          ? this.planLabel(sub!.entitlementId)
          : earned && sub
            ? this.planLabel(sub.entitlementId)
            : '—';
        const status = !user?.active
          ? 'Inactivo'
          : earned || paidActive
            ? 'Activo'
            : sub && ['cancelled', 'expired', 'refunded'].includes(sub.status)
                ? 'Cancelado'
                : 'Sin compra';
        return {
          userId: uid,
          label: this.maskUserLabel(user?.name, user?.email),
          attributedAt: attr.attributedAt,
          plan,
          status,
          commissionMinor: commissionsByUser.get(uid) ?? 0,
          currency: AFFILIATE_FLAT_BOUNTY_CURRENCY,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.attributedAt).getTime() -
          new Date(a.attributedAt).getTime(),
      );

    const signups = attributions.length;
    const plusConversions = commissionsByUser.size;
    const conversionRate =
      signups > 0 ? Math.round((plusConversions / signups) * 1000) / 10 : 0;

    return {
      enrolled: true as const,
      affiliate: this.displayAffiliate(affiliate, { includePayout: true }),
      shareUrl: this.shareUrlFor(affiliate.code),
      reward: {
        amountMinor: AFFILIATE_FLAT_BOUNTY_MINOR,
        currency: AFFILIATE_FLAT_BOUNTY_CURRENCY,
        once: true as const,
      },
      stats: {
        signups,
        plusConversions,
        conversionRate,
        commissionTotalMinor,
        commissionPaidMinor,
        commissionPendingMinor,
        currency: AFFILIATE_FLAT_BOUNTY_CURRENCY,
      },
      payoutRequest: this.payoutRequestState(
        affiliate,
        commissionPendingMinor,
      ),
      referred,
    };
  }

  async updatePartnerPayout(userId: string, dto: UpdateAffiliatePayoutDto) {
    this.assertUserId(userId);
    await this.entitlements.assertBusiness(userId, {
      feature: 'affiliate',
      action: 'payout',
      upgradeTo: 'business',
    });
    const affiliate = await this.affiliates
      .findOne({ ownerUserId: userId, active: true })
      .exec();
    if (!affiliate) {
      throw new NotFoundException('Aún no estás inscrito en el programa.');
    }

    const address = this.normalizeUsdtAddress(dto.network, dto.address);
    this.assertUsdtAddress(dto.network, address);

    affiliate.payoutMethod = {
      type: dto.type,
      asset: 'USDT',
      network: dto.network,
      address,
      updatedAt: new Date(),
    };
    await affiliate.save();

    return {
      payoutMethod: this.displayPayoutMethod(affiliate),
      affiliate: this.displayAffiliate(affiliate, { includePayout: true }),
    };
  }

  async requestPartnerPayout(userId: string) {
    this.assertUserId(userId);
    await this.entitlements.assertBusiness(userId, {
      feature: 'affiliate',
      action: 'payout-request',
      upgradeTo: 'business',
    });
    const dashboard = await this.getPartnerDashboard(userId);
    if (!dashboard.enrolled) {
      throw new NotFoundException('Aún no estás inscrito en el programa.');
    }
    const request = dashboard.payoutRequest;
    if (request.blockReason === 'no_wallet') {
      throw new BadRequestException(
        'Guarda tu wallet USDT antes de solicitar el pago.',
      );
    }
    if (request.blockReason === 'below_minimum') {
      throw new BadRequestException(
        `Acumula al menos US$ ${AFFILIATE_PAYOUT_MIN_MINOR / 100} para solicitar el pago.`,
      );
    }
    if (request.blockReason === 'already_requested') {
      throw new BadRequestException('Ya tienes una solicitud de pago en curso.');
    }

    await this.affiliates.updateOne(
      { ownerUserId: userId, active: true },
      {
        $set: {
          payoutRequestStatus: 'requested',
          payoutRequestedAt: new Date(),
        },
      },
    );

    return this.getPartnerDashboard(userId);
  }

  async recordCommissionFromRevenueEvent(
    input: RecordCommissionFromRevenueEventInput,
  ): Promise<CommissionEvent | null> {
    const providerEventId = input.providerEventId.trim();
    if (!providerEventId) {
      throw new BadRequestException('providerEventId is required');
    }

    const existing = await this.commissions.findOne({ providerEventId });
    if (existing) {
      if (existing.userId.toString() !== input.userId) {
        throw new ConflictException(
          'providerEventId is already linked to another user',
        );
      }
      return existing;
    }

    this.validateRevenueEvent(input);
    const occurredAt = new Date(input.occurredAt);
    const attribution = await this.attributions
      .findOne({ userId: input.userId })
      .lean();
    if (!attribution || occurredAt < attribution.attributedAt) return null;

    const affiliate = await this.affiliates
      .findOne({ affiliateId: attribution.affiliateId, active: true })
      .lean();
    if (!affiliate) return null;

    const isRefund =
      input.status === 'reversed' ||
      input.eventType.trim().toUpperCase() === 'REFUND';
    if (isRefund) {
      await this.commissions.updateMany(
        {
          userId: input.userId,
          affiliateId: affiliate.affiliateId,
          status: { $in: ['pending', 'approved', 'paid'] },
        },
        {
          $set: {
            status: 'reversed',
            payoutNote: 'Reembolso de la compra referida',
          },
        },
      );
      return null;
    }

    // Conversion counts even during the 3-day trial: the referred user chose Plus/Business.
    const alreadyPaidOut = await this.commissions.findOne({
      userId: input.userId,
      affiliateId: affiliate.affiliateId,
      status: { $in: ['pending', 'approved', 'paid'] },
      commissionAmountMinor: AFFILIATE_FLAT_BOUNTY_MINOR,
      commissionRate: 0,
    });
    if (alreadyPaidOut) return alreadyPaidOut;

    let subscriptionId: Types.ObjectId | undefined;
    if (input.subscriptionId && isValidObjectId(input.subscriptionId)) {
      subscriptionId = new Types.ObjectId(input.subscriptionId);
    } else {
      const sub = await this.subscriptions
        .findOne({ userId: input.userId })
        .select('_id')
        .lean();
      if (sub?._id) subscriptionId = sub._id;
    }
    const payload = {
      providerEventId,
      userId: input.userId,
      affiliateId: affiliate.affiliateId,
      product: input.product.trim(),
      eventType: input.eventType.trim(),
      grossAmountMinor: input.grossAmountMinor,
      netAmountMinor: input.netAmountMinor,
      storeFeeAmountMinor: input.storeFeeAmountMinor,
      commissionAmountMinor: AFFILIATE_FLAT_BOUNTY_MINOR,
      commissionRate: 0,
      currency: AFFILIATE_FLAT_BOUNTY_CURRENCY,
      status: input.status ?? 'pending',
      occurredAt,
      monthsSinceAttribution: 0,
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(input.status === 'paid' ? { paidAt: occurredAt } : {}),
    };

    try {
      return await this.commissions.create(payload);
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        const raced = await this.commissions.findOne({ providerEventId });
        if (raced && raced.userId.toString() === input.userId) return raced;
        throw new ConflictException(
          'providerEventId is already linked to another user',
        );
      }
      throw error;
    }
  }

  private async retireLegacyPercentageCommissions() {
    const result = await this.commissions.updateMany(
      {
        status: { $in: ['pending', 'approved', 'paid'] },
        commissionAmountMinor: { $ne: AFFILIATE_FLAT_BOUNTY_MINOR },
      },
      {
        $set: {
          status: 'reversed',
          payoutNote:
            'Saldos de prueba / porcentaje anulados. Remuneración vigente: US$ 5 una vez.',
        },
      },
    );
    if (result.modifiedCount > 0) {
      this.logger.log(
        `Reversed ${result.modifiedCount} legacy percentage commission event(s)`,
      );
    }
  }

  private isFlatBounty(event: {
    commissionAmountMinor: number;
    commissionRate?: number;
  }) {
    return event.commissionAmountMinor === AFFILIATE_FLAT_BOUNTY_MINOR;
  }

  private async grantFlatBountiesForAffiliate(affiliateId: string) {
    const attributions = await this.attributions
      .find({ affiliateId })
      .select('userId')
      .lean();
    if (!attributions.length) return;

    const userIds = attributions.map((row) => row.userId);
    const [subscriptions, existing] = await Promise.all([
      this.subscriptions.find({ userId: { $in: userIds } }).lean(),
      this.commissions
        .find({
          affiliateId,
          userId: { $in: userIds },
          status: { $in: ['pending', 'approved', 'paid'] },
          commissionAmountMinor: AFFILIATE_FLAT_BOUNTY_MINOR,
        })
        .select('userId')
        .lean(),
    ]);
    const subByUser = new Map(
      subscriptions.map((row) => [row.userId.toString(), row]),
    );
    const granted = new Set(existing.map((row) => row.userId.toString()));

    for (const attr of attributions) {
      const uid = attr.userId.toString();
      if (granted.has(uid)) continue;
      const sub = subByUser.get(uid);
      if (!sub || !this.subscriptionIsActivePaid(sub)) continue;
      try {
        await this.commissions.create({
          providerEventId: `flat-bounty-${affiliateId}-${uid}`,
          userId: attr.userId,
          affiliateId,
          product: sub.productId || sub.entitlementId || 'plus',
          eventType: 'flat_bounty',
          grossAmountMinor: 0,
          netAmountMinor: 0,
          storeFeeAmountMinor: 0,
          commissionAmountMinor: AFFILIATE_FLAT_BOUNTY_MINOR,
          commissionRate: 0,
          currency: AFFILIATE_FLAT_BOUNTY_CURRENCY,
          status: 'pending',
          occurredAt: sub.purchasedAt ?? new Date(),
          monthsSinceAttribution: 0,
        });
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
      }
    }
  }

  private payoutRequestState(
    affiliate: Affiliate,
    pendingMinor: number,
  ): {
    status: 'none' | 'requested' | 'paid';
    requestedAt: Date | null;
    canRequest: boolean;
    blockReason: 'no_wallet' | 'below_minimum' | 'already_requested' | null;
    minimumMinor: number;
  } {
    const hasWallet = Boolean(affiliate.payoutMethod?.address);
    const status =
      affiliate.payoutRequestStatus === 'requested' ||
      affiliate.payoutRequestStatus === 'paid'
        ? affiliate.payoutRequestStatus
        : 'none';
    let blockReason: 'no_wallet' | 'below_minimum' | 'already_requested' | null =
      null;
    if (status === 'requested') blockReason = 'already_requested';
    else if (!hasWallet) blockReason = 'no_wallet';
    else if (pendingMinor < AFFILIATE_PAYOUT_MIN_MINOR) {
      blockReason = 'below_minimum';
    }
    return {
      status,
      requestedAt: affiliate.payoutRequestedAt ?? null,
      canRequest: blockReason == null,
      blockReason,
      minimumMinor: AFFILIATE_PAYOUT_MIN_MINOR,
    };
  }

  private subscriptionIsActivePaid(sub: Subscription) {
    if (
      !ACTIVE_SUB_STATUSES.includes(
        sub.status as (typeof ACTIVE_SUB_STATUSES)[number],
      )
    ) {
      return false;
    }
    if (sub.expiresAt && sub.expiresAt.getTime() <= Date.now()) return false;
    const entitlement = sub.entitlementId?.toLowerCase() ?? '';
    return entitlement.includes('plus') || entitlement.includes('business');
  }

  private planLabel(entitlementId: string) {
    const normalized = entitlementId.toLowerCase();
    if (normalized.includes('business')) return 'Business';
    if (normalized.includes('plus')) return 'Plus';
    return 'Pago';
  }

  private maskUserLabel(name?: string, email?: string) {
    const trimmed = name?.trim();
    if (trimmed) return trimmed;
    if (!email) return 'Usuario';
    const [local, domain] = email.split('@');
    if (!domain) return 'Usuario';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private async allocatePartnerCode(
    requested: string | undefined,
    name: string,
    email: string,
  ) {
    if (requested?.trim()) {
      const normalized = requested.trim().toUpperCase();
      if (await this.affiliates.exists({ code: normalized })) {
        throw new ConflictException(
          'Ese código ya está en uso. Prueba con otro.',
        );
      }
      return normalized;
    }

    const base =
      this.slugCode(name) || this.slugCode(email.split('@')[0]) || 'TW';
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const suffix =
        attempt === 0 ? '' : String(Math.floor(10 + Math.random() * 90));
      const candidate = `${base}${suffix}`.slice(0, 24);
      if (!(await this.affiliates.exists({ code: candidate }))) {
        return candidate;
      }
    }
    return `TW${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  private slugCode(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
  }

  private shareUrlFor(code: string) {
    const origin = this.config
      .get<string>('PUBLIC_WEB_ORIGIN', 'https://tecnowallet.app')
      .replace(/\/$/, '');
    return `${origin}/r/${encodeURIComponent(code)}`;
  }

  private async claimResponse(attribution: UserAttribution, created: boolean) {
    const affiliate = await this.affiliates
      .findOne({ affiliateId: attribution.affiliateId })
      .lean();
    return {
      created,
      attribution: this.displayAttribution(attribution),
      affiliate: affiliate ? this.displayAffiliate(affiliate) : null,
    };
  }

  private async findActiveAffiliate(code: string) {
    const normalized = code.trim().toUpperCase();
    const affiliate = await this.affiliates
      .findOne({ code: normalized, active: true })
      .lean();
    if (!affiliate) throw new NotFoundException('Affiliate code not found');
    return affiliate;
  }

  private async validateClaimedClick(
    affiliateId: string,
    input: { clickId?: string; branchClickId?: string },
  ) {
    if (!input.clickId) return;
    const query: {
      affiliateId: string;
      clickId: string;
      branchClickId?: string;
    } = { affiliateId, clickId: input.clickId };
    if (input.branchClickId) query.branchClickId = input.branchClickId;
    if (!(await this.clicks.exists(query))) {
      throw new BadRequestException(
        'Click identifiers do not match the affiliate code',
      );
    }
  }

  private validateRevenueEvent(input: RecordCommissionFromRevenueEventInput) {
    this.assertUserId(input.userId);
    if (!input.product.trim() || !input.eventType.trim()) {
      throw new BadRequestException('product and eventType are required');
    }
    for (const [name, amount] of [
      ['grossAmountMinor', input.grossAmountMinor],
      ['netAmountMinor', input.netAmountMinor],
      ['storeFeeAmountMinor', input.storeFeeAmountMinor],
    ] as const) {
      if (!Number.isSafeInteger(amount)) {
        throw new BadRequestException(`${name} must be a safe integer`);
      }
    }
    if (!/^[A-Za-z]{3}$/.test(input.currency.trim())) {
      throw new BadRequestException('currency must be a 3-letter code');
    }
    if (Number.isNaN(new Date(input.occurredAt).getTime())) {
      throw new BadRequestException('occurredAt must be a valid date');
    }
  }

  private assertUserId(userId: string) {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid userId');
    }
  }

  private displayAffiliate(
    affiliate: Affiliate,
    options?: { includePayout?: boolean },
  ) {
    return {
      affiliateId: affiliate.affiliateId,
      code: affiliate.code,
      name: affiliate.name,
      bountyAmountMinor: AFFILIATE_FLAT_BOUNTY_MINOR,
      bountyCurrency: AFFILIATE_FLAT_BOUNTY_CURRENCY,
      branchUrl: affiliate.branchUrl,
      ...(options?.includePayout
        ? { payoutMethod: this.displayPayoutMethod(affiliate) }
        : {}),
    };
  }

  private displayPayoutMethod(affiliate: Affiliate) {
    const method = affiliate.payoutMethod;
    if (!method?.address || !method.network) return null;
    return {
      type: method.type ?? 'usdt_wallet',
      asset: method.asset ?? 'USDT',
      network: method.network,
      address: method.address,
      updatedAt: method.updatedAt ?? null,
    };
  }

  private normalizeUsdtAddress(network: AffiliateUsdtNetwork, address: string) {
    const trimmed = address.trim();
    if (network === 'bep20' || network === 'erc20') {
      return trimmed.toLowerCase();
    }
    return trimmed;
  }

  private assertUsdtAddress(network: AffiliateUsdtNetwork, address: string) {
    const ok =
      network === 'trc20'
        ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
        : network === 'sol'
          ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
          : /^0x[a-fA-F0-9]{40}$/.test(address);
    if (!ok) {
      throw new BadRequestException(
        network === 'trc20'
          ? 'La dirección TRC20 debe empezar por T.'
          : network === 'sol'
            ? 'La dirección Solana no es válida.'
            : 'La dirección BEP20/ERC20 debe ser 0x… (40 hex).',
      );
    }
  }

  private displayAttribution(attribution: UserAttribution) {
    return {
      affiliateId: attribution.affiliateId,
      code: attribution.code,
      branchClickId: attribution.branchClickId,
      clickId: attribution.clickId,
      source: attribution.source,
      attributedAt: attribution.attributedAt,
    };
  }

  private hashIp(ip?: string) {
    const normalized = this.cleanOptional(ip);
    return normalized
      ? createHash('sha256').update(normalized).digest('hex')
      : undefined;
  }

  private cleanOptional(value?: string) {
    const cleaned = value?.trim();
    return cleaned || undefined;
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    );
  }
}
