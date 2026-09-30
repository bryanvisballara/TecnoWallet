import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  getBillingStatus,
  syncBillingStatus,
  type BillingStatus,
} from './plus-api';
import { billingMarketSnapshot, normalizeCountryCode } from '@tecnowallet/config';
import {
  guessDeviceCountryCode,
  mergeBillingMarketWithStoreCurrency,
  priceLabelsForMarket,
} from './billing-market';
import {
  AFFILIATE_OFFERING_ID,
  BUSINESS_COUPON_PRODUCT_IDS,
  BUSINESS_LIST_PRODUCT_IDS,
  FALLBACK_BUSINESS_PRICE_LABEL,
  FALLBACK_PLUS_PRICE_LABEL,
  PLUS_COUPON_PRODUCT_IDS,
  PLUS_LIST_PRODUCT_IDS,
} from './billing-prices';
import { usePlusStore } from '@/store/plus';

export { BUSINESS_PRODUCT_ID, PLUS_PRODUCT_ID } from './billing-prices';
export {
  FALLBACK_BUSINESS_PRICE_LABEL,
  FALLBACK_PLUS_PRICE_LABEL,
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

function storeProductByIds(
  products: PurchasesStoreProduct[],
  ids: readonly string[],
) {
  const byId = new Map(
    products.map((item) => [item.identifier.toLowerCase(), item]),
  );
  for (const id of ids) {
    const found = byId.get(id.toLowerCase());
    if (found) return found;
  }
  return null;
}

/** Coupon SKUs. Buying these without a code charges the discounted price in every country. */
const COUPON_PRODUCT_IDS = new Set([
  'tecnowalletplus',
  'tecnowalletplusaffiliate',
  'tecnowalletbusiness',
  'tecnowalletbusinessaffiliate',
]);

function couponIsApplied() {
  const state = usePlusStore.getState();
  return Boolean(state.couponCode) && state.billingMarket?.couponsEnabled !== false;
}

const IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
  (Constants.expoConfig?.extra?.revenueCatIosApiKey as string | undefined)?.trim() ||
  '';
let configuredUserId: string | null = null;
let plusPackage: PurchasesPackage | null = null;
let businessPackage: PurchasesPackage | null = null;
let plusProduct: PurchasesStoreProduct | null = null;
let businessProduct: PurchasesStoreProduct | null = null;

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

function applyRegionalPrices(coupon: boolean) {
  const store = usePlusStore.getState();
  const market = store.billingMarket;
  if (!market) {
    store.setListPriceLabel(FALLBACK_PLUS_PRICE_LABEL);
    store.setListBusinessPriceLabel(FALLBACK_BUSINESS_PRICE_LABEL);
    store.setPriceLabel(FALLBACK_PLUS_PRICE_LABEL);
    store.setBusinessPriceLabel(FALLBACK_BUSINESS_PRICE_LABEL);
    return;
  }
  const effectiveCoupon = coupon && market.couponsEnabled;
  const labels = priceLabelsForMarket(market, effectiveCoupon);
  store.setListPriceLabel(labels.plusList);
  store.setListBusinessPriceLabel(labels.businessList);
  store.setPriceLabel(labels.plusActive);
  store.setBusinessPriceLabel(labels.businessActive);
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
    plusProduct = null;
    businessProduct = null;
    applyRegionalPrices(false);
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
  const storeState = usePlusStore.getState();
  const coupon =
    Boolean(storeState.couponCode) && storeState.billingMarket?.couponsEnabled !== false;
  if (Platform.OS !== 'ios' || !IOS_API_KEY || !configuredUserId) {
    applyRegionalPrices(coupon);
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
  // No coupon: TecnoWallet Standard only. The + price is the coupon product, after Apply.
  plusPackage = coupon ? couponPlus : listPlus;
  businessPackage = coupon ? couponBusiness : listBusiness;
  const storeProducts = await Purchases.getProducts(
    [
      ...PLUS_LIST_PRODUCT_IDS,
      ...BUSINESS_LIST_PRODUCT_IDS,
      ...PLUS_COUPON_PRODUCT_IDS,
      ...BUSINESS_COUPON_PRODUCT_IDS,
    ],
    Purchases.PRODUCT_CATEGORY.SUBSCRIPTION,
  ).catch(() => [] as PurchasesStoreProduct[]);
  // StoreKit product ids win over RevenueCat package metadata (packages can be mis-linked).
  const listPlusProduct =
    storeProductByIds(storeProducts, PLUS_LIST_PRODUCT_IDS) ??
    listPlus?.product;
  const listBusinessProduct =
    storeProductByIds(storeProducts, BUSINESS_LIST_PRODUCT_IDS) ??
    listBusiness?.product;
  const couponPlusProduct =
    couponPlus?.product ??
    storeProductByIds(storeProducts, PLUS_COUPON_PRODUCT_IDS);
  const couponBusinessProduct =
    couponBusiness?.product ??
    storeProductByIds(storeProducts, BUSINESS_COUPON_PRODUCT_IDS);
  plusProduct = coupon ? couponPlusProduct : listPlusProduct;
  businessProduct = coupon ? couponBusinessProduct : listBusinessProduct;
  const store = usePlusStore.getState();
  const storeCurrency =
    listPlusProduct?.currencyCode ??
    listBusinessProduct?.currencyCode;
  const storefrontCountry = await Purchases.getStorefront()
    .then((storefront) => normalizeCountryCode(storefront?.countryCode))
    .catch(() => null);
  const baseMarket = storefrontCountry
    ? billingMarketSnapshot(storefrontCountry)
    : (store.billingMarket ??
      billingMarketSnapshot(guessDeviceCountryCode()) ??
      (await store.refreshBillingMarket()));
  const market = mergeBillingMarketWithStoreCurrency(baseMarket, storeCurrency);
  store.applyBillingMarket(market);
  const labels = priceLabelsForMarket(market, coupon);
  const shown = (fromStore: string | undefined, fallback: string) =>
    fromStore?.trim() || fallback;
  store.setListPriceLabel(shown(listPlusProduct?.priceString, labels.plusList));
  store.setListBusinessPriceLabel(
    shown(listBusinessProduct?.priceString, labels.businessList),
  );
  store.setPriceLabel(shown(plusProduct?.priceString, labels.plusActive));
  store.setBusinessPriceLabel(
    shown(businessProduct?.priceString, labels.businessActive),
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

async function fetchCheckoutProduct(
  listIds: readonly string[],
  couponIds: readonly string[],
  missingMessage: string,
): Promise<PurchasesStoreProduct> {
  assertNativeIos();
  const coupon = couponIsApplied();
  const ids = coupon ? couponIds : listIds;
  const products = await Purchases.getProducts(
    [...ids],
    Purchases.PRODUCT_CATEGORY.SUBSCRIPTION,
  );
  const product = storeProductByIds(products, ids);
  if (!product) throw new Error(missingMessage);
  const id = product.identifier.toLowerCase();
  if (!coupon && COUPON_PRODUCT_IDS.has(id)) {
    throw new Error(
      'Apple devolvió el producto con cupón (TecnoWallet+) sin un código. En RevenueCat, el producto TecnoWalletplusstandard debe estar ligado a la suscripción Standard en App Store Connect, no a TecnoWallet+.',
    );
  }
  return product;
}

async function purchaseSelected(
  product: PurchasesStoreProduct,
): Promise<BillingStatus> {
  assertNativeIos();
  try {
    await Purchases.purchaseStoreProduct(product);
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
  await loadOfferings();
  const product = await fetchCheckoutProduct(
    PLUS_LIST_PRODUCT_IDS,
    PLUS_COUPON_PRODUCT_IDS,
    'TecnoWallet Standard todavía no está disponible en App Store para esta región.',
  );
  return purchaseSelected(product);
}

export async function purchaseBusiness(): Promise<BillingStatus> {
  await loadOfferings();
  const product = await fetchCheckoutProduct(
    BUSINESS_LIST_PRODUCT_IDS,
    BUSINESS_COUPON_PRODUCT_IDS,
    'TecnoWallet Business Standard todavía no está disponible en App Store para esta región.',
  );
  return purchaseSelected(product);
}

export async function restorePlusPurchases(): Promise<BillingStatus> {
  assertNativeIos();
  await Purchases.restorePurchases();
  return await billingAfterPurchase();
}
