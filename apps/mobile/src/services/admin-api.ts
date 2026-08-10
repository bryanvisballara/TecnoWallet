import { apiRequest } from './api';

export type AdminUserStats = {
  total: number;
  free: number;
  plus: number;
  business: number;
};

export type AdminPayoutMethod = {
  type: string;
  asset: string;
  network: string;
  address: string;
};

export type AdminCommissionRow = {
  id: string;
  userId: string;
  userLabel: string;
  affiliateId: string;
  subscriptionId: string | null;
  commissionRate: number;
  commissionAmountMinor: number;
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'reversed';
  product: string;
  planLabel: string;
  occurredAt: string;
  paidAt: string | null;
};

export type AdminAffiliatePayout = {
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  commissionTotalMinor: number;
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'reversed';
  payoutMethod: AdminPayoutMethod | null;
  commissions: AdminCommissionRow[];
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  platformRole: 'user' | 'admin';
  plan: 'free' | 'plus' | 'business';
  expiresAt: string | null;
  provider: string | null;
};

export function getAdminUserStats() {
  return apiRequest<AdminUserStats>('/admin/stats/users');
}

export function getAdminAffiliatePayouts(input?: {
  from?: string;
  to?: string;
  status?: string;
}) {
  const query = new URLSearchParams();
  if (input?.from) query.set('from', input.from);
  if (input?.to) query.set('to', input.to);
  if (input?.status) query.set('status', input.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{
    from: string | null;
    to: string | null;
    status: string | null;
    affiliates: AdminAffiliatePayout[];
  }>(`/admin/affiliate/payouts${suffix}`);
}

export function approveAdminCommission(id: string) {
  return apiRequest<{ id: string; status: string }>(
    `/admin/affiliate/commissions/${encodeURIComponent(id)}/approve`,
    { method: 'POST', body: '{}' },
  );
}

export function markAdminCommissionsPaid(input: {
  from?: string;
  to?: string;
  affiliateId?: string;
  ids?: string[];
  note?: string;
}) {
  return apiRequest<{
    matched: number;
    modified: number;
    paidAt: string;
    note: string | null;
  }>('/admin/affiliate/commissions/mark-paid', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function searchAdminUsers(q?: string) {
  const query = new URLSearchParams();
  if (q?.trim()) query.set('q', q.trim());
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{ users: AdminUserRow[] }>(`/admin/users${suffix}`);
}

export function upgradeAdminUser(
  userId: string,
  input: { plan: 'plus' | 'business'; months?: number },
) {
  return apiRequest<{
    userId: string;
    plan: string;
    entitlementId: string;
    expiresAt: string;
    provider: string;
    months: number;
  }>(`/admin/users/${encodeURIComponent(userId)}/upgrade`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
