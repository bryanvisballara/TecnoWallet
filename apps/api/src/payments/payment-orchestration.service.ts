import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { RecaudosService } from '../recaudos/recaudos.module';
import {
  FinancialAllocation,
  PaymentIntent,
  ProviderWebhookEvent,
  RecurringFundingSchedule,
  type PaymentIntentStatus,
} from '../payments/payments.schemas';
import { PaymentProvider } from '../payments/payment-provider';
import { UnitAccountService } from '../unit/unit-account.service';
import { UnitCounterpartyService } from '../unit/unit-counterparty.service';
import { UnitCustomerService } from '../unit/unit-customer.service';
import { mapUnitPaymentStatus } from '../unit/unit-payment.service';
import type { HydratedDocument } from 'mongoose';

type AuthLike = { userId: string; email: string };

@Injectable()
export class PaymentOrchestrationService {
  private readonly logger = new Logger(PaymentOrchestrationService.name);

  constructor(
    @InjectModel(PaymentIntent.name)
    private readonly intents: Model<PaymentIntent>,
    @InjectModel(FinancialAllocation.name)
    private readonly allocations: Model<FinancialAllocation>,
    @InjectModel(RecurringFundingSchedule.name)
    private readonly schedules: Model<RecurringFundingSchedule>,
    @InjectModel(ProviderWebhookEvent.name)
    private readonly webhookEvents: Model<ProviderWebhookEvent>,
    private readonly provider: PaymentProvider,
    private readonly customers: UnitCustomerService,
    private readonly accounts: UnitAccountService,
    private readonly counterparties: UnitCounterpartyService,
    private readonly recaudos: RecaudosService,
    private readonly config: ConfigService,
  ) {}

  async getIntent(id: string, userId: string) {
    const intent = await this.intents.findById(id);
    if (!intent) throw new NotFoundException('Payment intent not found');
    if (intent.userId.toString() !== userId) {
      throw new NotFoundException('Payment intent not found');
    }
    return this.presentIntent(intent);
  }

  async balances(recaudoId: string) {
    const rows = await this.intents.aggregate<{
      _id: string;
      total: number;
    }>([
      {
        $match: {
          recaudoId: new Types.ObjectId(recaudoId),
          fundingSource: 'unit_ach',
        },
      },
      { $group: { _id: '$status', total: { $sum: '$amountMinor' } } },
    ]);
    const byStatus = Object.fromEntries(
      rows.map((row) => [row._id, row.total]),
    ) as Record<string, number>;

    const settledIn = await this.allocations.aggregate<{ total: number }>([
      {
        $match: {
          recaudoId: new Types.ObjectId(recaudoId),
          entry: 'credit',
        },
      },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]);
    const settledOut = await this.allocations.aggregate<{ total: number }>([
      {
        $match: {
          recaudoId: new Types.ObjectId(recaudoId),
          entry: 'debit',
        },
      },
      { $group: { _id: null, total: { $sum: '$amountMinor' } } },
    ]);

    const availableMinor = Math.max(
      0,
      (settledIn[0]?.total ?? 0) - (settledOut[0]?.total ?? 0),
    );
    const pendingMinor = byStatus.pending ?? 0;
    const processingMinor =
      (byStatus.clearing ?? 0) +
      (byStatus.processing ?? 0) +
      (byStatus.sent ?? 0) +
      (byStatus.created ?? 0);
    const failedMinor =
      (byStatus.failed ?? 0) +
      (byStatus.returned ?? 0) +
      (byStatus.rejected ?? 0) +
      (byStatus.canceled ?? 0);

    return {
      availableMinor,
      pendingMinor,
      processingMinor,
      failedMinor,
      inFlightMinor: availableMinor + pendingMinor + processingMinor,
    };
  }

