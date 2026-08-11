import { apiRequest } from './api';

export type PlusAccess = 'free' | 'plus' | 'business' | 'sponsored_collaborator';

export type BillingStatus = {
  access: PlusAccess;
  isPlus: boolean;
  isBusiness?: boolean;
  seatLimit?: number;
  status: string;
  entitlementId?: string;
  productId?: string;
  expiresAt?: string;
  willRenew?: boolean;
  sponsoredBy?: string[];
};

export function hasPaidPlan(access: PlusAccess | null | undefined) {
  return access === 'plus' || access === 'business';
}

export function isBusinessPlan(access: PlusAccess | null | undefined) {
  return access === 'business';
}

/** Short plan name for profile / Más chips. */
export function planDisplayLabel(
  access: PlusAccess | null | undefined,
  locale: 'es' | 'en' = 'es',
) {
  const es = locale === 'es';
  switch (access) {
    case 'plus':
      return 'Plus';
    case 'business':
      return 'Business';
    case 'sponsored_collaborator':
      return es ? 'Colaborador' : 'Collaborator';
    case 'free':
    default:
      return 'Free';
  }
}

/** Longer line under the plan chip. */
export function planDisplaySubtitle(
  access: PlusAccess | null | undefined,
  locale: 'es' | 'en' = 'es',
) {
  const es = locale === 'es';
  switch (access) {
    case 'plus':
      return es ? 'Plan TecnoWallet+' : 'TecnoWallet+ plan';
    case 'business':
      return es ? 'Plan TecnoWallet Business' : 'TecnoWallet Business plan';
    case 'sponsored_collaborator':
      return es
        ? 'Acceso compartido por un sponsor'
        : 'Shared access via a sponsor';
    case 'free':
    default:
      return es ? 'Plan Free actual' : 'Current Free plan';
  }
}

export async function getBillingStatus() {
  return apiRequest<BillingStatus>('/billing/status');
}

export async function syncBillingStatus() {
  return apiRequest<BillingStatus>('/billing/sync', { method: 'POST' });
}
