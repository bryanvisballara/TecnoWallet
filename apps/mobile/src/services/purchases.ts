import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';

import {
  syncBillingStatus,
  type BillingStatus,
} from './plus-api';
import { usePlusStore } from '@/store/plus';

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
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
  }
}

export async function loadOfferings(): Promise<{
  plus: PurchasesPackage | null;
  business: PurchasesPackage | null;
}> {
  if (Platform.OS !== 'ios' || !IOS_API_KEY || !configuredUserId) {
    return { plus: null, business: null };
  }
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current ?? offerings.all.default;
  const packages = offering?.availablePackages ?? [];
  plusPackage =
    offering?.monthly ??
    packages.find(
      (item) => item.product.identifier === 'tecnowallet_plus_monthly',
    ) ??
    null;
  businessPackage =
    packages.find(
      (item) => item.product.identifier === 'tecnowallet_business_monthly',
    ) ??
    offerings.all.business?.availablePackages.find(
      (item) => item.product.identifier === 'tecnowallet_business_monthly',
    ) ??
    null;
  const store = usePlusStore.getState();
  store.setPriceLabel(plusPackage?.product.priceString ?? null);
  store.setBusinessPriceLabel(businessPackage?.product.priceString ?? null);
  return { plus: plusPackage, business: businessPackage };
}

/** @deprecated Prefer loadOfferings */
export async function loadPlusOffering(): Promise<PurchasesPackage | null> {
  return (await loadOfferings()).plus;
}

async function purchasePackage(
  selected: PurchasesPackage | null,
  missingMessage: string,
): Promise<BillingStatus> {
  assertNativeIos();
  if (!selected) throw new Error(missingMessage);
  try {
    await Purchases.purchasePackage(selected);
    return await syncBillingStatus();
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
  return syncBillingStatus();
}
