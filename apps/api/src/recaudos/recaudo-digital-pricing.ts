/** Bridge-backed digital recaudo rail. Personal (off-platform) stays free. */

export const DIGITAL_CURRENCY = 'USD';
export const DIGITAL_MONTHLY_FEE_MINOR = 299;
export const DIGITAL_KYC_FEE_MINOR = 299;
export const DIGITAL_WITHDRAW_BPS = 200;
export const DIGITAL_MIN_TARGET_MINOR = 25_000;
export const DIGITAL_KYC_ABSORB_TARGET_MINOR = 100_000;
export const DIGITAL_INACTIVE_DAYS = 30;
export const DIGITAL_INCLUDED_PER_MONTH = 1;

export const digitalPricingPublic = {
  currency: DIGITAL_CURRENCY,
  monthlyFeeMinor: DIGITAL_MONTHLY_FEE_MINOR,
  kycFeeMinor: DIGITAL_KYC_FEE_MINOR,
  withdrawBps: DIGITAL_WITHDRAW_BPS,
  minTargetMinor: DIGITAL_MIN_TARGET_MINOR,
  kycAbsorbTargetMinor: DIGITAL_KYC_ABSORB_TARGET_MINOR,
  inactiveDays: DIGITAL_INACTIVE_DAYS,
  businessIncludedPerMonth: DIGITAL_INCLUDED_PER_MONTH,
} as const;

export function monthsActive(from: Date, to: Date): number {
  if (to.getTime() < from.getTime()) return 0;
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    1
  );
}

export function withdrawSpreadMinor(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 0;
  return Math.round((amountMinor * DIGITAL_WITHDRAW_BPS) / 10_000);
}

export function isDigitalInactive(
  lastActivityAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!lastActivityAt) return false;
  const ms = DIGITAL_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - lastActivityAt.getTime() > ms;
}

export function quoteDigitalWithdrawal(input: {
  amountMinor: number;
  activatedAt?: Date | null;
  now?: Date;
  monthlyIncluded: boolean;
  monthlyBilledMinor: number;
  participantCount: number;
  kycBilledMinor: number;
  absorbKyc?: boolean;
}): {
  spreadMinor: number;
  monthlyDueMinor: number;
  kycDueMinor: number;
  digitalFeesMinor: number;
  netPayoutMinor: number;
} {
  const now = input.now ?? new Date();
  const spreadMinor = withdrawSpreadMinor(input.amountMinor);
  let months = input.activatedAt
    ? monthsActive(input.activatedAt, now)
    : 0;
  if (input.monthlyIncluded) months = Math.max(0, months - 1);
  const monthlyDueMinor = Math.max(
    0,
    months * DIGITAL_MONTHLY_FEE_MINOR - (input.monthlyBilledMinor || 0),
  );
  const kycDueMinor = input.absorbKyc
    ? 0
    : Math.max(
        0,
        Math.max(0, input.participantCount) * DIGITAL_KYC_FEE_MINOR -
          (input.kycBilledMinor || 0),
      );
  const digitalFeesMinor = monthlyDueMinor + kycDueMinor;
  const netPayoutMinor =
    input.amountMinor - spreadMinor - digitalFeesMinor;
  return {
    spreadMinor,
    monthlyDueMinor,
    kycDueMinor,
    digitalFeesMinor,
    netPayoutMinor,
  };
}
