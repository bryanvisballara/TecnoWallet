import { claimAffiliate } from './affiliate-api';
import { localStorage, tokenStorage } from './persistence';
import { useAffiliateStore } from '@/store/affiliate';

type PendingReferral = {
  code: string;
  clickId?: string;
  branchClickId?: string;
  source: 'branch' | 'manual' | 'web';
};

const PENDING_KEY = 'pending-affiliate-referral';

export function initBranchAttribution() {
  return () => undefined;
}

export async function setBranchIdentity(_userId: string) {
  return;
}

export async function clearBranchIdentity() {
  return;
}

export async function storeManualAffiliateCode(code: string) {
  await localStorage.set<PendingReferral>(PENDING_KEY, {
    code: code.trim().toUpperCase(),
    source: 'manual',
  });
  if (await tokenStorage.get()) return claimPendingAffiliate();
}

export async function storeWebAffiliateReferral(code: string, clickId?: string) {
  await localStorage.set<PendingReferral>(PENDING_KEY, {
    code: code.trim().toUpperCase(),
    clickId,
    source: 'web',
  });
  if (await tokenStorage.get()) return claimPendingAffiliate();
}

export async function claimPendingAffiliate() {
  if (!(await tokenStorage.get())) return null;
  const pending = await localStorage.get<PendingReferral | null>(
    PENDING_KEY,
    null,
  );
  if (!pending?.code) return null;
  const affiliate = await claimAffiliate(pending);
  await localStorage.remove(PENDING_KEY);
  useAffiliateStore.getState().showWelcome(affiliate);
  return affiliate;
}
