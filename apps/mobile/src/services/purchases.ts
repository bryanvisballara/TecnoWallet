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
  storefrontPriceLabel,
} from './billing-market';
import {
  AFFILIATE_OFFERING_ID,
  BUSINESS_PURCHASE_PRODUCT_IDS,
  FALLBACK_BUSINESS_PRICE_LABEL,
  FALLBACK_PLUS_PRICE_LABEL,
  PLUS_PURCHASE_PRODUCT_IDS,
} from './billing-prices';
import {
  formatAppleStoreProductPrice,
  pickStoreProductForStorefront,
  resolveApplePaywallPriceLabel,
} from './apple-store-price';
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

const IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
  (Constants.expoConfig?.extra?.revenueCatIosApiKey as string | undefined)?.trim() ||
  '';
let configuredUserId: string | null = null;
let plusPackage: PurchasesPackage | null = null;
let businessPackage: PurchasesPackage | null = null;
let plusProduct: PurchasesStoreProduct | null = null;
let businessProduct: PurchasesStoreProduct | null = null;

export type ApplePaywallPrices = {
  storefrontCountry: string | null;
  plusPrice: string | null;
  businessPrice: string | null;
  plusCurrency: string | null;
  businessCurrency: string | null;
};

/** StoreKit-only prices for the paywall (no regional USD/COP guess labels). */
export async function fetchApplePaywallPrices(): Promise<ApplePaywallPrices | null> {
  if (Platform.OS !== 'ios' || !IOS_API_KEY || !configuredUserId) {
    return null;
  }
  await loadOfferingsNow().catch(() => undefined);
  const storefrontCountry = await Purchases.getStorefront()
    .then((storefront) => normalizeCountryCode(storefront?.countryCode))
    .catch(() => null);
  const productIds = [
    ...PLUS_PURCHASE_PRODUCT_IDS,
    ...BUSINESS_PURCHASE_PRODUCT_IDS,
  ];
  let storeProducts = await Purchases.getProducts(
    productIds,
    Purchases.PRODUCT_CATEGORY.SUBSCRIPTION,
  ).catch(() => [] as PurchasesStoreProduct[]);
  const firstPlus = storeProductByIds(storeProducts, PLUS_PURCHASE_PRODUCT_IDS);
  if (
    storefrontCountry === 'CO' &&
    firstPlus?.currencyCode?.trim().toUpperCase() === 'USD'
  ) {
    await Purchases.syncPurchases().catch(() => undefined);
    storeProducts = await Purchases.getProducts(
      productIds,
      Purchases.PRODUCT_CATEGORY.SUBSCRIPTION,
    ).catch(() => storeProducts);
  }
  const plusRaw = storeProductByIds(storeProducts, PLUS_PURCHASE_PRODUCT_IDS);
  const businessRaw = storeProductByIds(
    storeProducts,
    BUSINESS_PURCHASE_PRODUCT_IDS,
  );
  const plus = pickStoreProductForStorefront(
    plusRaw,
    plusPackage?.product,
    storefrontCountry,
  );
  const business = pickStoreProductForStorefront(
    businessRaw,
    businessPackage?.product,
    storefrontCountry,
  );
  const deviceCountry = guessDeviceCountryCode();
  const billingMarket = usePlusStore.getState().billingMarket;
  const priceContext = {
    storefrontCountry,
    deviceCountry,
    billingMarket,
  };
  const plusPrice = resolveApplePaywallPriceLabel(plus, 'plus', priceContext);
  const businessPrice = resolveApplePaywallPriceLabel(
    business,
    'business',
    priceContext,
  );
  if (__DEV__) {
    console.warn('[TWPaywall] StoreKit snapshot', {
      storefrontCountry,
      deviceCountry,
      billingMarketId: billingMarket?.marketId ?? null,
      plus: plus
        ? {
            id: plus.identifier,
            price: plus.price,
            currencyCode: plus.currencyCode,
            priceString: plus.priceString,
          }
        : null,
      plusPrice,
      businessPrice,
    });
  }
  return {
    storefrontCountry,
    plusPrice,
    businessPrice,
    plusCurrency: plus?.currencyCode ?? null,
    businessCurrency: business?.currencyCode ?? null,
  };
}

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

