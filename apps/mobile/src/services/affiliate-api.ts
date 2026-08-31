import { apiRequest } from './api';

export type AffiliateUsdtNetwork = 'bep20' | 'trc20' | 'erc20' | 'sol';

export type AffiliatePayoutMethod = {
  type: 'usdt_wallet';
  asset: string;
  network: AffiliateUsdtNetwork;
  address: string;
  updatedAt?: string | null;
};

export type AffiliatePublic = {
  affiliateId: string;
  code: string;
  name: string;
  bountyAmountMinor?: number;
  bountyCurrency?: string;
  branchUrl?: string;
  clickId?: string;
  payoutMethod?: AffiliatePayoutMethod | null;
};

export type AffiliatePartnerStats = {
  clicks: number;
  downloads: number;
  signups: number;
  plusConversions: number;
  conversionRate: number;
  commissionTotalMinor: number;
  commissionPaidMinor: number;
  commissionPendingMinor: number;
  currency: string;
};

export type AffiliateReferredUser = {
  userId: string;
  label: string;
  attributedAt: string;
  plan: string;
  status: string;
  commissionMinor: number;
  currency: string;
};

export type AffiliatePartnerDashboard =
  | { enrolled: false }
  | {
      enrolled: true;
      affiliate: AffiliatePublic;
      shareUrl: string;
      reward: {
        amountMinor: number;
        currency: string;
        once: true;
      };
      stats: AffiliatePartnerStats;
      referred: AffiliateReferredUser[];
    };

type AffiliateEnvelope = {
  affiliate?: AffiliatePublic | null;
  attribution?: { code?: string } | null;
  branchUrl?: string;
  clickId?: string;
  shareUrl?: string;
  enrolled?: boolean;
  created?: boolean;
};

function unwrapAffiliate(result: AffiliateEnvelope): AffiliatePublic {
  if (!result.affiliate) {
    throw new Error('No encontramos este código de recomendación.');
  }
  return {
    ...result.affiliate,
    branchUrl: result.branchUrl ?? result.affiliate.branchUrl,
    clickId: result.clickId,
  };
}

export async function getAffiliateCode(code: string) {
  const result = await apiRequest<AffiliateEnvelope>(
    `/affiliate/code/${encodeURIComponent(code.trim().toUpperCase())}`,
  );
  return unwrapAffiliate(result);
}

export async function recordAffiliateClick(input: {
  code: string;
  campaign?: string;
  branchClickId?: string;
}) {
  const result = await apiRequest<AffiliateEnvelope>('/affiliate/click', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return unwrapAffiliate(result);
}

export async function claimAffiliate(input: {
  code: string;
  clickId?: string;
  branchClickId?: string;
  source: 'branch' | 'manual' | 'web';
}) {
  const result = await apiRequest<AffiliateEnvelope>('/affiliate/claim', {
    method: 'POST',
    body: JSON.stringify({
      code: input.code,
      clickId: input.clickId,
      branchClickId: input.branchClickId,
    }),
  });
  return unwrapAffiliate(result);
}

export async function getMyAffiliate() {
  const result = await apiRequest<AffiliateEnvelope>('/affiliate/me');
  return result.affiliate ? unwrapAffiliate(result) : null;
}

export async function enrollAffiliatePartner(code?: string) {
  return apiRequest<{
    enrolled: true;
    created: boolean;
    affiliate: AffiliatePublic;
    shareUrl: string;
  }>('/affiliate/partner/enroll', {
    method: 'POST',
    body: JSON.stringify(code ? { code } : {}),
  });
}

export async function getAffiliatePartnerDashboard() {
  return apiRequest<AffiliatePartnerDashboard>('/affiliate/partner/dashboard');
}

export async function updateAffiliatePayout(input: {
  network: AffiliateUsdtNetwork;
  address: string;
}) {
  return apiRequest<{
    payoutMethod: AffiliatePayoutMethod | null;
    affiliate: AffiliatePublic;
  }>('/affiliate/partner/payout', {
    method: 'PATCH',
    body: JSON.stringify({
      type: 'usdt_wallet',
      network: input.network,
      address: input.address,
    }),
  });
}
