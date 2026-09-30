import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ReferralDownloadScreen } from '@/components/referral-download-screen';
import { normalizeAffiliateCode } from '@/lib/referral-auth';
import { getAffiliateCode } from '@/services/affiliate-api';

export default function AffiliateReferralRoute() {
  const params = useLocalSearchParams<{ code?: string | string[]; step?: string | string[] }>();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const rawStep = Array.isArray(params.step) ? params.step[0] : params.step;
  const code = normalizeAffiliateCode(rawCode) ?? '';
  const isDownloadStep = rawStep === 'download' || rawStep === 'app';
  const [referrerLabel, setReferrerLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isDownloadStep || !code) return;
    void getAffiliateCode(code)
      .then((affiliate) => setReferrerLabel(affiliate.name?.trim() || affiliate.code))
      .catch(() => setReferrerLabel(code));
  }, [code, isDownloadStep]);

  if (isDownloadStep && code) {
    return <ReferralDownloadScreen referrerLabel={referrerLabel} />;
  }

  if (!code) {
    return <Redirect href={{ pathname: '/auth', params: { mode: 'register' } }} />;
  }

  return <Redirect href={{ pathname: '/auth', params: { mode: 'register', affiliate: code } }} />;
}
