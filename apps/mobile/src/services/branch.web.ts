import { claimAffiliate } from './affiliate-api';
import { localStorage, tokenStorage } from './persistence';
import { useAffiliateStore } from '@/store/affiliate';
import { affiliateProgramEnabled, usePlusStore } from '@/store/plus';

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
  if (!affiliateProgramEnabled(usePlusStore.getState().billingMarket)) return;
  await localStorage.set<PendingReferral>(PENDING_KEY, {
    code: code.trim().toUpperCase(),
    source: 'manual',
  });
}

export async function storeWebAffiliateReferral(code: string, clickId?: string) {
  if (!affiliateProgramEnabled(usePlusStore.getState().billingMarket)) return null;
  await localStorage.set<PendingReferral>(PENDING_KEY, {
    code: code.trim().toUpperCase(),
    clickId,
    source: 'web',
  });
  if (await tokenStorage.get()) return claimPendingAffiliate();
}

export async function peekPendingAffiliateCode() {
  const pending = await localStorage.get<PendingReferral | null>(
    PENDING_KEY,
    null,
  );
  const code = pending?.code?.trim().toUpperCase();
  return code || null;
}

export async function claimPendingAffiliate(options?: { allowManual?: boolean }) {
  if (!affiliateProgramEnabled(usePlusStore.getState().billingMarket)) return null;
  if (!(await tokenStorage.get())) return null;
  const pending = await localStorage.get<PendingReferral | null>(
    PENDING_KEY,
    null,
  );
  if (!pending?.code) return null;
  if (pending.source === 'manual' && !options?.allowManual) return null;
  const affiliate = await claimAffiliate(pending);
  await localStorage.remove(PENDING_KEY);
  if (pending.source !== 'manual') {
    useAffiliateStore.getState().showWelcome(affiliate);
  }
  return affiliate;
}