  async fundContribution(input: {
    recaudoId: string;
    amountMinor: number;
    note?: string;
    counterpartyId?: string;
    idempotencyKey: string;
    principal: AuthLike;
  }) {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new BadRequestException('amountMinor must be a positive integer');
    }
    const context = await this.recaudos.getFundingContext(
      input.recaudoId,
      input.principal.userId,
    );
    if (context.recaudo.status !== 'open') {
      throw new ConflictException('Recaudo is closed');
    }

    const replay = await this.intents.findOne({
      recaudoId: input.recaudoId,
      userId: input.principal.userId,
      idempotencyKey: input.idempotencyKey,
    });
    if (replay) {
      if (replay.amountMinor !== input.amountMinor) {
        throw new ConflictException(
          'Idempotency key was already used with different input',
        );
      }
      return {
        intent: this.presentIntent(replay),
        balances: await this.balances(input.recaudoId),
        idempotentReplay: true,
      };
    }

    await this.customers.requireApprovedCustomerId(input.principal.userId);
    const walletId = await this.accounts.requireOpenWalletId(
      context.recaudo.workspaceId.toString(),
    );
    const counterparty = await this.counterparties.getActive(
      input.principal.userId,
      input.counterpartyId,
    );
    if (!counterparty) {
      throw new BadRequestException(
        'Link an external bank account (counterparty) before funding',
      );
    }

    const intent = await this.intents.create({
      workspaceId: context.recaudo.workspaceId,
      recaudoId: context.recaudo._id,
      participantId: context.participant._id,
      userId: input.principal.userId,
      amountMinor: input.amountMinor,
      currency: context.recaudo.currency,
      direction: 'inbound',
      method: 'ach_debit',
      fundingSource: 'unit_ach',
      status: 'created',
      idempotencyKey: input.idempotencyKey,
      provider: 'unit',
      note: input.note,
      tags: {
        tecnowalletRecaudoId: input.recaudoId,
        tecnowalletParticipantId: context.participant._id.toString(),
        tecnowalletUserId: input.principal.userId,
        tecnowalletIdempotencyKey: input.idempotencyKey,
      },
    });

    const payment = await this.provider.createAchPayment({
      accountId: walletId,
      counterpartyId: counterparty.unitCounterpartyId,
      amountMinor: input.amountMinor,
      direction: 'Debit',
      description: 'Recaudo',
      idempotencyKey: input.idempotencyKey,
      tags: {
        ...intent.tags,
        tecnowalletIntentId: intent._id.toString(),
      },
      verifyCounterpartyBalance: true,
    });

    intent.providerPaymentId = payment.providerPaymentId;
    intent.status = payment.status === 'settled' ? 'settled' : payment.status;
    if (payment.transactionId) {
      intent.providerTransactionId = payment.transactionId;
    }
    await intent.save();

    // Sandbox stub without Unit: settle immediately so local e2e works.
    if (
      !this.config.get<string>('UNIT_API_TOKEN') &&
      intent.status === 'pending'
    ) {
      await this.settleIntent(intent, `sandbox-tx-${intent._id.toString()}`);
    }