function applyRegionalPrices() {
  const store = usePlusStore.getState();
  const market = store.billingMarket;
  if (!market) {
    store.setListPriceLabel(FALLBACK_PLUS_PRICE_LABEL);
    store.setListBusinessPriceLabel(FALLBACK_BUSINESS_PRICE_LABEL);
    store.setPriceLabel(FALLBACK_PLUS_PRICE_LABEL);
    store.setBusinessPriceLabel(FALLBACK_BUSINESS_PRICE_LABEL);
    return;
  }
  const labels = priceLabelsForMarket(market, true);
  store.setListPriceLabel(labels.plusActive);
  store.setListBusinessPriceLabel(labels.businessActive);
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
    applyRegionalPrices();
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
  if (Platform.OS !== 'ios' || !IOS_API_KEY || !configuredUserId) {
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
  plusPackage = packageByProductIds(allPackages, PLUS_PURCHASE_PRODUCT_IDS);
  businessPackage = packageByProductIds(
    allPackages,
    BUSINESS_PURCHASE_PRODUCT_IDS,
  );
  const storeProducts = await Purchases.getProducts(
    [...PLUS_PURCHASE_PRODUCT_IDS, ...BUSINESS_PURCHASE_PRODUCT_IDS],
    Purchases.PRODUCT_CATEGORY.SUBSCRIPTION,
  ).catch(() => [] as PurchasesStoreProduct[]);
  const storefrontCountry = await Purchases.getStorefront()
    .then((storefront) => normalizeCountryCode(storefront?.countryCode))
    .catch(() => null);
  const plusFromStoreKit = storeProductByIds(
    storeProducts,
    PLUS_PURCHASE_PRODUCT_IDS,
  );
  const businessFromStoreKit = storeProductByIds(
    storeProducts,
    BUSINESS_PURCHASE_PRODUCT_IDS,
  );
  plusProduct =
    pickStoreProductForStorefront(
      plusFromStoreKit,
      plusPackage?.product,
      storefrontCountry,
    ) ??
    plusPackage?.product ??
    null;
  businessProduct =
    pickStoreProductForStorefront(
      businessFromStoreKit,
      businessPackage?.product,
      storefrontCountry,
    ) ??
    businessPackage?.product ??
    null;
  const store = usePlusStore.getState();
  const storeCurrency =
    plusProduct?.currencyCode ?? businessProduct?.currencyCode;
  const baseMarket = storefrontCountry
    ? billingMarketSnapshot(storefrontCountry)
    : (store.billingMarket ??
      billingMarketSnapshot(guessDeviceCountryCode()) ??
      (await store.refreshBillingMarket()));
  const market = mergeBillingMarketWithStoreCurrency(baseMarket, storeCurrency);
  store.applyBillingMarket(market);
  const labels = priceLabelsForMarket(market, true);
  const priceContext = {
    storefrontCountry,
    deviceCountry: guessDeviceCountryCode(),
    billingMarket: store.billingMarket,
  };
  const plusShown =
    resolveApplePaywallPriceLabel(plusProduct, 'plus', priceContext) ??
    storefrontPriceLabel(
      plusProduct?.priceString,
      plusProduct?.currencyCode,
      market,
      labels.plusActive,
    );
  const businessShown =
    resolveApplePaywallPriceLabel(businessProduct, 'business', priceContext) ??
    storefrontPriceLabel(
      businessProduct?.priceString,
      businessProduct?.currencyCode,
      market,
      labels.businessActive,
    );
  store.setListPriceLabel(plusShown);
  store.setListBusinessPriceLabel(businessShown);
  if (plusShown) store.setPriceLabel(plusShown);
  if (businessShown) store.setBusinessPriceLabel(businessShown);
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
  ids: readonly string[],
  missingMessage: string,
): Promise<PurchasesStoreProduct> {
  assertNativeIos();
  const products = await Purchases.getProducts(
    [...ids],
    Purchases.PRODUCT_CATEGORY.SUBSCRIPTION,
  );
  const product = storeProductByIds(products, ids);
  if (!product) throw new Error(missingMessage);
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
    PLUS_PURCHASE_PRODUCT_IDS,
    'TecnoWallet+ todavía no está disponible en App Store para esta región.',
  );
  return purchaseSelected(product);
}

export async function purchaseBusiness(): Promise<BillingStatus> {
  await loadOfferings();
  const product = await fetchCheckoutProduct(
    BUSINESS_PURCHASE_PRODUCT_IDS,
    'TecnoWallet Business todavía no está disponible en App Store para esta región.',
  );
  return purchaseSelected(product);
}

export async function restorePlusPurchases(): Promise<BillingStatus> {
  assertNativeIos();
  await Purchases.restorePurchases();
  return await billingAfterPurchase();
}
