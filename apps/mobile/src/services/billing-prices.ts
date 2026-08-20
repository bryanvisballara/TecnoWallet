/**
 * Display fallbacks / reference prices.
 * Apple actually charges whatever is configured in App Store Connect
 * (shown via RevenueCat `product.priceString` when offerings load).
 *
 * List products: $11.99 Plus / $17.99 Business.
 * Affiliate coupon products: $9.99 Plus / $14.99 Business.
 *
 * Product IDs must match App Store Connect exactly (case-sensitive).
 * Prefer Standard/Affiliate SKUs when they exist; fall back to the
 * current TecnoWalletPlus / TecnoWalletBusiness identifiers.
 */
export const FALLBACK_PLUS_PRICE_LABEL = 'US$11.99';
export const FALLBACK_BUSINESS_PRICE_LABEL = 'US$17.99';
export const FALLBACK_PLUS_COUPON_PRICE_LABEL = 'US$9.99';
export const FALLBACK_BUSINESS_COUPON_PRICE_LABEL = 'US$14.99';

export const PLUS_PRODUCT_ID = 'TecnoWalletPlus';
export const BUSINESS_PRODUCT_ID = 'TecnoWalletBusiness';

export const PLUS_LIST_PRODUCT_IDS = [
  'TecnoWalletPlusStandard',
  PLUS_PRODUCT_ID,
  'tecnowallet_plus_monthly',
] as const;

export const BUSINESS_LIST_PRODUCT_IDS = [
  'TecnoWalletBusinessStandard',
  BUSINESS_PRODUCT_ID,
  'tecnowallet_business_monthly',
] as const;

export const PLUS_COUPON_PRODUCT_IDS = [
  'TecnoWalletPlusAffiliate',
  PLUS_PRODUCT_ID,
  'tecnowallet_plus_monthly',
] as const;

export const BUSINESS_COUPON_PRODUCT_IDS = [
  'TecnoWalletBusinessAffiliate',
  BUSINESS_PRODUCT_ID,
  'tecnowallet_business_monthly',
] as const;

/** @deprecated Use PLUS_LIST_PRODUCT_IDS */
export const PLUS_PRODUCT_IDS = PLUS_LIST_PRODUCT_IDS;
/** @deprecated Use BUSINESS_LIST_PRODUCT_IDS */
export const BUSINESS_PRODUCT_IDS = BUSINESS_LIST_PRODUCT_IDS;

export const AFFILIATE_OFFERING_ID = 'affiliate';
