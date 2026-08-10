import branch, { type BranchParams } from 'react-native-branch';

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
let unsubscribe: (() => void) | null = null;

function textParam(params: BranchParams, key: string) {
  const value = params[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function handleParams(params: BranchParams) {
  if (!params['+clicked_branch_link']) return;
  const code =
    textParam(params, 'affiliate_code') ??
    textParam(params, 'code') ??
    textParam(params, '$affiliate_code');
  if (!code) return;
  const pending: PendingReferral = {
    code: code.toUpperCase(),
    branchClickId:
      textParam(params, '~id') ?? textParam(params, 'branch_click_id'),
    source: 'branch',
  };
  await localStorage.set(PENDING_KEY, pending);
  if (await tokenStorage.get()) {
    await claimPendingAffiliate();
  }
}

export function initBranchAttribution() {
  if (unsubscribe) return unsubscribe;
  unsubscribe = branch.subscribe(({ error, params }) => {
    if (!error && params) void handleParams(params);
  });
  return unsubscribe;
}

export async function setBranchIdentity(userId: string) {
  if (userId) await branch.setIdentityAsync(userId);
}

export async function clearBranchIdentity() {
  branch.logout();
}

export async function storeManualAffiliateCode(code: string) {
  const pending: PendingReferral = {
    code: code.trim().toUpperCase(),
    source: 'manual',
  };
  await localStorage.set(PENDING_KEY, pending);
  if (await tokenStorage.get()) {
    return claimPendingAffiliate();
  }
}

export async function storeWebAffiliateReferral(code: string, clickId?: string) {
  const pending: PendingReferral = {
    code: code.trim().toUpperCase(),
    clickId,
    source: 'web',
  };
  await localStorage.set(PENDING_KEY, pending);
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
