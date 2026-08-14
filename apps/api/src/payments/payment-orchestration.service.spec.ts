import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { PaymentProvider } from './payment-provider';
import {
  FinancialAllocation,
  PaymentIntent,
  ProviderWebhookEvent,
  RecurringFundingSchedule,
} from './payments.schemas';
import { UnitAccountService } from '../unit/unit-account.service';
import { UnitCounterpartyService } from '../unit/unit-counterparty.service';
import { UnitCustomerService } from '../unit/unit-customer.service';
import { RecaudosService } from '../recaudos/recaudos.module';
import { Types } from 'mongoose';

describe('PaymentOrchestrationService', () => {
  const recaudoId = new Types.ObjectId();
  const workspaceId = new Types.ObjectId();
  const participantId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  let service: PaymentOrchestrationService;
  let intents: {
    create: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    aggregate: jest.Mock;
  };
  let allocations: { create: jest.Mock; aggregate: jest.Mock };
  let webhookEvents: { findOne: jest.Mock; create: jest.Mock };
  let provider: {
    createAchPayment: jest.Mock;
    getPayment: jest.Mock;
    createRecurringAchDebit: jest.Mock;
  };
  let recaudos: {
    getFundingContext: jest.Mock;
    createSettledContributionFromIntent: jest.Mock;
    createSettledWithdrawalFromIntent: jest.Mock;
    assertDigitalAccountOpen: jest.Mock;
  };

  beforeEach(async () => {
    intents = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    allocations = {
      create: jest.fn(),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    webhookEvents = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (doc) => ({
        ...doc,
        save: jest.fn(),
        processed: false,
      })),
    };
    provider = {
      createAchPayment: jest.fn().mockResolvedValue({
        providerPaymentId: 'pay-1',
        status: 'pending',
        rawType: 'achPayment',
      }),
      getPayment: jest.fn(),
      createRecurringAchDebit: jest.fn(),
    };
    recaudos = {
      getFundingContext: jest.fn().mockResolvedValue({
        recaudo: {
          _id: recaudoId,
          workspaceId,
          organizerId: userId,
          status: 'open',
          currency: 'USD',
          payoutMethod: 'digital',
        },
        participant: { _id: participantId, plan: null },
      }),
      createSettledContributionFromIntent: jest.fn().mockResolvedValue({
        contribution: { _id: new Types.ObjectId() },
      }),
      createSettledWithdrawalFromIntent: jest.fn().mockResolvedValue({
        withdrawal: { _id: new Types.ObjectId() },
      }),
      assertDigitalAccountOpen: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentOrchestrationService,
        { provide: getModelToken(PaymentIntent.name), useValue: intents },
        {
          provide: getModelToken(FinancialAllocation.name),
          useValue: allocations,
        },
        {
          provide: getModelToken(ProviderWebhookEvent.name),
          useValue: webhookEvents,
        },
        {
          provide: getModelToken(RecurringFundingSchedule.name),
          useValue: { find: jest.fn(), findOneAndUpdate: jest.fn() },
        },
        { provide: PaymentProvider, useValue: provider },
        {
          provide: UnitCustomerService,
          useValue: {
            requireApprovedCustomerId: jest.fn().mockResolvedValue('cust-1'),
            markCustomerCreated: jest.fn(),
          },
        },
        {
          provide: UnitAccountService,
          useValue: {
            requireOpenWalletId: jest.fn().mockResolvedValue('wallet-1'),
            ensureRecaudoWallet: jest.fn().mockResolvedValue({
              unitWalletId: 'wallet-1',
            }),
            markWalletOpen: jest.fn(),
          },
        },
        {
          provide: UnitCounterpartyService,
          useValue: {
            getActive: jest.fn().mockResolvedValue({
              unitCounterpartyId: 'cp-1',
            }),
          },
        },
        { provide: RecaudosService, useValue: recaudos },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'UNIT_WEBHOOK_SECRET') return 'test-secret';
              if (key === 'UNIT_API_TOKEN') return 'token';
              if (key === 'NODE_ENV') return 'test';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PaymentOrchestrationService);
  });

  it('creates funded contribution as pending without settling available', async () => {
    const created: Record<string, unknown> = {
      _id: new Types.ObjectId(),
      recaudoId,
      participantId,
      userId,
      amountMinor: 10000,
      currency: 'USD',
      direction: 'inbound',
      method: 'ach_debit',
      fundingSource: 'unit_ach',
      status: 'created',
      idempotencyKey: 'key-1',
      provider: 'unit',
      tags: {},
      save: jest.fn().mockResolvedValue(undefined),
    };
    intents.findOne.mockResolvedValue(null);
    intents.create.mockResolvedValue(created);

    const result = await service.fundContribution({
      recaudoId: recaudoId.toString(),
      amountMinor: 10000,
      idempotencyKey: 'key-1',
      principal: { userId: userId.toString(), email: 'a@b.com' },
    });

    expect(provider.createAchPayment).toHaveBeenCalled();
    expect(result.intent.status).toBe('pending');
    expect(recaudos.createSettledContributionFromIntent).not.toHaveBeenCalled();
    expect(result.balances.availableMinor).toBe(0);
  });

  it('settles contribution on transaction.created webhook once', async () => {
    const intentId = new Types.ObjectId();
    const intent = {
      _id: intentId,
      recaudoId,
      participantId,
      userId,
      workspaceId,
      amountMinor: 5000,
      currency: 'USD',
      direction: 'inbound' as const,
      status: 'pending',
      fundingSource: 'unit_ach',
      idempotencyKey: 'k2',
      providerPaymentId: 'pay-9',
      tags: {},
      save: jest.fn().mockResolvedValue(undefined),
    };
    intents.findOne.mockResolvedValue(intent);
    webhookEvents.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ processed: true });

    const event = {
      id: 'evt-1',
      type: 'transaction.created',
      relationships: {
        payment: { data: { id: 'pay-9' } },
        transaction: { data: { id: 'tx-9' } },
      },
    };

    const first = await service.handleUnitWebhook(event);
    expect(first.results[0].processed).toBe(true);
    expect(recaudos.createSettledContributionFromIntent).toHaveBeenCalled();
    expect(allocations.create).toHaveBeenCalled();

    const second = await service.handleUnitWebhook(event);
    expect(second.results[0].processed).toBe(false);
  });

  it('verifies Unit webhook HMAC signature', () => {
    const body = Buffer.from('{"data":{"id":"1","type":"payment.created"}}');
    const signature = createHmac('sha1', 'test-secret')
      .update(body)
      .digest('base64');
    expect(service.verifyUnitSignature(body, signature)).toBe(true);
    expect(() => service.verifyUnitSignature(body, 'bad')).toThrow();
  });

  it('reports balances separating available and pending', async () => {
    intents.aggregate.mockResolvedValue([
      { _id: 'pending', total: 300 },
      { _id: 'clearing', total: 100 },
    ]);
    allocations.aggregate
      .mockResolvedValueOnce([{ total: 4000 }])
      .mockResolvedValueOnce([{ total: 0 }]);

    const balances = await service.balances(recaudoId.toString());
    expect(balances).toEqual({
      availableMinor: 4000,
      pendingMinor: 300,
      processingMinor: 100,
      failedMinor: 0,
      inFlightMinor: 4400,
    });
  });
});
