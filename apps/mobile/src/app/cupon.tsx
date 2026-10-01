import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

import { CouponLeadGate } from '@/components/coupon-lead-gate';
import { PROMO_COUPON_CODE } from '@/services/billing-prices';

export default function PromoCouponRoute() {
  if (Platform.OS === 'ios') {
    return <Redirect href="/" />;
  }
  return <CouponLeadGate code={PROMO_COUPON_CODE} />;
}