    return {
      intent: this.presentIntent(intent),
      balances: await this.balances(input.recaudoId),
      idempotentReplay: false,
    };
  }

  async fundWithdrawal(input: {
    recaudoId: string;
    amountMinor: number;
    note?: string;
    counterpartyId?: string;
    idempotencyKey: string;
    principal: AuthLike;
  }) {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new BadRequestException('amountMinor must be a positive integer');
    }
    const context = await this.recaudos.getFundingContext(
      input.recaudoId,
      input.principal.userId,
      { requireOrganizer: true },
    );
    if (context.recaudo.status !== 'open') {
      throw new ConflictException('Recaudo is closed');
    }
    const current = await this.balances(input.recaudoId);
    if (input.amountMinor > current.availableMinor) {
      throw new BadRequestException(
        'amountMinor cannot exceed available (settled) pool',
      );
    }

    const replay = await this.intents.findOne({
      recaudoId: input.recaudoId,
      userId: input.principal.userId,
      idempotencyKey: input.idempotencyKey,
    });
    if (replay) {
      if (replay.amountMinor !== input.amountMinor) {
        throw new ConflictException(
          'Idempotency key was already used with different input',
        );
      }
      return {
        intent: this.presentIntent(replay),
        balances: await this.balances(input.recaudoId),
        idempotentReplay: true,
      };
    }

    await this.customers.requireApprovedCustomerId(input.principal.userId);
    const walletId = await this.accounts.requireOpenWalletId(
      context.recaudo.workspaceId.toString(),
    );
    const counterparty = await this.counterparties.getActive(
      input.principal.userId,
      input.counterpartyId,
    );
    if (!counterparty) {
      throw new BadRequestException(
        'Link an external bank account before withdrawing',
      );
    }

    const intent = await this.intents.create({
      workspaceId: context.recaudo.workspaceId,
      recaudoId: context.recaudo._id,
      participantId: context.participant._id,
      userId: input.principal.userId,
      amountMinor: input.amountMinor,
      currency: context.recaudo.currency,
      direction: 'outbound',
      method: 'ach_credit',
      fundingSource: 'unit_ach',
      status: 'created',
      idempotencyKey: input.idempotencyKey,
      provider: 'unit',
      note: input.note,
      tags: {
        tecnowalletRecaudoId: input.recaudoId,
        tecnowalletParticipantId: context.participant._id.toString(),
        tecnowalletUserId: input.principal.userId,
        tecnowalletIdempotencyKey: input.idempotencyKey,
      },
    });

    const payment = await this.provider.createAchPayment({
      accountId: walletId,
      counterpartyId: counterparty.unitCounterpartyId,
      amountMinor: input.amountMinor,
      direction: 'Credit',
      description: 'Retiro',
      idempotencyKey: input.idempotencyKey,
      tags: {
        ...intent.tags,
        tecnowalletIntentId: intent._id.toString(),
      },
    });

    intent.providerPaymentId = payment.providerPaymentId;
    intent.status = payment.status === 'settled' ? 'settled' : payment.status;
    await intent.save();

    if (
      !this.config.get<string>('UNIT_API_TOKEN') &&
      intent.status === 'pending'
    ) {
      await this.settleIntent(intent, `sandbox-tx-${intent._id.toString()}`);
    }

    return {
      intent: this.presentIntent(intent),
      balances: await this.balances(input.recaudoId),
      idempotentReplay: false,
    };
  }

  async syncSchedule(input: {
    recaudoId: string;
    principal: AuthLike;
  }) {
    const context = await this.recaudos.getFundingContext(
      input.recaudoId,
      input.principal.userId,
    );
    const plan = context.participant.plan;
    if (!plan?.amountMinor || !plan.frequency) {
      throw new BadRequestException(
        'Configure your contribution plan in Recaudos before syncing schedules',
      );
    }

    const counterparty = await this.counterparties.getActive(
      input.principal.userId,
    );
    if (!counterparty) {
      throw new BadRequestException('Link a bank counterparty first');
    }
    const walletId = await this.accounts.requireOpenWalletId(
      context.recaudo.workspaceId.toString(),
    );

    const frequency = plan.frequency;
    const useNative = frequency === 'weekly' || frequency === 'monthly';
    let providerRecurringId: string | undefined;
    let nextRunAt: Date | undefined;

    if (useNative) {
      const recurring = await this.provider.createRecurringAchDebit({
        accountId: walletId,
        counterpartyId: counterparty.unitCounterpartyId,
        amountMinor: plan.amountMinor,
        description: 'Recaudo',
        interval: frequency === 'weekly' ? 'Weekly' : 'Monthly',
        dayOfMonth: frequency === 'monthly' ? new Date().getDate() : undefined,
        tags: {
          tecnowalletRecaudoId: input.recaudoId,
          tecnowalletParticipantId: context.participant._id.toString(),
          tecnowalletUserId: input.principal.userId,
        },
      });
      providerRecurringId = recurring.providerRecurringId;
      if (recurring.nextScheduledAction) {
        nextRunAt = new Date(recurring.nextScheduledAction);
      }
    } else {
      nextRunAt = nextRunForLocal(frequency);
    }

    const schedule = await this.schedules.findOneAndUpdate(
      {
        recaudoId: input.recaudoId,
        participantId: context.participant._id,
      },
      {
        $set: {
          workspaceId: context.recaudo.workspaceId,
          userId: input.principal.userId,
          amountMinor: plan.amountMinor,
          frequency,
          driver: useNative ? 'unit_native' : 'local_scheduler',
          enabled: true,
          providerRecurringId,
          nextRunAt,
        },
      },
      { upsert: true, new: true },
    );

    return {
      scheduleId: schedule._id.toString(),
      frequency: schedule.frequency,
      driver: schedule.driver,
      enabled: schedule.enabled,
      providerRecurringId: schedule.providerRecurringId,
      nextRunAt: schedule.nextRunAt?.toISOString(),
      amountMinor: schedule.amountMinor,
    };
  }

  async runDueLocalSchedules(now = new Date()) {
    const due = await this.schedules.find({
      enabled: true,
      driver: 'local_scheduler',
      nextRunAt: { $lte: now },
    });
    let ran = 0;
    for (const schedule of due) {
      try {
        const key = `sched-${schedule._id.toString()}-${now
          .toISOString()
          .slice(0, 10)}`;
        await this.fundContribution({
          recaudoId: schedule.recaudoId.toString(),
          amountMinor: schedule.amountMinor,
          idempotencyKey: key,
          principal: {
            userId: schedule.userId.toString(),
            email: '',
          },
        });
        schedule.lastRunAt = now;
        schedule.nextRunAt = nextRunForLocal(schedule.frequency, now);
        await schedule.save();
        ran += 1;
      } catch (error) {
        this.logger.warn(
          `Local schedule ${schedule._id.toString()} failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
    return { ran, due: due.length };
  }

  verifyUnitSignature(rawBody: Buffer, signatureHeader: string | undefined) {
    const secret = this.config.get<string>('UNIT_WEBHOOK_SECRET');
    if (!secret) {
      // Allow unsigned in local/test when secret unset; reject in production.
      if (this.config.get('NODE_ENV') === 'production') {
        throw new BadRequestException('UNIT_WEBHOOK_SECRET is required');
      }
      return true;
    }
    if (!signatureHeader) {
      throw new BadRequestException('Missing X-Unit-Signature');
    }
    const expected = createHmac('sha1', secret)
      .update(rawBody)
      .digest('base64');
    if (expected !== signatureHeader) {
      throw new BadRequestException('Invalid Unit webhook signature');
    }
    return true;
  }

  async handleUnitWebhook(payload: unknown) {
    const events = normalizeWebhookEvents(payload);
    const results: Array<{ eventId: string; processed: boolean }> = [];
    for (const event of events) {
      results.push(await this.processUnitEvent(event));
    }
    return { results };
  }

  async reconcileRecaudo(recaudoId: string) {
    const balances = await this.balances(recaudoId);
    const intents = await this.intents
      .find({ recaudoId, fundingSource: 'unit_ach' })
      .sort({ createdAt: -1 })
      .limit(100);
    const dangling = intents.filter(
      (intent) =>
        ['sent', 'clearing', 'processing'].includes(intent.status) &&
        intent.providerPaymentId,
    );
    for (const intent of dangling) {
      try {
        const payment = await this.provider.getPayment(
          intent.providerPaymentId!,
        );
        await this.applyProviderStatus(intent, payment.status, {
          transactionId: payment.transactionId,
        });
      } catch (error) {
        this.logger.warn(
          `Reconcile failed for intent ${intent._id.toString()}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
    return {
      balances: await this.balances(recaudoId),
      checked: dangling.length,
      previous: balances,
    };
  }

  private async processUnitEvent(event: {
    id: string;
    type: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  }) {
    const existing = await this.webhookEvents.findOne({
      provider: 'unit',
      eventId: event.id,
    });
    if (existing?.processed) {
      return { eventId: event.id, processed: false };
    }

    const record =
      existing ??
      (await this.webhookEvents.create({
        provider: 'unit',
        eventId: event.id,
        eventType: event.type,
        payload: event as unknown as Record<string, unknown>,
        processed: false,
      }));

    try {
      await this.dispatchUnitEvent(event);
      record.processed = true;
      record.processedAt = new Date();
      record.processingError = undefined;
      await record.save();
      return { eventId: event.id, processed: true };
    } catch (error) {
      record.processingError =
        error instanceof Error ? error.message : 'unknown';
      await record.save();
      throw error;
    }
  }

  private async dispatchUnitEvent(event: {
    id: string;
    type: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  }) {
    const type = event.type;
    if (type.startsWith('customer.') || type.startsWith('application.')) {
      const applicationId = relId(event.relationships, 'application');
      const customerId =
        relId(event.relationships, 'customer') ??
        (type === 'customer.created' ? relId(event.relationships, 'customer') : undefined);
      if (applicationId && customerId) {
        await this.customers.markCustomerCreated(applicationId, customerId);
      }
      return;
    }

    if (type.startsWith('account.') || type.includes('wallet')) {
      const accountId = relId(event.relationships, 'account');
      if (accountId && type.includes('opened')) {
        await this.accounts.markWalletOpen(accountId);
      }
      return;
    }

    if (type.startsWith('payment.') || type.includes('Payment')) {
      const paymentId =
        relId(event.relationships, 'payment') ??
        (event.attributes?.id as string | undefined);
      const statusRaw = String(event.attributes?.status ?? '');
      const intent = paymentId
        ? await this.intents.findOne({ providerPaymentId: paymentId })
        : null;
      if (!intent) return;
      const mapped = statusRaw
        ? mapUnitPaymentStatus(statusRaw)
        : mapEventTypeToStatus(type);
      await this.applyProviderStatus(intent, mapped);
      return;
    }

    if (type === 'transaction.created') {
      const paymentId = relId(event.relationships, 'payment');
      const transactionId =
        relId(event.relationships, 'transaction') ??
        (event.attributes?.id as string | undefined) ??
        event.id;
      if (!paymentId) return;
      const intent = await this.intents.findOne({
        providerPaymentId: paymentId,
      });
      if (!intent) return;
      await this.settleIntent(intent, transactionId);
    }
  }

  private async applyProviderStatus(
    intent: HydratedDocument<PaymentIntent>,
    status: PaymentIntentStatus | ReturnType<typeof mapUnitPaymentStatus>,
    extra?: { transactionId?: string },
  ) {
    if (intent.status === 'settled') return intent;
    if (status === 'sent' || status === 'clearing' || status === 'processing') {
      intent.status = status;
      await intent.save();
      return intent;
    }
    if (
      status === 'failed' ||
      status === 'returned' ||
      status === 'canceled' ||
      status === 'rejected'
    ) {
      intent.status = status;
      await intent.save();
      return intent;
    }
    if (status === 'settled' || extra?.transactionId) {
      return this.settleIntent(
        intent,
        extra?.transactionId ?? intent.providerTransactionId,
      );
    }
    intent.status = status as PaymentIntentStatus;
    await intent.save();
    return intent;
  }

  private async settleIntent(
    intent: HydratedDocument<PaymentIntent>,
    transactionId?: string,
  ) {
    if (intent.status === 'settled' && intent.contributionId) {
      return intent;
    }
    if (transactionId) {
      intent.providerTransactionId = transactionId;
    }

    if (intent.direction === 'inbound') {
      const result = await this.recaudos.createSettledContributionFromIntent({
        recaudoId: intent.recaudoId.toString(),
        userId: intent.userId.toString(),
        participantId: intent.participantId.toString(),
        amountMinor: intent.amountMinor,
        note: intent.note,
        idempotencyKey: `unit-${intent.idempotencyKey}`,
      });
      intent.contributionId = new Types.ObjectId(
        String(
          (result.contribution as { _id?: Types.ObjectId })._id ??
            (result.contribution as { id?: string }).id,
        ),
      );
      await this.allocations.create({
        workspaceId: intent.workspaceId,
        recaudoId: intent.recaudoId,
        paymentIntentId: intent._id,
        amountMinor: intent.amountMinor,
        entry: 'credit',
        currency: intent.currency,
        providerTransactionId: intent.providerTransactionId,
      });
    } else {
      const result = await this.recaudos.createSettledWithdrawalFromIntent({
        recaudoId: intent.recaudoId.toString(),
        organizerId: intent.userId.toString(),
        amountMinor: intent.amountMinor,
        note: intent.note,
        idempotencyKey: `unit-${intent.idempotencyKey}`,
      });
      intent.withdrawalId = new Types.ObjectId(
        String(
          (result.withdrawal as { _id?: Types.ObjectId })._id ??
            (result.withdrawal as { id?: string }).id,
        ),
      );
      await this.allocations.create({
        workspaceId: intent.workspaceId,
        recaudoId: intent.recaudoId,
        paymentIntentId: intent._id,
        amountMinor: intent.amountMinor,
        entry: 'debit',
        currency: intent.currency,
        providerTransactionId: intent.providerTransactionId,
      });
    }

    intent.status = 'settled';
    await intent.save();
    return intent;
  }

  private presentIntent(intent: PaymentIntent) {
    return {
      id: intent._id.toString(),
      recaudoId: intent.recaudoId.toString(),
      participantId: intent.participantId.toString(),
      userId: intent.userId.toString(),
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      direction: intent.direction,
      method: intent.method,
      fundingSource: intent.fundingSource,
      status: intent.status,
      provider: intent.provider,
      providerPaymentId: intent.providerPaymentId,
      providerTransactionId: intent.providerTransactionId,
      contributionId: intent.contributionId?.toString(),
      withdrawalId: intent.withdrawalId?.toString(),
      note: intent.note,
      createdAt: intent.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: intent.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }
}

function relId(
  relationships: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const rel = relationships?.[key] as
    | { data?: { id?: string } | Array<{ id?: string }> }
    | undefined;
  if (!rel?.data) return undefined;
  if (Array.isArray(rel.data)) return rel.data[0]?.id;
  return rel.data.id;
}

function mapEventTypeToStatus(
  type: string,
): ReturnType<typeof mapUnitPaymentStatus> {
  if (type.includes('returned')) return 'returned';
  if (type.includes('rejected') || type.includes('failed')) return 'failed';
  if (type.includes('canceled') || type.includes('cancelled'))
    return 'canceled';
  if (type.includes('clearing')) return 'clearing';
  if (type.includes('sent')) return 'sent';
  if (type.includes('pending') || type.includes('created')) return 'pending';
  return 'processing';
}

function normalizeWebhookEvents(payload: unknown): Array<{
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}> {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeOne(item));
  }
  if (payload && typeof payload === 'object' && 'data' in payload) {
    const data = (payload as { data: unknown }).data;
    if (Array.isArray(data)) return data.map((item) => normalizeOne(item));
    return [normalizeOne(data)];
  }
  return [normalizeOne(payload)];
}

function normalizeOne(item: unknown): {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
} {
  const value = (item ?? {}) as Record<string, unknown>;
  return {
    id: String(value.id ?? value.eventId ?? ''),
    type: String(value.type ?? value.eventType ?? 'unknown'),
    attributes:
      value.attributes && typeof value.attributes === 'object'
        ? (value.attributes as Record<string, unknown>)
        : value,
    relationships:
      value.relationships && typeof value.relationships === 'object'
        ? (value.relationships as Record<string, unknown>)
        : undefined,
  };
}

function nextRunForLocal(
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly',
  from = new Date(),
) {
  const next = new Date(from);
  if (frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
