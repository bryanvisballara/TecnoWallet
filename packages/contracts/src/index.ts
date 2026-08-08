export type CurrencyCode = string;

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface VersionedEntity {
  id: string;
  workspaceId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Account extends VersionedEntity {
  name: string;
  type:
    | 'cash'
    | 'bank'
    | 'debit_card'
    | 'credit_card'
    | 'wallet'
    | 'crypto'
    | 'investment'
    | 'loan'
    | 'asset';
  currency: CurrencyCode;
  color: string;
  institution?: string;
  lastFour?: string;
  creditLimitMinor?: number;
  statementDay?: number;
  paymentDay?: number;
  archived: boolean;
}

export interface Envelope extends VersionedEntity {
  name: string;
  icon: string;
  color: string;
  budgetMinor: number;
  availableMinor: number;
  spentMinor: number;
  currency: CurrencyCode;
  rollover: 'accumulate' | 'reset' | 'move_to_savings';
  resetDay: number;
  goalMinor?: number;
}

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'refund'
  | 'envelope_transfer';

export interface FinancialTransaction extends VersionedEntity {
  type: TransactionType;
  amountMinor: number;
  currency: CurrencyCode;
  description: string;
  categoryId?: string;
  envelopeId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  occurredAt: string;
  location?: { latitude: number; longitude: number; label?: string };
  notes?: string;
  tags: string[];
  attachmentIds: string[];
  receiptId?: string;
  status: 'pending' | 'cleared' | 'cancelled';
  private: boolean;
}

export interface DashboardSummary {
  netWorth: Money;
  incomeThisMonth: Money;
  expensesThisMonth: Money;
  remainingThisMonth: Money;
  savingsThisMonth: Money;
  dailyAvailable: Money;
  previousMonthDeltaPercent: number;
  budgetUsedPercent: number;
}

export interface Goal extends VersionedEntity {
  name: string;
  targetMinor: number;
  savedMinor: number;
  currency: CurrencyCode;
  targetDate?: string;
  automaticContributionMinor?: number;
}

export interface Bill extends VersionedEntity {
  name: string;
  amountMinor: number;
  currency: CurrencyCode;
  frequency: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDueAt: string;
  autoPay: boolean;
  status: 'upcoming' | 'paid' | 'overdue' | 'paused';
}

export interface Insight {
  id: string;
  kind: 'habit' | 'forecast' | 'saving' | 'warning';
  title: string;
  message: string;
  confidence: number;
  generatedAt: string;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, string[]>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface SyncMutation {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  baseVersion?: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SyncBatch {
  cursor?: string;
  mutations: SyncMutation[];
}

export interface SyncResult {
  cursor: string;
  accepted: string[];
  conflicts: Array<{
    mutationId: string;
    serverVersion: number;
    serverValue: Record<string, unknown>;
  }>;
  changes: Array<{
    entity: string;
    operation: 'upsert' | 'delete';
    version: number;
    value: Record<string, unknown>;
  }>;
}
