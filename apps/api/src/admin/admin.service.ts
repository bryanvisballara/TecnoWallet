import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  Affiliate,
  CommissionEvent,
  type CommissionEventStatus,
} from '../affiliate/affiliate.schemas';
import { User } from '../auth/auth.module';
import { Subscription } from '../billing/billing.schemas';
import { EntitlementService } from '../billing/entitlement.service';
import { BrevoMailer } from '../mail/brevo';
import type {
  AdminPayoutsQueryDto,
  ManualUpgradeDto,
  MarkCommissionsPaidDto,
  PayAffiliateDto,
} from './admin.dto';
import { affiliatePayoutEmailHtml } from './payout-email';

export const AFFILIATE_PAYOUT_MIN_MINOR = 10_000;
export const AFFILIATE_PAYOUT_DAY = 15;

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<Subscription>,
    @InjectModel(CommissionEvent.name)
    private readonly commissions: Model<CommissionEvent>,
    @InjectModel(Affiliate.name)
    private readonly affiliates: Model<Affiliate>,
    private readonly entitlements: EntitlementService,
    private readonly config: ConfigService,
    private readonly mailer: BrevoMailer,
  ) {}

  payoutPolicy() {
    return {
      paydayDay: AFFILIATE_PAYOUT_DAY,
      minimumUsd: AFFILIATE_PAYOUT_MIN_MINOR / 100,
      minimumMinor: AFFILIATE_PAYOUT_MIN_MINOR,
      rule: 'Un solo día de pago al mes (día 15). Se desembolsa el saldo acumulado no pagado hasta el mes anterior, solo si es ≥ USD 100 y el afiliado ya registró wallet USDT. Ellos no eligen la fecha.',
    };
  }

  async userStats() {
    const users = await this.users
      .find({ active: true })
      .select('_id')
      .lean();
    const userIds = users.map((row) => row._id);
    const subscriptions = userIds.length
      ? await this.subscriptions.find({ userId: { $in: userIds } }).lean()
      : [];
    const subByUser = new Map(
      subscriptions.map((sub) => [sub.userId.toString(), sub]),
    );

    let free = 0;
    let plus = 0;
    let business = 0;
    for (const user of users) {
      const plan = this.entitlements.planFromSubscription(
        subByUser.get(user._id.toString()),
      );
      if (plan === 'business') business += 1;
      else if (plan === 'plus') plus += 1;
      else free += 1;
    }

    return {
      total: users.length,
      free,
      plus,
      business,
    };
  }

  async affiliatePayouts(query: AdminPayoutsQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const occurredAt: { $gte?: Date; $lte?: Date } = {};
    if (query.from) {
      const from = new Date(query.from);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException('Invalid from date');
      }
      occurredAt.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException('Invalid to date');
      }
      occurredAt.$lte = to;
    }
    if (Object.keys(occurredAt).length) filter.occurredAt = occurredAt;

    const rows = await this.commissions
      .find(filter)
      .sort({ occurredAt: -1 })
      .lean();

    const affiliateIds = [...new Set(rows.map((row) => row.affiliateId))];
    const userIds = [...new Set(rows.map((row) => row.userId.toString()))];
    const [affiliates, referredUsers] = await Promise.all([
      affiliateIds.length
        ? this.affiliates.find({ affiliateId: { $in: affiliateIds } }).lean()
        : Promise.resolve([]),
      userIds.length
        ? this.users
            .find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
            .select('name email')
            .lean()
        : Promise.resolve([]),
    ]);
    const ownerIds = [
      ...new Set(
        affiliates
          .map((row) => row.ownerUserId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const owners = ownerIds.length
      ? await this.users
          .find({ _id: { $in: ownerIds.map((id) => new Types.ObjectId(id)) } })
          .select('name email')
          .lean()
      : [];
    const ownerById = new Map(owners.map((row) => [row._id.toString(), row]));
    const affiliateById = new Map(
      affiliates.map((row) => [row.affiliateId, row]),
    );
    const userById = new Map(
      referredUsers.map((row) => [row._id.toString(), row]),
    );

    type Aggregate = {
      affiliateId: string;
      affiliateName: string;
      affiliateCode: string;
      email: string | null;
      commissionTotalMinor: number;
      pendingMinor: number;
      currency: string;
      status: CommissionEventStatus;
      simulated: boolean;
      payoutMethod: {
        type: string;
        asset: string;
        network: string;
        address: string;
      } | null;
      commissions: Array<{
        id: string;
        userId: string;
        userLabel: string;
        affiliateId: string;
        subscriptionId: string | null;
        commissionRate: number;
        commissionAmountMinor: number;
        currency: string;
        status: CommissionEventStatus;
        product: string;
        planLabel: string;
        occurredAt: Date;
        paidAt: Date | null;
      }>;
    };

    const byAffiliate = new Map<string, Aggregate>();
    for (const row of rows) {
      const affiliate = affiliateById.get(row.affiliateId);
      const referred = userById.get(row.userId.toString());
      let bucket = byAffiliate.get(row.affiliateId);
      if (!bucket) {
        const payout = affiliate?.payoutMethod;
        const owner = affiliate?.ownerUserId
          ? ownerById.get(affiliate.ownerUserId.toString())
          : undefined;
        bucket = {
          affiliateId: row.affiliateId,
          affiliateName: affiliate?.name ?? row.affiliateId,
          affiliateCode: affiliate?.code ?? '',
          email: owner?.email ?? null,
          commissionTotalMinor: 0,
          pendingMinor: 0,
          currency: row.currency || 'USD',
          status: row.status,
          simulated: row.eventType === 'admin_simulate',
          payoutMethod:
            payout?.address && payout.network
              ? {
                  type: payout.type ?? 'usdt_wallet',
                  asset: payout.asset ?? 'USDT',
                  network: payout.network,
                  address: payout.address,
                }
              : null,
          commissions: [],
        };
        byAffiliate.set(row.affiliateId, bucket);
      }
      if (row.status !== 'reversed') {
        bucket.commissionTotalMinor += row.commissionAmountMinor;
      }
      if (row.status === 'pending' || row.status === 'approved') {
        bucket.pendingMinor += row.commissionAmountMinor;
      }
      if (row.eventType === 'admin_simulate') bucket.simulated = true;
      bucket.commissions.push({
        id: row._id.toString(),
        userId: row.userId.toString(),
        userLabel:
          referred?.name?.trim() ||
          referred?.email ||
          `#${row.userId.toString().slice(-5)}`,
        affiliateId: row.affiliateId,
        subscriptionId: row.subscriptionId?.toString() ?? null,
        commissionRate: row.commissionRate ?? 0,
        commissionAmountMinor: row.commissionAmountMinor,
        currency: row.currency,
        status: row.status,
        product: row.product,
        planLabel: this.planLabelFromProduct(row.product),
        occurredAt: row.occurredAt,
        paidAt: row.paidAt ?? null,
      });
    }

    const affiliatesOut = [...byAffiliate.values()].map((bucket) => {
      const status = this.dominantStatus(bucket.commissions.map((c) => c.status));
      const hasWallet = Boolean(bucket.payoutMethod?.address);
      let blockReason: 'no_wallet' | 'below_minimum' | 'already_paid' | null =
        null;
      if (bucket.pendingMinor <= 0) blockReason = 'already_paid';
      else if (!hasWallet) blockReason = 'no_wallet';
      else if (bucket.pendingMinor < AFFILIATE_PAYOUT_MIN_MINOR) {
        blockReason = 'below_minimum';
      }
      return {
        ...bucket,
        status,
        ready: blockReason == null,
        blockReason,
      };
    });
    affiliatesOut.sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      return b.pendingMinor - a.pendingMinor;
    });

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      status: query.status ?? null,
      policy: this.payoutPolicy(),
      affiliates: affiliatesOut,
    };
  }

  async approveCommission(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid id');
    const updated = await this.commissions.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status: 'approved' } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Pending commission not found');
    }
    return { id: updated._id.toString(), status: updated.status };
  }

  async markCommissionsPaid(dto: MarkCommissionsPaidDto) {
    const filter: Record<string, unknown> = {
      status: { $in: ['pending', 'approved'] },
    };
    if (dto.ids?.length) {
      filter._id = {
        $in: dto.ids.filter(isValidObjectId).map((id) => new Types.ObjectId(id)),
      };
    }
    if (dto.affiliateId?.trim()) {
      filter.affiliateId = dto.affiliateId.trim();
    }
    const occurredAt: { $gte?: Date; $lte?: Date } = {};
    if (dto.from) {
      const from = new Date(dto.from);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException('Invalid from date');
      }
      occurredAt.$gte = from;
    }
    if (dto.to) {
      const to = new Date(dto.to);
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException('Invalid to date');
      }
      occurredAt.$lte = to;
    }
    if (Object.keys(occurredAt).length) filter.occurredAt = occurredAt;

    const paidAt = new Date();
    const result = await this.commissions.updateMany(filter, {
      $set: { status: 'paid', paidAt },
    });
    return {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      paidAt,
      note: dto.note?.trim() || null,
    };
  }

  async searchUsers(
    q?: string,
    planFilter: 'all' | 'free' | 'plus' | 'business' = 'all',
  ) {
    const query = q?.trim().toLowerCase() ?? '';
    const filter = query
      ? {
          active: true,
          $or: [
            { email: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
            { name: { $regex: query, $options: 'i' } },
          ],
        }
      : { active: true };
    const users = await this.users
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(80)
      .select('name email platformRole createdAt')
      .lean();
    const ids = users.map((u) => u._id);
    const subscriptions = ids.length
      ? await this.subscriptions.find({ userId: { $in: ids } }).lean()
      : [];
    const subByUser = new Map(
      subscriptions.map((sub) => [sub.userId.toString(), sub]),
    );
    const mapped = users.map((user) => {
      const sub = subByUser.get(user._id.toString());
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        platformRole: user.platformRole === 'admin' ? 'admin' : 'user',
        plan: this.entitlements.planFromSubscription(sub),
        expiresAt: sub?.expiresAt ?? null,
        provider: sub?.provider ?? null,
        createdAt: user.createdAt ?? null,
      };
    });
    const plan = planFilter || 'all';
    return {
      users:
        plan === 'all' ? mapped : mapped.filter((row) => row.plan === plan),
    };
  }

  async userDetail(userId: string) {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.users
      .findById(userId)
      .select('name email platformRole active createdAt updatedAt')
      .lean();
    if (!user) throw new NotFoundException('User not found');

    const subscription = await this.subscriptions.findOne({ userId }).lean();
    const commissions = await this.commissions
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ occurredAt: -1 })
      .limit(40)
      .lean();

    const plan = this.entitlements.planFromSubscription(subscription);
    const upgrades: Array<{
      at: string;
      plan: string;
      provider: string;
      productId: string | null;
      status: string;
      expiresAt: string | null;
      source: 'subscription' | 'commission';
    }> = [];

    if (subscription?.purchasedAt || subscription?.updatedAt) {
      upgrades.push({
        at: (
          subscription.purchasedAt ??
          subscription.updatedAt ??
          new Date()
        ).toISOString(),
        plan: this.planLabelFromProduct(
          subscription.productId || subscription.entitlementId || plan,
        ),
        provider: subscription.provider || 'unknown',
        productId: subscription.productId ?? null,
        status: subscription.status,
        expiresAt: subscription.expiresAt
          ? subscription.expiresAt.toISOString()
          : null,
        source: 'subscription',
      });
    }

    for (const event of commissions) {
      upgrades.push({
        at: event.occurredAt.toISOString(),
        plan: this.planLabelFromProduct(event.product),
        provider: 'store',
        productId: event.product,
        status: event.status,
        expiresAt: null,
        source: 'commission',
      });
    }

    upgrades.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    const payments = commissions.map((event) => ({
      id: event._id.toString(),
      at: event.occurredAt.toISOString(),
      product: event.product,
      planLabel: this.planLabelFromProduct(event.product),
      eventType: event.eventType,
      amountMinor: event.netAmountMinor,
      commissionAmountMinor: event.commissionAmountMinor,
      currency: event.currency,
      status: event.status,
      paidAt: event.paidAt ? event.paidAt.toISOString() : null,
    }));

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        platformRole: user.platformRole === 'admin' ? 'admin' : 'user',
        active: Boolean(user.active),
        createdAt: user.createdAt ? user.createdAt.toISOString() : null,
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
      },
      plan,
      subscription: subscription
        ? {
            status: subscription.status,
            provider: subscription.provider,
            productId: subscription.productId ?? null,
            entitlementId: subscription.entitlementId,
            purchasedAt: subscription.purchasedAt
              ? subscription.purchasedAt.toISOString()
              : null,
            expiresAt: subscription.expiresAt
              ? subscription.expiresAt.toISOString()
              : null,
            willRenew: Boolean(subscription.willRenew),
            updatedAt: subscription.updatedAt
              ? subscription.updatedAt.toISOString()
              : null,
          }
        : null,
      upgrades,
      payments,
    };
  }

  async upgradeUser(userId: string, dto: ManualUpgradeDto) {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const user = await this.users.findById(userId).lean();
    if (!user?.active) throw new NotFoundException('User not found');

    const now = new Date();

    if (dto.plan === 'free') {
      const subscription = await this.subscriptions.findOneAndUpdate(
        { userId },
        {
          $set: {
            appUserId: userId,
            status: 'cancelled',
            entitlementId: 'free',
            productId: 'manual_free',
            purchasedAt: now,
            expiresAt: now,
            willRenew: false,
            provider: 'manual',
            lastEventId: `manual_free_${now.getTime()}`,
            environment:
              this.config.get<string>('NODE_ENV', 'development') ===
              'production'
                ? 'PRODUCTION'
                : 'SANDBOX',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return {
        userId,
        plan: 'free' as const,
        entitlementId: 'free',
        expiresAt: subscription.expiresAt,
        provider: 'manual',
        months: 0,
      };
    }

    const months = dto.months ?? 1;
    const entitlementId =
      dto.plan === 'business'
        ? this.entitlements.businessEntitlementId()
        : this.entitlements.plusEntitlementId();
    const expiresAt = new Date(now);
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);

    const subscription = await this.subscriptions.findOneAndUpdate(
      { userId },
      {
        $set: {
          appUserId: userId,
          status: 'active',
          entitlementId,
          productId: `manual_${dto.plan}`,
          purchasedAt: now,
          expiresAt,
          willRenew: false,
          provider: 'manual',
          lastEventId: `manual_${now.getTime()}`,
          environment:
            this.config.get<string>('NODE_ENV', 'development') === 'production'
              ? 'PRODUCTION'
              : 'SANDBOX',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      userId,
      plan: dto.plan,
      entitlementId,
      expiresAt: subscription.expiresAt,
      provider: 'manual',
      months,
    };
  }

  async simulatePayouts(adminUserId: string, adminEmail: string) {
    await this.clearSimulatedPayouts();
    const now = new Date();
    const occurredAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 12, 15, 0, 0),
    );
    const ownerId = new Types.ObjectId(adminUserId);
    const seeds: Array<{
      name: string;
      usd: number;
      network?: 'bep20' | 'trc20' | 'erc20' | 'sol';
      address?: string;
    }> = [
      { name: 'Ana Torres', usd: 180, network: 'bep20', address: '0xANA1111111111111111111111111111111111111' },
      { name: 'Carlos Méndez', usd: 250, network: 'trc20', address: 'TCar1osUsdtWallet111111111111111111' },
      { name: 'Diana Ruiz', usd: 100, network: 'sol', address: 'SoLDianaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' },
      { name: 'Elena Castro', usd: 99, network: 'erc20', address: '0xELE9999999999999999999999999999999999999' },
      { name: 'Fabio López' , usd: 220 },
      { name: 'Gabriela Díaz', usd: 45, network: 'bep20', address: '0xGAB4545454545454545454545454545454545454' },
      { name: 'Hugo Ríos', usd: 80 },
      { name: 'Irene Salas', usd: 320, network: 'trc20', address: 'TIreNeUsdtWallet222222222222222222' },
      { name: 'Julián Pardo', usd: 150, network: 'bep20', address: '0xJUL1501501501501501501501501501501501501' },
      { name: 'Karina Vega', usd: 500, network: 'sol', address: 'SoLKarinaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' },
    ];

    const created = [];
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i];
      const code = `SIM${String(i + 1).padStart(2, '0')}`;
      const affiliateId = `sim-${code.toLowerCase()}`;
      await this.affiliates.create({
        code,
        name: seed.name,
        affiliateId,
        commissionPercent: 20,
        active: true,
        revenueShareMonths: 12,
        ...(seed.network && seed.address
          ? {
              payoutMethod: {
                type: 'usdt_wallet',
                asset: 'USDT',
                network: seed.network,
                address: seed.address,
                updatedAt: now,
              },
            }
          : {}),
      });
      await this.commissions.create({
        providerEventId: `sim-${affiliateId}-${occurredAt.getTime()}`,
        userId: ownerId,
        affiliateId,
        product: 'tecnowallet_plus',
        eventType: 'admin_simulate',
        grossAmountMinor: seed.usd * 500,
        netAmountMinor: seed.usd * 500,
        storeFeeAmountMinor: 0,
        commissionAmountMinor: seed.usd * 100,
        currency: 'USD',
        status: 'pending',
        occurredAt,
        monthsSinceAttribution: 1,
        commissionRate: 20,
      });
      created.push({
        name: seed.name,
        amountUsd: seed.usd,
        hasWallet: Boolean(seed.address),
      });
    }

    return {
      created: created.length,
      email: adminEmail,
      notice:
        '10 pagos de prueba del mes anterior. El correo de pago llega a tu email de admin.',
      rows: created,
    };
  }

  async clearSimulatedPayouts() {
    const simulated = await this.affiliates
      .find({ affiliateId: { $regex: /^sim-/ } })
      .select('affiliateId')
      .lean();
    const ids = simulated.map((row) => row.affiliateId);
    const commissions = await this.commissions.deleteMany({
      $or: [
        { eventType: 'admin_simulate' },
        ids.length ? { affiliateId: { $in: ids } } : { affiliateId: '__none__' },
      ],
    });
    const affiliates = await this.affiliates.deleteMany({
      affiliateId: { $regex: /^sim-/ },
    });
    return {
      commissions: commissions.deletedCount,
      affiliates: affiliates.deletedCount,
    };
  }

  async payAffiliate(
    affiliateId: string,
    dto: PayAffiliateDto,
    adminEmail: string,
  ) {
    const affiliate = await this.affiliates.findOne({ affiliateId }).lean();
    if (!affiliate) throw new NotFoundException('Affiliate not found');

    const wallet = affiliate.payoutMethod;
    if (!wallet?.address || !wallet.network) {
      throw new BadRequestException(
        'NO_WALLET: Este afiliado no ha registrado wallet USDT. No se puede pagar. Pídele que la cargue en Afiliados.',
      );
    }

    const filter: Record<string, unknown> = {
      affiliateId,
      status: { $in: ['pending', 'approved'] },
    };
    const occurredAt: { $gte?: Date; $lte?: Date } = {};
    if (dto.from) {
      const from = new Date(dto.from);
      if (Number.isNaN(from.getTime())) {
        throw new BadRequestException('Invalid from date');
      }
      occurredAt.$gte = from;
    }
    if (dto.to) {
      const to = new Date(dto.to);
      if (Number.isNaN(to.getTime())) {
        throw new BadRequestException('Invalid to date');
      }
      occurredAt.$lte = to;
    } else {
      const now = new Date();
      occurredAt.$lte = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59),
      );
    }
    if (Object.keys(occurredAt).length) filter.occurredAt = occurredAt;

    const unpaid = await this.commissions.find(filter).lean();
    const pendingMinor = unpaid.reduce(
      (sum, row) => sum + row.commissionAmountMinor,
      0,
    );
    if (pendingMinor <= 0) {
      throw new BadRequestException('ALREADY_PAID: No hay saldo pendiente.');
    }
    if (pendingMinor < AFFILIATE_PAYOUT_MIN_MINOR) {
      throw new BadRequestException(
        `BELOW_MINIMUM: El saldo es USD ${(pendingMinor / 100).toFixed(2)}. Mínimo de desembolso: USD 100. Se acumula al próximo día 15.`,
      );
    }

    const paidAt = new Date();
    const ids = unpaid.map((row) => row._id);
    await this.commissions.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: 'paid',
          paidAt,
          payoutNote: dto.note?.trim() || 'Pago USDT día 15',
          payoutProofName: dto.proofName?.trim() || undefined,
        },
      },
    );

    const owner = affiliate.ownerUserId
      ? await this.users
          .findById(affiliate.ownerUserId)
          .select('name email')
          .lean()
      : null;
    const to = owner?.email || adminEmail;
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(pendingMinor / 100);
    const period = `${dto.from || 'acumulado'} → ${dto.to || 'mes anterior'}`;
    const proof = dto.proofBase64?.replace(/^data:[^;]+;base64,/, '').trim();
    const delivery = await this.mailer.sendHtml({
      to,
      subject: `TecnoWallet · Comisión pagada ${amount}`,
      htmlContent: affiliatePayoutEmailHtml({
        name: affiliate.name,
        amount,
        network: wallet.network.toUpperCase(),
        address: wallet.address,
        period,
        hasProof: Boolean(proof && dto.proofName),
      }),
      attachments:
        proof && dto.proofName
          ? [{ name: dto.proofName, content: proof }]
          : undefined,
    });

    return {
      affiliateId,
      paidMinor: pendingMinor,
      currency: 'USD',
      paidAt,
      email: to,
      emailDelivered: delivery.delivered,
      wallet: {
        asset: wallet.asset ?? 'USDT',
        network: wallet.network,
        address: wallet.address,
      },
      remainingPendingMinor: 0,
    };
  }

  private dominantStatus(
    statuses: CommissionEventStatus[],
  ): CommissionEventStatus {
    if (statuses.some((s) => s === 'pending')) return 'pending';
    if (statuses.some((s) => s === 'approved')) return 'approved';
    if (statuses.some((s) => s === 'paid')) return 'paid';
    return 'reversed';
  }

  private planLabelFromProduct(product: string) {
    const value = product.toLowerCase();
    if (value.includes('business')) return 'TecnoWallet Business';
    if (value.includes('plus')) return 'TecnoWallet+';
    return product;
  }
}
