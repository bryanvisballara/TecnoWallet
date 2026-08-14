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
  netAmountMinor?: number;
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'reversed';
  product: string;
  planLabel: string;
  occurredAt: string;
  paidAt: string | null;
};

export type AdminPayoutBlock = 'no_wallet' | 'below_minimum' | 'already_paid' | null;

export type AdminAffiliatePayout = {
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  email: string | null;
  commissionTotalMinor: number;
  pendingMinor: number;
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'reversed';
  simulated?: boolean;
  ready: boolean;
  blockReason: AdminPayoutBlock;
  tier?: {
    id: 'partner' | 'creator' | 'ambassador';
    label: string;
    commissionPercent: number;
    rangeLabel: string;
    activePaidCount: number;
  };
  referralCount?: number;
  netMinor?: number;
  payoutMethod: AdminPayoutMethod | null;
  commissions: AdminCommissionRow[];
};

export type AdminPayoutPolicy = {
  paydayDay: number;
  minimumUsd: number;
  minimumMinor: number;
  rule: string;
};

export type AdminPlan = 'free' | 'plus' | 'business';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  platformRole: 'user' | 'admin';
  plan: AdminPlan;
  expiresAt: string | null;
  provider: string | null;
  createdAt?: string | null;
};

export type AdminUserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    platformRole: 'user' | 'admin';
    active: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
  plan: AdminPlan;
  subscription: {
    status: string;
    provider: string;
    productId: string | null;
    entitlementId: string;
    purchasedAt: string | null;
    expiresAt: string | null;
    willRenew: boolean;
    updatedAt: string | null;
  } | null;
  upgrades: Array<{
    at: string;
    plan: string;
    provider: string;
    productId: string | null;
    status: string;
    expiresAt: string | null;
    source: 'subscription' | 'commission';
  }>;
  payments: Array<{
    id: string;
    at: string;
    product: string;
    planLabel: string;
    eventType: string;
    amountMinor: number;
    commissionAmountMinor: number;
    currency: string;
    status: string;
    paidAt: string | null;
  }>;
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
    policy: AdminPayoutPolicy;
    affiliates: AdminAffiliatePayout[];
  }>(`/admin/affiliate/payouts${suffix}`);
}

export function simulateAdminPayouts() {
  return apiRequest<{
    created: number;
    email: string;
    notice: string;
    rows: Array<{ name: string; amountUsd: number; hasWallet: boolean }>;
  }>('/admin/affiliate/payouts/simulate', {
    method: 'POST',
    body: '{}',
  });
}

export function clearSimulatedAdminPayouts() {
  return apiRequest<{ commissions: number; affiliates: number }>(
    '/admin/affiliate/payouts/clear-simulated',
    { method: 'POST', body: '{}' },
  );
}

export function payAdminAffiliate(
  affiliateId: string,
  input: {
    from?: string;
    to?: string;
    note?: string;
    proofName?: string;
    proofBase64?: string;
  },
) {
  return apiRequest<{
    affiliateId: string;
    paidMinor: number;
    currency: string;
    paidAt: string;
    email: string;
    emailDelivered: boolean;
    remainingPendingMinor: number;
    wallet: { asset: string; network: string; address: string };
  }>(`/admin/affiliate/payouts/${encodeURIComponent(affiliateId)}/pay`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

export function searchAdminUsers(
  q?: string,
  plan?: 'all' | AdminPlan,
) {
  const query = new URLSearchParams();
  if (q?.trim()) query.set('q', q.trim());
  if (plan && plan !== 'all') query.set('plan', plan);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{ users: AdminUserRow[] }>(`/admin/users${suffix}`);
}

export function getAdminUserDetail(userId: string) {
  return apiRequest<AdminUserDetail>(
    `/admin/users/${encodeURIComponent(userId)}`,
  );
}

export function upgradeAdminUser(
  userId: string,
  input: { plan: AdminPlan; months?: number },
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
