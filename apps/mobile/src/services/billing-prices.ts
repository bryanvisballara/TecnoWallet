import { billingMarketSnapshot } from '@tecnowallet/config';

/**
 * Display fallbacks / reference prices.
 * Apple actually charges whatever is configured in App Store Connect
 * (shown via RevenueCat `product.priceString` when offerings load).
 *
 * Regional defaults live in `packages/config/src/billing-regions.ts`.
 * Never put coupon SKUs in list arrays — Apple would charge the discounted
 * price before the user applies a code.
 */
const defaultMarket = billingMarketSnapshot(null);

export const FALLBACK_PLUS_PRICE_LABEL = defaultMarket.plusListLabel;
export const FALLBACK_BUSINESS_PRICE_LABEL = defaultMarket.businessListLabel;
export const FALLBACK_PLUS_COUPON_PRICE_LABEL =
  defaultMarket.plusCouponLabel ?? defaultMarket.plusListLabel;
export const FALLBACK_BUSINESS_COUPON_PRICE_LABEL =
  defaultMarket.businessCouponLabel ?? defaultMarket.businessListLabel;

export const PLUS_PRODUCT_ID = 'TecnoWalletPlus';
export const BUSINESS_PRODUCT_ID = 'TecnoWalletBusiness';

export const PLUS_LIST_PRODUCT_IDS = [
  'TecnoWalletPlusStandard',
] as const;

export const BUSINESS_LIST_PRODUCT_IDS = [
  'TecnoWalletBusinessStandard',
] as const;

export const PLUS_COUPON_PRODUCT_IDS = [
  'TecnoWalletPlusAffiliate',
  PLUS_PRODUCT_ID,
] as const;

export const BUSINESS_COUPON_PRODUCT_IDS = [
  'TecnoWalletBusinessAffiliate',
  BUSINESS_PRODUCT_ID,
] as const;

/** @deprecated Use PLUS_LIST_PRODUCT_IDS */
export const PLUS_PRODUCT_IDS = PLUS_LIST_PRODUCT_IDS;
/** @deprecated Use BUSINESS_LIST_PRODUCT_IDS */
export const BUSINESS_PRODUCT_IDS = BUSINESS_LIST_PRODUCT_IDS;

export const AFFILIATE_OFFERING_ID = 'affiliate';
