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
  const parts = tag.replace(/_/g, '-').split('-');
  const region = parts[parts.length - 1]?.trim().toUpperCase();
  return normalizeCountryCode(region);
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
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings as
      | { AppleLocale?: string; AppleLanguages?: string[] }
      | undefined;
    const fromApple =
      countryFromLocaleTag(settings?.AppleLocale) ??
      countryFromLocaleTag(settings?.AppleLanguages?.[0]);
    if (fromApple) return fromApple;
  }

  try {
    const fromIntl = countryFromLocaleTag(
      Intl.DateTimeFormat().resolvedOptions().locale,
    );
    if (fromIntl) return fromIntl;
  } catch {
    // ignore
  }

  return guessCountryFromTimezone();
}

function resolveBillingMarketSnapshot(countryCode?: string | null) {
  return billingMarketSnapshot(
    normalizeCountryCode(countryCode) ?? guessDeviceCountryCode(),
  );
}

export async function fetchBillingMarket() {
  return apiRequest<BillingMarketSnapshot>('/billing/market');
}

export async function loadBillingMarket() {
  const deviceCountry = guessDeviceCountryCode();
  try {
    const remote = await fetchBillingMarket();
    const country = deviceCountry ?? remote.countryCode ?? guessCountryFromTimezone();
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

/** Prefer App Store currency when it matches the resolved market (COP storefront → COP labels). */
export function mergeBillingMarketWithStoreCurrency(
  market: BillingMarketSnapshot,
  currencyCode?: string | null,
): BillingMarketSnapshot {
  const fromStore = resolveBillingMarketByCurrency(currencyCode);
  if (!fromStore) return market;
  if (fromStore.id === market.marketId) return market;
  // USD from RevenueCat must not override Colombia detected on device/API.
  if (market.marketId === 'CO' && fromStore.id === 'US') return market;
  if (!market.countryCode) {
    return billingMarketSnapshot(fromStore.countries[0] ?? null);
  }
  return market;
}

/** Use App Store price only when currency matches the regional market. */
export function storefrontPriceLabel(
  priceString: string | undefined | null,
  currencyCode: string | undefined | null,
  market: BillingMarketSnapshot,
  fallback: string,
) {
  const storeCurrency = currencyCode?.trim().toUpperCase();
  const marketCurrency = market.currency?.trim().toUpperCase();
  if (priceString && storeCurrency && storeCurrency === marketCurrency) {
    return priceString;
  }
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
