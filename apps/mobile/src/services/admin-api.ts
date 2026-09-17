import { ApiError, apiRequest } from './api';

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

export type AdminPayoutBlock = 'no_wallet' | 'below_minimum' | 'already_paid' | 'not_requested' | null;

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
  payoutRequested?: boolean;
  payoutRequestedAt?: string | null;
  lastPaidAt?: string | null;
  paidMinor?: number;
  ready: boolean;
  blockReason: AdminPayoutBlock;
  referralCount?: number;
  bountyAmountMinor?: number;
  payoutMethod: AdminPayoutMethod | null;
  commissions: AdminCommissionRow[];
};

export type AdminPayoutPolicy = {
  paydayDay: number;
  minimumUsd: number;
  minimumMinor: number;
  rule: string;
};

export type AdminPayoutTotals = {
  pendingMinor: number;
  requestedMinor: number;
  paidMinor: number;
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

export function getAdminAffiliatePayouts() {
  return apiRequest<{
    policy: AdminPayoutPolicy;
    totals?: AdminPayoutTotals;
    affiliates: AdminAffiliatePayout[];
  }>('/admin/affiliate/payouts');
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

export type AdminUsersPage = {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
};

function paginateUsersLocally(
  users: AdminUserRow[],
  page: number,
  limit: number,
): AdminUsersPage {
  const pageSize = Math.min(Math.max(limit, 1), 20);
  const total = users.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    users: users.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasNextPage: safePage < totalPages,
  };
}

export async function searchAdminUsers(
  q?: string,
  plan?: 'all' | AdminPlan,
  page = 1,
  limit = 20,
) {
  const query = new URLSearchParams();
  if (q?.trim()) query.set('q', q.trim());
  if (plan && plan !== 'all') query.set('plan', plan);
  query.set('page', String(Math.max(1, page)));
  query.set('limit', String(Math.min(Math.max(limit, 1), 20)));
  try {
    return await apiRequest<AdminUsersPage>(`/admin/users?${query.toString()}`);
  } catch (error) {
    const legacyQuery = new URLSearchParams(query);
    legacyQuery.delete('page');
    legacyQuery.delete('limit');
    const suffix = legacyQuery.toString() ? `?${legacyQuery.toString()}` : '';
    const isLegacyPaginationRejection =
      error instanceof ApiError &&
      error.status === 400 &&
      /page should not exist|limit should not exist/i.test(error.message);
    if (!isLegacyPaginationRejection) throw error;
    const legacy = await apiRequest<{ users: AdminUserRow[] }>(
      `/admin/users${suffix}`,
    );
    return paginateUsersLocally(legacy.users ?? [], page, limit);
  }
}

export function deleteAdminUser(userId: string) {
  return apiRequest<{ deleted: boolean; userId: string }>(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
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
