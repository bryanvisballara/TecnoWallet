import { localStorage } from '@/services/persistence';

/** Colombia App Store listing (affiliate post-register CTA). */
export const REFERRAL_APP_STORE_URL =
  process.env.EXPO_PUBLIC_APP_STORE_URL?.trim() ||
  'https://apps.apple.com/co/app/tecnowallet/id6802359477?l=en-GB';

const REFERRAL_AUTH_KEY = 'referral-auth-affiliate';
const REFERRAL_AWAITING_APP_KEY = 'referral-awaiting-app-download';

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

/** After web signup via /r/CODE, show App Store CTA — no paywall on top. */
export async function markReferralAwaitingAppDownload() {
  await localStorage.set(REFERRAL_AWAITING_APP_KEY, true);
}

export async function clearReferralAwaitingAppDownload() {
  await localStorage.remove(REFERRAL_AWAITING_APP_KEY);
}

export async function isReferralAwaitingAppDownload() {
  return localStorage.get<boolean>(REFERRAL_AWAITING_APP_KEY, false);
}

export async function shouldSuppressPaywallForReferralFlow() {
  if (await isReferralAwaitingAppDownload()) return true;
  return Boolean(await getReferralAffiliateCode());
}
