import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Subscription } from './billing.schemas';
import {
  EntitlementService,
  PaymentRequiredException,
} from './entitlement.service';

describe('EntitlementService', () => {
  let service: EntitlementService;
  let findOne: jest.Mock;
  let enforcementEnabled = 'true';

  beforeEach(async () => {
    enforcementEnabled = 'true';
    findOne = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EntitlementService,
        {
          provide: getModelToken(Subscription.name),
          useValue: { findOne },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback: unknown) => {
              if (key === 'PLUS_ENFORCEMENT_ENABLED') return enforcementEnabled;
              if (key === 'REVENUECAT_ENTITLEMENT_ID') return 'plus';
              if (key === 'REVENUECAT_BUSINESS_ENTITLEMENT_ID') return 'business';
              return fallback;
            }),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(EntitlementService);
  });

  function returnSubscription(value: Record<string, unknown> | null) {
    findOne.mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue(value),
      }),
    });
  }

  it('reports Free when enforcement is off and the user has no subscription', async () => {
    enforcementEnabled = 'false';
    returnSubscription(null);

    await expect(service.isPlus('user-1')).resolves.toBe(false);
    await expect(service.isBusiness('user-1')).resolves.toBe(false);
    await expect(service.collaboratorSeatLimit('user-1')).resolves.toBe(0);
    await expect(service.statusFor('user-1')).resolves.toMatchObject({
      access: 'free',
      enforcementEnabled: false,
      status: 'none',
    });
    await expect(service.assertPlus('user-1')).resolves.toBeUndefined();
    await expect(service.assertBusiness('user-1')).resolves.toBeUndefined();
  });

  it('keeps a cancelled Plus subscription entitled until expiration', async () => {
    returnSubscription({
      status: 'cancelled',
      entitlementId: 'plus',
      expiresAt: new Date(Date.now() + 60_000),
      willRenew: false,
    });

    await expect(service.isPlus('user-1')).resolves.toBe(true);
    await expect(service.collaboratorSeatLimit('user-1')).resolves.toBe(5);
  });

  it('treats Business as Plus with a 10-seat limit', async () => {
    returnSubscription({
      status: 'active',
      entitlementId: 'business',
      expiresAt: new Date(Date.now() + 60_000),
      willRenew: true,
    });

    const status = await service.statusFor('user-1');
    expect(status).toMatchObject({
      access: 'business',
      isPlus: true,
      isBusiness: true,
      seatLimit: 10,
    });
  });

  it('throws a structured 402 when Plus is required', async () => {
    returnSubscription(null);

    let thrown: unknown;
    try {
      await service.assertPlus('user-1', { feature: 'bank-sync' });
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PaymentRequiredException);
    expect((thrown as PaymentRequiredException).getResponse()).toMatchObject({
      statusCode: 402,
      code: 'PLUS_REQUIRED',
      reason: { feature: 'bank-sync' },
    });
  });
});
