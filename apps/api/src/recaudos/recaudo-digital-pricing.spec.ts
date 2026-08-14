import {
  DIGITAL_KYC_FEE_MINOR,
  DIGITAL_MIN_TARGET_MINOR,
  DIGITAL_MONTHLY_FEE_MINOR,
  monthsActive,
  quoteDigitalWithdrawal,
  withdrawSpreadMinor,
} from './recaudo-digital-pricing';

describe('recaudo digital pricing', () => {
  it('charges 2% on withdrawal', () => {
    expect(withdrawSpreadMinor(200_000)).toBe(4_000);
    expect(withdrawSpreadMinor(25_000)).toBe(500);
  });

  it('counts calendar months inclusive', () => {
    expect(
      monthsActive(new Date('2026-01-15T00:00:00Z'), new Date('2026-01-20T00:00:00Z')),
    ).toBe(1);
    expect(
      monthsActive(new Date('2026-01-15T00:00:00Z'), new Date('2026-03-01T00:00:00Z')),
    ).toBe(3);
  });

  it('quotes a typical $2000 digital withdrawal', () => {
    const quote = quoteDigitalWithdrawal({
      amountMinor: 200_000,
      activatedAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-03-15T00:00:00Z'),
      monthlyIncluded: false,
      monthlyBilledMinor: 0,
      participantCount: 4,
      kycBilledMinor: 0,
    });
    expect(quote.spreadMinor).toBe(4_000);
    expect(quote.monthlyDueMinor).toBe(3 * DIGITAL_MONTHLY_FEE_MINOR);
    expect(quote.kycDueMinor).toBe(4 * DIGITAL_KYC_FEE_MINOR);
    expect(quote.netPayoutMinor).toBe(
      200_000 - 4_000 - 3 * DIGITAL_MONTHLY_FEE_MINOR - 4 * DIGITAL_KYC_FEE_MINOR,
    );
  });

  it('always charges the monthly fee, including the first month', () => {
    const quote = quoteDigitalWithdrawal({
      amountMinor: 200_000,
      activatedAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-01-20T00:00:00Z'),
      monthlyIncluded: true,
      monthlyBilledMinor: 0,
      participantCount: 1,
      kycBilledMinor: 0,
    });
    expect(quote.monthlyDueMinor).toBe(DIGITAL_MONTHLY_FEE_MINOR);
    expect(DIGITAL_MIN_TARGET_MINOR).toBe(25_000);
  });

  it('absorbs KYC when the pot is at least US$ 1000', () => {
    const quote = quoteDigitalWithdrawal({
      amountMinor: 100_000,
      monthlyIncluded: false,
      monthlyBilledMinor: 0,
      participantCount: 6,
      kycBilledMinor: 0,
      absorbKyc: true,
    });
    expect(quote.kycDueMinor).toBe(0);
    expect(quote.spreadMinor).toBe(2_000);
  });

  it('rejects a pot that cannot cover fees', () => {
    const quote = quoteDigitalWithdrawal({
      amountMinor: 200,
      monthlyIncluded: false,
      monthlyBilledMinor: 0,
      participantCount: 2,
      kycBilledMinor: 0,
      activatedAt: new Date('2026-01-01T00:00:00Z'),
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(quote.netPayoutMinor).toBeLessThan(0);
  });
});
