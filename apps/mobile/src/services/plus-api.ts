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
  hasSharedAccess?: boolean;
  invitedToSharedBook?: boolean;
  sharedResourceName?: string | null;
};

export function canUseSharedBooksWithoutPaying(
  billing: Pick<BillingStatus, 'hasSharedAccess' | 'invitedToSharedBook'> | null | undefined,
) {
  return Boolean(billing?.hasSharedAccess || billing?.invitedToSharedBook);
}

/** Paid, trial (Plus/Business entitlement), or invited guest. */
export function canUnlockApp(
  billing: BillingStatus | null | undefined,
  access?: PlusAccess | null,
) {
  const plan = access ?? billing?.access;
  if (hasPaidPlan(plan)) return true;
  if (plan === 'sponsored_collaborator') return true;
  return canUseSharedBooksWithoutPaying(billing);
}

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
  options?: { hasSharedAccess?: boolean; invitedToSharedBook?: boolean },
) {
  const es = locale === 'es';
  switch (access) {
    case 'plus':
      return 'Plus';
    case 'business':
      return 'Business';
    case 'sponsored_collaborator':
      return es ? 'Invitado' : 'Guest';
    case 'free':
    default:
      if (options?.hasSharedAccess || options?.invitedToSharedBook) {
        return es ? 'Invitado' : 'Guest';
      }
      return es ? 'Sin plan' : 'No plan';
  }
}

/** Longer line under the plan chip. */
export function planDisplaySubtitle(
  access: PlusAccess | null | undefined,
  locale: 'es' | 'en' = 'es',
  options?: { hasSharedAccess?: boolean; invitedToSharedBook?: boolean },
) {
  const es = locale === 'es';
  switch (access) {
    case 'plus':
      return es ? 'Plan TecnoWallet+' : 'TecnoWallet+ plan';
    case 'business':
      return es ? 'Plan TecnoWallet Business' : 'TecnoWallet Business plan';
    case 'sponsored_collaborator':
      return es
        ? 'Usas un libro o calendario compartido, sin pagar'
        : 'You use a shared book or calendar, no payment needed';
    case 'free':
    default:
      if (options?.hasSharedAccess) {
        return es
          ? 'Usas un libro o calendario compartido, sin pagar'
          : 'You use a shared book or calendar, no payment needed';
      }
      if (options?.invitedToSharedBook) {
        return es
          ? 'Te invitaron a un libro o calendario. Entra sin pagar'
          : 'You were invited to a book or calendar. Join without paying';
      }
      return es
        ? '3 días de prueba, luego se cobra'
        : '3-day trial, then billed';
  }
}

export async function getBillingStatus() {
  return apiRequest<BillingStatus>('/billing/status');
}

export async function syncBillingStatus() {
  return apiRequest<BillingStatus>('/billing/sync', { method: 'POST' });
}
