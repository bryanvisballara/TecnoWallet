import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  getBillingStatus,
  syncBillingStatus,
  type BillingStatus,
} from './plus-api';
import {
  AFFILIATE_OFFERING_ID,
  BUSINESS_COUPON_PRODUCT_IDS,
  BUSINESS_LIST_PRODUCT_IDS,
  FALLBACK_BUSINESS_COUPON_PRICE_LABEL,
  FALLBACK_BUSINESS_PRICE_LABEL,
  FALLBACK_PLUS_COUPON_PRICE_LABEL,
  FALLBACK_PLUS_PRICE_LABEL,
  PLUS_COUPON_PRODUCT_IDS,
  PLUS_LIST_PRODUCT_IDS,
} from './billing-prices';
import { usePlusStore } from '@/store/plus';

export {
  BUSINESS_PRODUCT_ID,
  FALLBACK_BUSINESS_PRICE_LABEL,
  FALLBACK_PLUS_PRICE_LABEL,
  PLUS_PRODUCT_ID,
} from './billing-prices';

function packageByProductIds(
  packages: PurchasesPackage[],
  ids: readonly string[],
) {
  const byId = new Map(
    packages.map((item) => [item.product.identifier.toLowerCase(), item]),
  );
  for (const id of ids) {
    const found = byId.get(id.toLowerCase());
    if (found) return found;
  }
  return null;
}

const IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
  (Constants.expoConfig?.extra?.revenueCatIosApiKey as string | undefined)?.trim() ||
  '';
let configuredUserId: string | null = null;
let plusPackage: PurchasesPackage | null = null;
let businessPackage: PurchasesPackage | null = null;

function assertNativeIos() {
  if (Platform.OS !== 'ios') {
    throw new Error(
      'La suscripción con Apple está disponible desde la app para iPhone.',
    );
  }
  if (!IOS_API_KEY) {
    throw new Error(
      'RevenueCat no está configurado en este build de TecnoWallet.',
    );
  }
}

function applyFallbackPrices(coupon: boolean) {
  const store = usePlusStore.getState();
  store.setListPriceLabel(FALLBACK_PLUS_PRICE_LABEL);
  store.setListBusinessPriceLabel(FALLBACK_BUSINESS_PRICE_LABEL);
  store.setPriceLabel(
    coupon ? FALLBACK_PLUS_COUPON_PRICE_LABEL : FALLBACK_PLUS_PRICE_LABEL,
  );
  store.setBusinessPriceLabel(
    coupon
      ? FALLBACK_BUSINESS_COUPON_PRICE_LABEL
      : FALLBACK_BUSINESS_PRICE_LABEL,
  );
}

export async function configurePurchases(appUserId: string) {
  if (Platform.OS !== 'ios' || !IOS_API_KEY || !appUserId) return;
  if (!configuredUserId) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: IOS_API_KEY, appUserID: appUserId });
    configuredUserId = appUserId;
  } else if (configuredUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    configuredUserId = appUserId;
  }
  await loadOfferings();
}

export async function resetPurchases() {
  if (Platform.OS !== 'ios' || !configuredUserId) return;
  try {
    await Purchases.logOut();
  } finally {
    configuredUserId = null;
    plusPackage = null;
    businessPackage = null;
    applyFallbackPrices(false);
  }
}

let offeringsInFlight: Promise<{
  plus: PurchasesPackage | null;
  business: PurchasesPackage | null;
}> | null = null;

export async function loadOfferings(): Promise<{
  plus: PurchasesPackage | null;
  business: PurchasesPackage | null;
}> {
  if (offeringsInFlight) return offeringsInFlight;
  offeringsInFlight = loadOfferingsNow().finally(() => {
    offeringsInFlight = null;
  });
  return offeringsInFlight;
}

