import { BadRequestException } from '@nestjs/common';
import {
  assertBalancedTransaction,
  assertValidMoney,
  CreateTransactionDto,
} from './ledger/ledger';

describe('money and immutable ledger rules', () => {
  const balanced: CreateTransactionDto = {
    workspaceId: 'workspace',
    kind: 'transfer',
    occurredAt: new Date().toISOString(),
    description: 'Move money',
    entries: [
      { accountId: 'checking', currency: 'USD', amountMinor: -1250 },
      { accountId: 'savings', currency: 'USD', amountMinor: 1250 },
    ],
  };

  it('accepts safe integer minor units and ISO currency', () => {
    expect(() => assertValidMoney(101, 'USD')).not.toThrow();
  });

  it('rejects floating point money', () => {
    expect(() => assertValidMoney(10.25, 'USD')).toThrow(BadRequestException);
  });

  it('accepts a balanced transaction', () => {
    expect(() => assertBalancedTransaction(balanced)).not.toThrow();
  });

  it('rejects an unbalanced transaction', () => {
    expect(() =>
      assertBalancedTransaction({
        ...balanced,
        entries: [
          ...balanced.entries.slice(0, 1),
          { ...balanced.entries[1], amountMinor: 1200 },
        ],
      }),
    ).toThrow('Entries must balance to zero per currency');
  });

  it('requires envelopes for envelope transfers', () => {
    expect(() =>
      assertBalancedTransaction({
        ...balanced,
        kind: 'envelope_transfer',
      }),
    ).toThrow('Envelope transfers require an envelope on every entry');
  });
});
