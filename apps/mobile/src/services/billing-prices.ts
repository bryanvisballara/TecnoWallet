import { billingMarketSnapshot } from '@tecnowallet/config';

/**
 * StoreKit prices come from App Store Connect via RevenueCat `priceString`.
 * Fallback labels live in `packages/config/src/billing-regions.ts`.
 *
 * All users checkout the public Plus/Business subscriptions (not Standard).
 * Standard SKUs remain in App Store Connect but are not sold in-app.
 */
const defaultMarket = billingMarketSnapshot(null);

export const FALLBACK_PLUS_PRICE_LABEL =
  defaultMarket.plusCouponLabel ?? defaultMarket.plusListLabel;
export const FALLBACK_BUSINESS_PRICE_LABEL =
  defaultMarket.businessCouponLabel ?? defaultMarket.businessListLabel;
export const FALLBACK_PLUS_COUPON_PRICE_LABEL = FALLBACK_PLUS_PRICE_LABEL;
export const FALLBACK_BUSINESS_COUPON_PRICE_LABEL =
  FALLBACK_BUSINESS_PRICE_LABEL;

export const PLUS_PRODUCT_ID = 'TecnoWalletPlus';
export const BUSINESS_PRODUCT_ID = 'TecnoWalletBusiness';

/** Google Play subscription (base plan monthly). */
export const PLUS_PLAY_PRODUCT_ID = 'tecnowalletplus:monthly';
export const BUSINESS_PLAY_PRODUCT_ID = 'tecnowalletbusiness:monthly';

/** In-app purchase: TecnoWallet + (public price tier). */
export const PLUS_PURCHASE_PRODUCT_IDS = [
  PLUS_PRODUCT_ID,
  'TecnoWalletPlusAffiliate',
  PLUS_PLAY_PRODUCT_ID,
] as const;

/** In-app purchase: TecnoWallet Business (public price tier). */
export const BUSINESS_PURCHASE_PRODUCT_IDS = [
  BUSINESS_PRODUCT_ID,
  'TecnoWalletBusinessAffiliate',
  BUSINESS_PLAY_PRODUCT_ID,
] as const;

/** Legacy list-price SKUs — not used at checkout. */
export const PLUS_LIST_PRODUCT_IDS = [
  'TecnoWalletPlusStandard',
  'TecnoWalletplusstandard',
] as const;

export const BUSINESS_LIST_PRODUCT_IDS = [
  'TecnoWalletBusinessStandard',
  'TecnoWalletbusinessstandard',
] as const;

export const PLUS_COUPON_PRODUCT_IDS = PLUS_PURCHASE_PRODUCT_IDS;
export const BUSINESS_COUPON_PRODUCT_IDS = BUSINESS_PURCHASE_PRODUCT_IDS;

/** @deprecated Use PLUS_PURCHASE_PRODUCT_IDS */
export const PLUS_PRODUCT_IDS = PLUS_PURCHASE_PRODUCT_IDS;
/** @deprecated Use BUSINESS_PURCHASE_PRODUCT_IDS */
export const BUSINESS_PRODUCT_IDS = BUSINESS_PURCHASE_PRODUCT_IDS;

export const AFFILIATE_OFFERING_ID = 'affiliate';

/** In-paywall promo. The link opens the form; the price changes only after the code is applied. */
export const PROMO_COUPON_CODE = 'TECNO2026';
export const PROMO_COUPON_URL = 'https://tecnowallet.app/cupon';
