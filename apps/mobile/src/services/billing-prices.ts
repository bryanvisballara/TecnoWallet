/**
 * Display fallbacks / reference prices.
 * Apple actually charges whatever is configured in App Store Connect
 * (shown via RevenueCat `product.priceString` when offerings load).
 *
 * List products: $12.99 Plus / $17.99 Business (Standard SKUs only).
 * Discount coupon products: $9.99 Plus / $14.99 Business.
 *
 * Never put the coupon SKUs in the list arrays — Apple would charge
 * the discounted price before the user applies a code.
 */
export const FALLBACK_PLUS_PRICE_LABEL = 'US$12.99';
export const FALLBACK_BUSINESS_PRICE_LABEL = 'US$17.99';
export const FALLBACK_PLUS_COUPON_PRICE_LABEL = 'US$9.99';
export const FALLBACK_BUSINESS_COUPON_PRICE_LABEL = 'US$14.99';

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
