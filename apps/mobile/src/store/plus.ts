import { create } from 'zustand';

import {
  getBillingStatus,
  hasPaidPlan,
  type BillingStatus,
  type PlusAccess,
} from '@/services/plus-api';
import {
  FALLBACK_BUSINESS_PRICE_LABEL,
  FALLBACK_PLUS_PRICE_LABEL,
} from '@/services/billing-prices';

export type PlusReason =
  | 'UPGRADE'
  | 'BOOK_LIMIT'
  | 'ENVELOPE_LIMIT'
  | 'SHARING_REQUIRED'
  | 'AI_REQUIRED'
  | 'SEAT_LIMIT';

export type PaywallPlan = 'plus' | 'business';

type PlusState = {
  hydrated: boolean;
  loading: boolean;
  access: PlusAccess;
  billing: BillingStatus | null;
  paywallOpen: boolean;
  paywallReason: PlusReason;
  paywallPlan: PaywallPlan;
  priceLabel: string | null;
  businessPriceLabel: string | null;
  hydrate: () => Promise<void>;
  reset: () => void;
  openPaywall: (
    reason?: PlusReason,
    options?: { plan?: PaywallPlan },
  ) => void;
  closePaywall: () => void;
  setPriceLabel: (price: string | null) => void;
  setBusinessPriceLabel: (price: string | null) => void;
  setBilling: (billing: BillingStatus) => void;
};

export const usePlusStore = create<PlusState>((set, get) => ({
  hydrated: false,
  loading: false,
  access: 'free',
  billing: null,
  paywallOpen: false,
  paywallReason: 'UPGRADE',
  paywallPlan: 'plus',
  priceLabel: FALLBACK_PLUS_PRICE_LABEL,
  businessPriceLabel: FALLBACK_BUSINESS_PRICE_LABEL,
  hydrate: async () => {
    set({ loading: true });
    try {
      const billing = await getBillingStatus();
      set({
        billing,
        access: billing.access,
        hydrated: true,
        loading: false,
      });
    } catch {
      set({ hydrated: true, loading: false, access: 'free', billing: null });
    }
  },
  reset: () =>
    set({
      hydrated: false,
      loading: false,
      access: 'free',
      billing: null,
      paywallOpen: false,
      paywallReason: 'UPGRADE',
      paywallPlan: 'plus',
      priceLabel: FALLBACK_PLUS_PRICE_LABEL,
      businessPriceLabel: FALLBACK_BUSINESS_PRICE_LABEL,
    }),
  openPaywall: (paywallReason = 'UPGRADE', options) => {
    const access = get().access;
    const plan =
      options?.plan ??
      (paywallReason === 'SEAT_LIMIT' && access === 'plus'
        ? 'business'
        : 'plus');
    set({ paywallOpen: true, paywallReason, paywallPlan: plan });
  },
  closePaywall: () => set({ paywallOpen: false }),
  setPriceLabel: (priceLabel) => set({ priceLabel }),
  setBusinessPriceLabel: (businessPriceLabel) => set({ businessPriceLabel }),
  setBilling: (billing) => set({ billing, access: billing.access }),
}));

export { hasPaidPlan };

export function isPlusRequiredError(error: unknown): error is {
  code?: string;
  reason?: string;
} {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; reason?: string; status?: number };
  return (
    value.code === 'PLUS_REQUIRED' ||
    value.code === 'BUSINESS_REQUIRED' ||
    value.code === 'SEAT_LIMIT' ||
    value.code === 'SHARING_REQUIRED' ||
    value.status === 402
  );
}

export function plusReasonFromError(error: unknown): PlusReason {
  if (!error || typeof error !== 'object') return 'UPGRADE';
  const payload = error as {
    reason?: string | { code?: string; feature?: string; upgradeTo?: string };
    reasonDetails?: { code?: string; feature?: string; upgradeTo?: string };
    code?: string;
  };
  const nested =
    payload.reasonDetails ??
    (typeof payload.reason === 'object' && payload.reason
      ? payload.reason
      : undefined);
  const reason = String(
    nested?.code ??
      (typeof payload.reason === 'string' ? payload.reason : '') ??
      payload.code ??
      '',
  );
  const allowed: PlusReason[] = [
    'UPGRADE',
    'BOOK_LIMIT',
    'ENVELOPE_LIMIT',
    'SHARING_REQUIRED',
    'AI_REQUIRED',
    'SEAT_LIMIT',
  ];
  return allowed.includes(reason as PlusReason)
    ? (reason as PlusReason)
    : 'UPGRADE';
}

export function paywallPlanFromError(error: unknown): PaywallPlan {
  if (!error || typeof error !== 'object') return 'plus';
  const payload = error as {
    reason?: { upgradeTo?: string; code?: string };
    reasonDetails?: { upgradeTo?: string; code?: string };
    code?: string;
  };
  const details = payload.reasonDetails ?? payload.reason;
  if (details?.upgradeTo === 'business') return 'business';
  if (details?.code === 'SEAT_LIMIT' || payload.code === 'SEAT_LIMIT') {
    return 'business';
  }
  return 'plus';
}
