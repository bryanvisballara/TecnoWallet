export const DIGITAL_CURRENCY = 'USDC';
/** Stored on the API as ISO USD; shown in recaudo UI as USDc. */
export const DIGITAL_CURRENCY_STORED = 'USD';
export const DIGITAL_CURRENCY_DISPLAY = 'USDc';
export const DIGITAL_CURRENCY_ALIASES = ['USDC', 'USD'] as const;

export function isDigitalCurrency(code: string) {
  return DIGITAL_CURRENCY_ALIASES.includes(
    code.trim().toUpperCase() as (typeof DIGITAL_CURRENCY_ALIASES)[number],
  );
}

export function recaudoDisplayCurrency(code: string) {
  return isDigitalCurrency(code) ? DIGITAL_CURRENCY_DISPLAY : code;
}

export function recaudoIntlCurrency(code: string) {
  return isDigitalCurrency(code) ? DIGITAL_CURRENCY_STORED : code;
}

export const DIGITAL_MONTHLY_FEE_MINOR = 299;
export const DIGITAL_KYC_FEE_MINOR = 299;
export const DIGITAL_WITHDRAW_BPS = 200;
export const DIGITAL_MIN_TARGET_MINOR = 25_000;
export const DIGITAL_KYC_ABSORB_TARGET_MINOR = 100_000;
export const DIGITAL_INACTIVE_DAYS = 30;

export type DigitalPricing = {
  currency: string;
  monthlyFeeMinor: number;
  kycFeeMinor: number;
  withdrawBps: number;
  minTargetMinor: number;
  kycAbsorbTargetMinor: number;
  inactiveDays: number;
  businessIncludedPerMonth?: number;
};

export type DigitalQuote = {
  spreadMinor: number;
  monthlyDueMinor: number;
  kycDueMinor: number;
  digitalFeesMinor: number;
  netPayoutMinor: number;
};

export function withdrawSpreadMinor(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 0;
  return Math.round((amountMinor * DIGITAL_WITHDRAW_BPS) / 10_000);
}

export function quoteDigitalPayout(
  amountMinor: number,
  due?: Pick<DigitalQuote, 'monthlyDueMinor' | 'kycDueMinor'> | null,
): DigitalQuote {
  const spreadMinor = withdrawSpreadMinor(amountMinor);
  const monthlyDueMinor = due?.monthlyDueMinor ?? 0;
  const kycDueMinor = due?.kycDueMinor ?? 0;
  const digitalFeesMinor = monthlyDueMinor + kycDueMinor;
  return {
    spreadMinor,
    monthlyDueMinor,
    kycDueMinor,
    digitalFeesMinor,
    netPayoutMinor: amountMinor - spreadMinor - digitalFeesMinor,
  };
}
