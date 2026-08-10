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

export async function getBillingStatus() {
  return apiRequest<BillingStatus>('/billing/status');
}

export async function syncBillingStatus() {
  return apiRequest<BillingStatus>('/billing/sync', { method: 'POST' });
}
