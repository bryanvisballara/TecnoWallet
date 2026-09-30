import { localStorage } from '@/services/persistence';

/** Colombia App Store listing (affiliate post-register CTA). */
export const REFERRAL_APP_STORE_URL =
  process.env.EXPO_PUBLIC_APP_STORE_URL?.trim() ||
  'https://apps.apple.com/co/app/tecnowallet/id6802359477?l=en-GB';

const REFERRAL_AUTH_KEY = 'referral-auth-affiliate';

export function normalizeAffiliateCode(raw: string | null | undefined) {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase();
  return code.length >= 2 ? code : null;
}

export async function persistReferralAffiliateCode(code: string) {
  const normalized = normalizeAffiliateCode(code);
  if (!normalized) return;
  await localStorage.set(REFERRAL_AUTH_KEY, normalized);
}

export async function getReferralAffiliateCode() {
  return localStorage.get<string | null>(REFERRAL_AUTH_KEY, null);
}

export async function clearReferralAffiliateCode() {
  await localStorage.remove(REFERRAL_AUTH_KEY);
}
