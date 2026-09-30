import { recordAffiliateClick } from '@/services/affiliate-api';
import { storeWebAffiliateReferral } from '@/services/branch';
import { parseReferralCodeFromUrl } from '@/lib/referral-link';

/** Persist affiliate attribution when the app opens from /r/CODE (Universal Link). */
export async function captureReferralFromUrl(url: string | null | undefined) {
  const code = parseReferralCodeFromUrl(url);
  if (!code) return;
  try {
    const affiliate = await recordAffiliateClick({
      code,
      campaign: `universal_${code.toLowerCase()}`,
    });
    await storeWebAffiliateReferral(affiliate.code, affiliate.clickId);
  } catch {
    await storeWebAffiliateReferral(code);
  }
}
