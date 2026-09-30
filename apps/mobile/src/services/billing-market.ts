import {
  billingMarketSnapshot,
  normalizeCountryCode,
  resolveBillingMarketByCurrency,
  type BillingMarketSnapshot,
} from '@tecnowallet/config';
import { NativeModules, Platform } from 'react-native';

import { apiRequest } from './api';
import { localStorage } from './persistence';

const CACHE_KEY = 'billing-market';

export type { BillingMarketSnapshot };

function countryFromLocaleTag(tag?: string | null): string | null {
  if (!tag) return null;
  const parts = tag.replace(/_/g, '-').split('-').filter(Boolean);
  // "en" is a language, not a country. Only a region subtag counts.
  if (parts.length < 2) return null;
  const language = parts[0]?.trim().toUpperCase();
  for (let index = parts.length - 1; index >= 1; index -= 1) {
    const region = normalizeCountryCode(parts[index]);
    if (region && region !== language) return region;
  }
  return null;
}

function guessCountryFromTimezone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone === 'America/Bogota') return 'CO';
  } catch {
    // ignore
  }
  return null;
}

/** Device region beats API IP geolocation (Colombian users often resolve as US on Render). */
export function guessDeviceCountryCode(): string | null {
  const fromTimezone = guessCountryFromTimezone();

  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings as
      | { AppleLocale?: string; AppleLanguages?: string[] }
      | undefined;
    const fromApple =
      countryFromLocaleTag(settings?.AppleLocale) ??
      countryFromLocaleTag(settings?.AppleLanguages?.[0]);
    if (fromApple) {
      if (fromTimezone === 'CO' && fromApple === 'US') return 'CO';
      return fromApple;
    }
  }

  try {
    const fromIntl = countryFromLocaleTag(
      Intl.DateTimeFormat().resolvedOptions().locale,
    );
    if (fromIntl) {
      // English UI in Colombia often resolves as en-US; timezone is more reliable.
      if (fromTimezone === 'CO' && fromIntl === 'US') return 'CO';
      return fromIntl;
    }
  } catch {
    // ignore
  }

  return fromTimezone;
}

function resolveBillingMarketSnapshot(countryCode?: string | null) {
  return billingMarketSnapshot(
    normalizeCountryCode(countryCode) ?? guessDeviceCountryCode(),
  );
}

export async function fetchBillingMarket() {
  return apiRequest<BillingMarketSnapshot>('/billing/market');
}

async function readAppStoreCountry(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const storefront = await Purchases.getStorefront();
    return normalizeCountryCode(storefront?.countryCode);
  } catch {
    return null;
  }
}

export async function loadBillingMarket() {
  const storefrontCountry = await readAppStoreCountry();
  const deviceCountry = guessDeviceCountryCode();
  try {
    const remote = await fetchBillingMarket();
    const country =
      deviceCountry ??
      storefrontCountry ??
      remote.countryCode ??
      guessCountryFromTimezone();
    const resolved = billingMarketSnapshot(country);
    await localStorage.set(CACHE_KEY, resolved);
    return resolved;
  } catch {
    const cached = await localStorage.get<BillingMarketSnapshot | null>(
      CACHE_KEY,
      null,
    );
    if (cached && deviceCountry && cached.marketId !== billingMarketSnapshot(deviceCountry).marketId) {
      const resolved = billingMarketSnapshot(deviceCountry);
      await localStorage.set(CACHE_KEY, resolved);
      return resolved;
    }
    if (cached) return cached;
    return resolveBillingMarketSnapshot(null);
  }
}

/**
 * The App Store storefront is what Apple charges.
 * A COP product must not stay on the US $12.99 label just because the phone is in English.
 * A USD price must not replace Colombia once that market is known.
 */
export function mergeBillingMarketWithStoreCurrency(
  market: BillingMarketSnapshot,
  currencyCode?: string | null,
): BillingMarketSnapshot {
  const fromStore = resolveBillingMarketByCurrency(currencyCode);
  if (!fromStore) return market;
  if (fromStore.id === market.marketId) return market;
  if (fromStore.id === 'CO') {
    return billingMarketSnapshot(fromStore.countries[0] ?? 'CO');
  }
  if (market.marketId === 'CO' && fromStore.id === 'US') return market;
  if (!market.countryCode) {
    return billingMarketSnapshot(fromStore.countries[0] ?? null);
  }
  return market;
}

/**
 * App Store Connect price for this storefront.
 * `priceString` is already localized by Apple (currency and amount).
 * The regional label is only a stand-in until StoreKit returns a product.
 */
export function storefrontPriceLabel(
  priceString: string | undefined | null,
  _currencyCode: string | undefined | null,
  _market: BillingMarketSnapshot,
  fallback: string,
) {
  const label = priceString?.trim();
  if (label) return label;
  return fallback;
}

export function priceLabelsForMarket(
  market: BillingMarketSnapshot,
  coupon: boolean,
) {
  return {
    plusList: market.plusListLabel,
    businessList: market.businessListLabel,
    plusActive:
      coupon && market.plusCouponLabel
        ? market.plusCouponLabel
        : market.plusListLabel,
    businessActive:
      coupon && market.businessCouponLabel
        ? market.businessCouponLabel
        : market.businessListLabel,
  };
}