async function loadOfferingsNow(): Promise<{
  plus: PurchasesPackage | null;
  business: PurchasesPackage | null;
}> {
  const coupon = Boolean(usePlusStore.getState().couponCode);
  if (Platform.OS !== 'ios' || !IOS_API_KEY || !configuredUserId) {
    applyFallbackPrices(coupon);
    return { plus: null, business: null };
  }
  const offerings = await Purchases.getOfferings();
  const current = offerings.current ?? offerings.all.default;
  const affiliate = offerings.all[AFFILIATE_OFFERING_ID];
  const allPackages = [
    ...(current?.availablePackages ?? []),
    ...(affiliate?.availablePackages ?? []),
    ...Object.values(offerings.all).flatMap((item) => item.availablePackages),
  ];
  const listPlus = packageByProductIds(allPackages, PLUS_LIST_PRODUCT_IDS);
  const listBusiness = packageByProductIds(
    allPackages,
    BUSINESS_LIST_PRODUCT_IDS,
  );
  const couponPlus = packageByProductIds(
    [...(affiliate?.availablePackages ?? []), ...allPackages],
    PLUS_COUPON_PRODUCT_IDS,
  );
  const couponBusiness = packageByProductIds(
    [...(affiliate?.availablePackages ?? []), ...allPackages],
    BUSINESS_COUPON_PRODUCT_IDS,
  );
  plusPackage = coupon ? (couponPlus ?? listPlus) : listPlus;
  businessPackage = coupon
    ? (couponBusiness ?? listBusiness)
    : listBusiness;
  const store = usePlusStore.getState();
  store.setListPriceLabel(
    listPlus?.product.priceString ?? FALLBACK_PLUS_PRICE_LABEL,
  );
  store.setListBusinessPriceLabel(
    listBusiness?.product.priceString ?? FALLBACK_BUSINESS_PRICE_LABEL,
  );
  store.setPriceLabel(
    plusPackage?.product.priceString ??
      (coupon ? FALLBACK_PLUS_COUPON_PRICE_LABEL : FALLBACK_PLUS_PRICE_LABEL),
  );
  store.setBusinessPriceLabel(
    businessPackage?.product.priceString ??
      (coupon
        ? FALLBACK_BUSINESS_COUPON_PRICE_LABEL
        : FALLBACK_BUSINESS_PRICE_LABEL),
  );
  return { plus: plusPackage, business: businessPackage };
}

/** @deprecated Prefer loadOfferings */
export async function loadPlusOffering(): Promise<PurchasesPackage | null> {
  return (await loadOfferings()).plus;
}

async function billingAfterPurchase(): Promise<BillingStatus> {
  try {
    return await syncBillingStatus();
  } catch {
    try {
      return await getBillingStatus();
    } catch {
      return {
        access: 'plus',
        isPlus: true,
        status: 'active',
      };
    }
  }
}

async function purchasePackage(
  selected: PurchasesPackage | null,
  missingMessage: string,
): Promise<BillingStatus> {
  assertNativeIos();
  if (!selected) throw new Error(missingMessage);
  try {
    await Purchases.purchasePackage(selected);
    return await billingAfterPurchase();
  } catch (error) {
    const value = error as { code?: string; userCancelled?: boolean };
    if (
      value.userCancelled ||
      value.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      throw new Error('Compra cancelada.');
    }
    throw error;
  }
}

export async function purchasePlus(): Promise<BillingStatus> {
  const selected = plusPackage ?? (await loadOfferings()).plus;
  return purchasePackage(
    selected,
    'TecnoWallet+ todavía no está disponible en App Store para esta región.',
  );
}

export async function purchaseBusiness(): Promise<BillingStatus> {
  const selected = businessPackage ?? (await loadOfferings()).business;
  return purchasePackage(
    selected,
    'TecnoWallet Business todavía no está disponible en App Store para esta región.',
  );
}

export async function restorePlusPurchases(): Promise<BillingStatus> {
  assertNativeIos();
  await Purchases.restorePurchases();
  return await billingAfterPurchase();
}
