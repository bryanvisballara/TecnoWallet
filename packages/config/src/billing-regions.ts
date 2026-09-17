/**
 * Regional subscription display rules and feature flags.
 *
 * Apple/RevenueCat charge whatever tier is set in App Store Connect per
 * storefront. Keep these labels aligned with those tiers.
 */
export type BillingMarketId = 'CO' | 'US' | 'DEFAULT';

export type BillingMarket = {
  id: BillingMarketId;
  /** ISO 3166-1 alpha-2 codes routed to this market. */
  countries: readonly string[];
  currency: string;
  plus: {
    listLabel: string;
    couponLabel?: string;
  };
  business: {
    listLabel: string;
    couponLabel?: string;
  };
  couponsEnabled: boolean;
  affiliateEnabled: boolean;
  trialDays: number;
};

/** Add a row here when opening a new country. */
export const BILLING_MARKETS: readonly BillingMarket[] = [
  {
    id: 'CO',
    countries: ['CO'],
    currency: 'COP',
    plus: { listLabel: '$9.900' },
    business: { listLabel: '$14.900' },
    couponsEnabled: false,
    affiliateEnabled: false,
    trialDays: 3,
  },
  {
    id: 'US',
    countries: ['US'],
    currency: 'USD',
    plus: { listLabel: 'US$12.99', couponLabel: 'US$9.99' },
    business: { listLabel: 'US$17.99', couponLabel: 'US$14.99' },
    couponsEnabled: true,
    affiliateEnabled: true,
    trialDays: 3,
  },
] as const;

export const DEFAULT_BILLING_MARKET_ID: BillingMarketId = 'US';

const DEFAULT_MARKET =
  BILLING_MARKETS.find((market) => market.id === DEFAULT_BILLING_MARKET_ID) ??
  BILLING_MARKETS[1]!;

export function normalizeCountryCode(value?: string | null): string | null {
  const norm = value?.trim().toUpperCase();
  if (!norm || norm.length !== 2 || norm === 'XX' || norm === 'T1') return null;
  return norm;
}

export function resolveBillingMarket(
  countryCode?: string | null,
): BillingMarket {
  const norm = normalizeCountryCode(countryCode);
  if (norm) {
    const match = BILLING_MARKETS.find((market) =>
      market.countries.includes(norm),
    );
    if (match) return match;
  }
  return DEFAULT_MARKET;
}

export function resolveBillingMarketByCurrency(
  currencyCode?: string | null,
): BillingMarket | null {
  const norm = currencyCode?.trim().toUpperCase();
  if (!norm) return null;
  const match = BILLING_MARKETS.find((market) => market.currency === norm);
  return match ?? null;
}

export function billingMarketSnapshot(countryCode?: string | null) {
  const market = resolveBillingMarket(countryCode);
  return {
    marketId: market.id,
    countryCode: normalizeCountryCode(countryCode),
    currency: market.currency,
    plusListLabel: market.plus.listLabel,
    plusCouponLabel: market.plus.couponLabel ?? null,
    businessListLabel: market.business.listLabel,
    businessCouponLabel: market.business.couponLabel ?? null,
    couponsEnabled: market.couponsEnabled,
    affiliateEnabled: market.affiliateEnabled,
    trialDays: market.trialDays,
  };
}

export type BillingMarketSnapshot = ReturnType<typeof billingMarketSnapshot>;
