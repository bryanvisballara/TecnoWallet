import type { PurchasesStoreProduct } from 'react-native-purchases';

import {
  billingMarketSnapshot,
  normalizeCountryCode,
  type BillingMarketSnapshot,
} from '@tecnowallet/config';

/** App Store storefront → ISO 4217 we expect on StoreKit products. */
export function expectedCurrencyForStorefront(
  storefrontCountry: string | null | undefined,
): string | null {
  const country = normalizeCountryCode(storefrontCountry);
  if (country === 'CO') return 'COP';
  if (country === 'US') return 'USD';
  return null;
}

/** Colombia pricing rules when RC storefront is wrong (often US) but Apple charges COP. */
export function prefersColombiaAppStorePricing(
  storefrontCountry: string | null | undefined,
  deviceCountry: string | null | undefined,
  billingMarket: BillingMarketSnapshot | null | undefined,
): boolean {
  if (normalizeCountryCode(storefrontCountry) === 'CO') return true;
  if (normalizeCountryCode(deviceCountry) === 'CO') return true;
  if (billingMarket?.marketId === 'CO') return true;
  return false;
}

function localeForStorefront(
  storefrontCountry: string | null | undefined,
  currency: string,
): string | undefined {
  const country = normalizeCountryCode(storefrontCountry);
  if (country === 'CO' || currency === 'COP') return 'es-CO';
  if (country === 'US' || currency === 'USD') return 'en-US';
  return undefined;
}

function fractionDigitsForCurrency(currency: string): number {
  return currency === 'COP' || currency === 'CLP' || currency === 'JPY' ? 0 : 2;
}

export function storeProductLooksLikeUsdTier(
  product: PurchasesStoreProduct | null | undefined,
  formattedPrice: string | null | undefined,
): boolean {
  if (!product) return false;
  const currency = product.currencyCode?.trim().toUpperCase();
  if (currency === 'COP') return false;
  if (currency === 'USD') return true;
  const label = formattedPrice?.trim() ?? product.priceString?.trim() ?? '';
  return /US\$|\bUSD\b|\$\s*9[.,]99/i.test(label);
}

/** RevenueCat `priceString` can stay in US$ while `price` + `currencyCode` match the purchase sheet. */
export function formatAppleStoreProductPrice(
  product: PurchasesStoreProduct | null | undefined,
  storefrontCountry: string | null | undefined,
): string | null {
  if (!product) return null;

  const currency = product.currencyCode?.trim().toUpperCase();
  const amount = product.price;
  if (currency && Number.isFinite(amount) && amount > 0) {
    try {
      const digits = fractionDigitsForCurrency(currency);
      return new Intl.NumberFormat(localeForStorefront(storefrontCountry, currency), {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(amount);
    } catch {
      // fall through
    }
  }

  const monthly = product.pricePerMonthString?.trim();
  if (monthly) return monthly;

  return product.priceString?.trim() || null;
}

export function colombiaPaywallFallbackLabel(plan: 'plus' | 'business'): string {
  const market = billingMarketSnapshot('CO');
  return plan === 'business' ? market.businessListLabel : market.plusListLabel;
}

/** Paywall price: StoreKit when trustworthy; else Colombia ASC reference label. */
export function resolveApplePaywallPriceLabel(
  product: PurchasesStoreProduct | null | undefined,
  plan: 'plus' | 'business',
  options: {
    storefrontCountry: string | null | undefined;
    deviceCountry: string | null | undefined;
    billingMarket: BillingMarketSnapshot | null | undefined;
  },
): string | null {
  const formatted = formatAppleStoreProductPrice(
    product,
    options.storefrontCountry,
  );
  const colombia = prefersColombiaAppStorePricing(
    options.storefrontCountry,
    options.deviceCountry,
    options.billingMarket,
  );
  if (colombia && storeProductLooksLikeUsdTier(product, formatted)) {
    return colombiaPaywallFallbackLabel(plan);
  }
  const storefront = normalizeCountryCode(options.storefrontCountry);
  const device = normalizeCountryCode(options.deviceCountry);
  if (
    storeProductLooksLikeUsdTier(product, formatted) &&
    storefront === 'US' &&
    device === 'CO'
  ) {
    return colombiaPaywallFallbackLabel(plan);
  }
  return formatted;
}

export function pickStoreProductForStorefront(
  fromStoreKit: PurchasesStoreProduct | null | undefined,
  fromOffering: PurchasesStoreProduct | null | undefined,
  storefrontCountry: string | null | undefined,
): PurchasesStoreProduct | null {
  const expected = expectedCurrencyForStorefront(storefrontCountry);
  const candidates = [fromStoreKit, fromOffering].filter(
    Boolean,
  ) as PurchasesStoreProduct[];
  if (!candidates.length) return null;
  if (expected) {
    const match = candidates.find(
      (item) => item.currencyCode?.trim().toUpperCase() === expected,
    );
    if (match) return match;
  }
  return fromStoreKit ?? fromOffering ?? null;
}

export function applePaywallPriceLooksForeign(
  storefrontCountry: string | null | undefined,
  deviceCountry: string | null | undefined,
  billingMarket: BillingMarketSnapshot | null | undefined,
  currencyCode: string | null | undefined,
  formattedPrice: string | null | undefined,
): boolean {
  if (
    !prefersColombiaAppStorePricing(
      storefrontCountry,
      deviceCountry,
      billingMarket,
    )
  ) {
    return false;
  }
  const currency = currencyCode?.trim().toUpperCase();
  if (currency && currency !== 'COP') return true;
  const label = formattedPrice?.trim() ?? '';
  if (!label) return false;
  return /US\$|\bUSD\b|\$\s*9[.,]99/i.test(label);
}
