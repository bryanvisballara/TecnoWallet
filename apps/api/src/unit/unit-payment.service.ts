import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  type CreateAchPaymentInput,
  type CreateRecurringAchDebitInput,
  type ProviderPaymentResult,
  type ProviderPaymentStatus,
  type ProviderRecurringResult,
} from '../payments/payment-provider';
import { UnitClient } from './unit-client';

@Injectable()
export class UnitPaymentService {
  constructor(private readonly unit: UnitClient) {}

  async createAchPayment(
    input: CreateAchPaymentInput,
  ): Promise<ProviderPaymentResult> {
    if (!this.unit.configured) {
      return {
        providerPaymentId: `sandbox-pay-${input.idempotencyKey}`,
        status: 'pending',
        rawType: 'achPayment',
      };
    }
    const doc = await this.unit.post(
      '/payments',
      {
        data: {
          type: 'achPayment',
          attributes: {
            amount: input.amountMinor,
            direction: input.direction,
            description: input.description.slice(0, 10),
            verifyCounterpartyBalance: input.verifyCounterpartyBalance ?? true,
            tags: input.tags,
          },
          relationships: {
            account: {
              data: { type: 'account', id: input.accountId },
            },
            counterparty: {
              data: { type: 'counterparty', id: input.counterpartyId },
            },
          },
        },
      },
      input.idempotencyKey,
    );
    const resource = this.unit.single(doc);
    return mapPayment(resource.id, resource.type, resource.attributes ?? {});
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentResult> {
    if (!this.unit.configured) {
      return {
        providerPaymentId,
        status: 'settled',
        rawType: 'achPayment',
        transactionId: `sandbox-tx-${providerPaymentId}`,
      };
    }
    const doc = await this.unit.get(`/payments/${providerPaymentId}`);
    const resource = this.unit.single(doc);
    const txId = (
      resource.relationships as
        | { transaction?: { data?: { id?: string } } }
        | undefined
    )?.transaction?.data?.id;
    return {
      ...mapPayment(resource.id, resource.type, resource.attributes ?? {}),
      transactionId: txId,
    };
  }
}

@Injectable()
export class UnitRecurringPaymentService {
  constructor(private readonly unit: UnitClient) {}

  async createRecurringAchDebit(
    input: CreateRecurringAchDebitInput,
  ): Promise<ProviderRecurringResult> {
    if (!this.unit.configured) {
      return {
        providerRecurringId: `sandbox-recurring-${Date.now()}`,
        status: 'Active',
      };
    }
    const schedule: Record<string, unknown> = {
      interval: input.interval,
    };
    if (input.startTime) schedule.startTime = input.startTime;
    if (input.interval === 'Weekly' && input.dayOfWeek) {
      schedule.dayOfWeek = input.dayOfWeek;
    }
    if (input.interval === 'Monthly' && input.dayOfMonth != null) {
      schedule.dayOfMonth = input.dayOfMonth;
    }
    const doc = await this.unit.post('/recurring-payments', {
      data: {
        type: 'recurringDebitAchPayment',
        attributes: {
          amount: input.amountMinor,
          description: input.description.slice(0, 10),
          schedule,
          tags: input.tags,
        },
        relationships: {
          account: { data: { type: 'account', id: input.accountId } },
          counterparty: {
            data: { type: 'counterparty', id: input.counterpartyId },
          },
        },
      },
    });
    const resource = this.unit.single(doc);
    const attrs = resource.attributes ?? {};
    const next =
      attrs.schedule && typeof attrs.schedule === 'object'
        ? (attrs.schedule as { nextScheduledAction?: string })
            .nextScheduledAction
        : undefined;
    return {
      providerRecurringId: resource.id,
      status: String(attrs.status ?? 'Active'),
      nextScheduledAction: next,
    };
  }

  async disable(providerRecurringId: string) {
    if (!this.unit.configured) return;
    await this.unit.post(`/recurring-payments/${providerRecurringId}/disable`, {
      data: { type: 'recurringDebitAchPayment', id: providerRecurringId },
    });
  }
}

@Injectable()
export class UnitPaymentProvider extends PaymentProvider {
  readonly name = 'unit' as const;

  constructor(
    private readonly payments: UnitPaymentService,
    private readonly recurring: UnitRecurringPaymentService,
  ) {
    super();
  }

  createAchPayment(input: CreateAchPaymentInput) {
    return this.payments.createAchPayment(input);
  }

  createRecurringAchDebit(input: CreateRecurringAchDebitInput) {
    return this.recurring.createRecurringAchDebit(input);
  }

  async cancelRecurringPayment(providerRecurringId: string) {
    await this.recurring.disable(providerRecurringId);
  }

  getPayment(providerPaymentId: string) {
    return this.payments.getPayment(providerPaymentId);
  }
}

function mapPayment(
  id: string,
  type: string,
  attrs: Record<string, unknown>,
): ProviderPaymentResult {
  return {
    providerPaymentId: id,
    rawType: type,
    status: mapUnitPaymentStatus(String(attrs.status ?? 'Pending')),
  };
}

export function mapUnitPaymentStatus(status: string): ProviderPaymentStatus {
  switch (status) {
    case 'Pending':
    case 'PendingReview':
      return 'pending';
    case 'Clearing':
      return 'clearing';
    case 'Sent':
      return 'sent';
    case 'Rejected':
      return 'rejected';
    case 'Canceled':
      return 'canceled';
    case 'Returned':
      return 'returned';
    default:
      return 'processing';
  }
}
