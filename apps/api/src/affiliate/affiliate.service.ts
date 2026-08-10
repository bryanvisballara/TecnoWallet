import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import { User } from '../auth/auth.module';
import { Subscription } from '../billing/billing.schemas';
import {
  Affiliate,
  AffiliateClick,
  AffiliateInstall,
  CommissionEvent,
  type CommissionEventStatus,
  UserAttribution,
} from './affiliate.schemas';

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
}

export type AffiliateTierId = 'partner' | 'creator' | 'ambassador';

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
export class AffiliateService {
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
  ) {}

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
    const existing = await this.affiliates
      .findOne({ ownerUserId: userId })
      .lean();
    if (existing) {
      return {
        enrolled: true as const,
        created: false as const,
        affiliate: this.displayAffiliate(existing),
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
    const tier = this.resolveTier(0);
    try {
      const created = await this.affiliates.create({
        code,
        name: user.name.trim() || code,
        commissionPercent: tier.commissionPercent,
        revenueShareMonths: 12,
        active: true,
        ownerUserId: new Types.ObjectId(userId),
      });
      return {
        enrolled: true as const,
        created: true as const,
        affiliate: this.displayAffiliate(created),
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
    const affiliate = await this.affiliates
      .findOne({ ownerUserId: userId, active: true })
      .lean();
    if (!affiliate) {
      return { enrolled: false as const };
    }

    const affiliateId = affiliate.affiliateId;
    const [clickCount, installCount, attributions, commissionRows] =
      await Promise.all([
        this.clicks.countDocuments({ affiliateId }),
        this.installs.countDocuments({ affiliateId }),
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
    let revenueGeneratedMinor = 0;
    let commissionTotalMinor = 0;
    let commissionPaidMinor = 0;
    let commissionPendingMinor = 0;

    for (const event of commissionRows) {
      if (event.status === 'reversed') continue;
      revenueGeneratedMinor += event.netAmountMinor;
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

    let activePaidCount = 0;
    const referred = attributions
      .map((attr) => {
        const uid = attr.userId.toString();
        const user = userById.get(uid);
        const sub = subByUser.get(uid);
        const paidActive = Boolean(sub && this.subscriptionIsActivePaid(sub));
        if (paidActive) activePaidCount += 1;
        const plan = paidActive ? this.planLabel(sub!.entitlementId) : 'Free';
        const status = !user?.active
          ? 'Inactivo'
          : paidActive
            ? 'Activo'
            : sub && ['cancelled', 'expired', 'refunded'].includes(sub.status)
              ? 'Cancelado'
              : 'Free';
        return {
          userId: uid,
          label: this.maskUserLabel(user?.name, user?.email),
          attributedAt: attr.attributedAt,
          plan,
          status,
          commissionMinor: commissionsByUser.get(uid) ?? 0,
          currency: commissionRows[0]?.currency ?? 'USD',
        };
      })
      .sort(
        (a, b) =>
          new Date(b.attributedAt).getTime() -
          new Date(a.attributedAt).getTime(),
      );

    const tier = this.resolveTier(activePaidCount);
    if (affiliate.commissionPercent !== tier.commissionPercent) {
      await this.affiliates.updateOne(
        { _id: affiliate._id },
        { $set: { commissionPercent: tier.commissionPercent } },
      );
      affiliate.commissionPercent = tier.commissionPercent;
    }

    const signups = attributions.length;
    const plusConversions = activePaidCount;
    const conversionRate =
      signups > 0 ? Math.round((plusConversions / signups) * 1000) / 10 : 0;

    return {
      enrolled: true as const,
      affiliate: this.displayAffiliate(affiliate),
      shareUrl: this.shareUrlFor(affiliate.code),
      tier,
      stats: {
        clicks: clickCount,
        downloads: installCount,
        signups,
        plusConversions,
        conversionRate,
        revenueGeneratedMinor,
        commissionTotalMinor,
        commissionPaidMinor,
        commissionPendingMinor,
        currency: commissionRows[0]?.currency ?? 'USD',
      },
      referred,
    };
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
      .findOne({ affiliateId: attribution.affiliateId })
      .lean();
    if (!affiliate || affiliate.revenueShareMonths <= 0) return null;

    const shareEndsAt = this.addCalendarMonths(
      attribution.attributedAt,
      affiliate.revenueShareMonths,
    );
    if (occurredAt >= shareEndsAt) return null;

    const paidCount = await this.countActivePaidReferrals(affiliate.affiliateId);
    const tier = this.resolveTier(paidCount);
    if (affiliate.commissionPercent !== tier.commissionPercent) {
      await this.affiliates.updateOne(
        { _id: affiliate._id },
        { $set: { commissionPercent: tier.commissionPercent } },
      );
    }

    const commissionAmountMinor = Math.round(
      (input.netAmountMinor * tier.commissionPercent) / 100,
    );
    const payload = {
      providerEventId,
      userId: input.userId,
      affiliateId: affiliate.affiliateId,
      product: input.product.trim(),
      eventType: input.eventType.trim(),
      grossAmountMinor: input.grossAmountMinor,
      netAmountMinor: input.netAmountMinor,
      storeFeeAmountMinor: input.storeFeeAmountMinor,
      commissionAmountMinor,
      currency: input.currency.trim().toUpperCase(),
      status: input.status ?? 'pending',
      occurredAt,
      monthsSinceAttribution: this.monthsBetween(
        attribution.attributedAt,
        occurredAt,
      ),
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

  resolveTier(activePaidCount: number): {
    id: AffiliateTierId;
    label: string;
    commissionPercent: number;
    rangeLabel: string;
    activePaidCount: number;
  } {
    if (activePaidCount >= 501) {
      return {
        id: 'ambassador',
        label: 'Ambassador',
        commissionPercent: 40,
        rangeLabel: '501+',
        activePaidCount,
      };
    }
    if (activePaidCount >= 101) {
      return {
        id: 'creator',
        label: 'Creator',
        commissionPercent: 30,
        rangeLabel: '101–500',
        activePaidCount,
      };
    }
    return {
      id: 'partner',
      label: 'Partner',
      commissionPercent: 20,
      rangeLabel: '1–100',
      activePaidCount,
    };
  }

  private async countActivePaidReferrals(affiliateId: string) {
    const attributions = await this.attributions
      .find({ affiliateId })
      .select('userId')
      .lean();
    if (!attributions.length) return 0;
    const userIds = attributions.map((row) => row.userId);
    const subs = await this.subscriptions
      .find({ userId: { $in: userIds } })
      .lean();
    return subs.filter((sub) => this.subscriptionIsActivePaid(sub)).length;
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

  private displayAffiliate(affiliate: Affiliate) {
    return {
      affiliateId: affiliate.affiliateId,
      code: affiliate.code,
      name: affiliate.name,
      commissionPercent: affiliate.commissionPercent,
      revenueShareMonths: affiliate.revenueShareMonths,
      branchUrl: affiliate.branchUrl,
    };
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

  private addCalendarMonths(date: Date, months: number) {
    const result = new Date(date);
    const targetMonth = result.getUTCMonth() + months;
    const targetYear = result.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(
      Date.UTC(targetYear, normalizedMonth + 1, 0),
    ).getUTCDate();
    result.setUTCFullYear(
      targetYear,
      normalizedMonth,
      Math.min(result.getUTCDate(), lastDay),
    );
    return result;
  }

  private monthsBetween(start: Date, end: Date) {
    let months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth();
    if (months > 0 && end < this.addCalendarMonths(start, months)) months -= 1;
    return Math.max(0, months);
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
