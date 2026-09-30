import { CouponLeadGate } from '@/components/coupon-lead-gate';
import { PROMO_COUPON_CODE } from '@/services/billing-prices';

export default function PromoCouponRoute() {
  return <CouponLeadGate code={PROMO_COUPON_CODE} />;
}
