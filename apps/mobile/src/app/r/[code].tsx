import { useLocalSearchParams } from 'expo-router';

import { CouponLeadGate } from '@/components/coupon-lead-gate';

export default function AffiliateReferralRoute() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  return <CouponLeadGate code={code} />;
}
