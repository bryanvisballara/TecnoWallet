/**
 * Provider-agnostic payment abstraction.
 * Unit is the v1 implementation; CardPaymentProvider is reserved for future USA card acquiring.
 */

export type PaymentDirection = 'inbound' | 'outbound';
export type PaymentMethod = 'ach_debit' | 'ach_credit' | 'book' | 'card_future';

export type ProviderPaymentStatus =
  | 'created'
  | 'pending'
  | 'clearing'
  | 'processing'
  | 'sent'
  | 'settled'
  | 'failed'
  | 'returned'
  | 'canceled'
  | 'rejected';

export type CreateAchPaymentInput = {
  accountId: string;
  counterpartyId: string;
  amountMinor: number;
  direction: 'Debit' | 'Credit';
  description: string;
  idempotencyKey: string;
  tags: Record<string, string>;
  verifyCounterpartyBalance?: boolean;
};

export type CreateRecurringAchDebitInput = {
  accountId: string;
  counterpartyId: string;
  amountMinor: number;
  description: string;
  interval: 'Weekly' | 'Monthly';
  dayOfWeek?: string;
  dayOfMonth?: number;
  startTime?: string;
  tags: Record<string, string>;
};

export type ProviderPaymentResult = {
  providerPaymentId: string;
  status: ProviderPaymentStatus;
  rawType: string;
  transactionId?: string;
};

export type ProviderRecurringResult = {
  providerRecurringId: string;
  status: string;
  nextScheduledAction?: string;
};

export abstract class PaymentProvider {
  abstract readonly name: 'unit' | 'card';

  abstract createAchPayment(
    input: CreateAchPaymentInput,
  ): Promise<ProviderPaymentResult>;

  abstract createRecurringAchDebit(
    input: CreateRecurringAchDebitInput,
  ): Promise<ProviderRecurringResult>;

  abstract cancelRecurringPayment(providerRecurringId: string): Promise<void>;

  abstract getPayment(providerPaymentId: string): Promise<ProviderPaymentResult>;
}

/** Future USA card acquiring — not implemented; Unit cards are debit issuance, not merchant acquiring. */
export abstract class CardPaymentProvider {
  abstract readonly name: 'card';

  abstract chargeCard(input: {
    customerId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<ProviderPaymentResult>;
}
