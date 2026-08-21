import * as WebBrowser from 'expo-web-browser';
import { Platform, Share } from 'react-native';

import { apiRequest } from '@/services/api';

export type RecaudoKyc = {
  verified: boolean;
  kycStatus: string;
  tosStatus?: string;
  kycUrl?: string;
  tosUrl?: string;
  customerId?: string;
  kycLinkId?: string;
  rejectionReasons: string[];
  nextStep?: 'tos' | 'kyc' | 'wait' | 'done' | 'retry';
};

export function kycCanRestart(kyc?: RecaudoKyc | null) {
  return !kyc?.verified;
}

export function kycStatusColor(
  status: string | undefined,
  colors: { warning: string; danger: string; success: string; muted: string },
) {
  switch (status) {
    case 'approved':
      return colors.success;
    case 'rejected':
    case 'offboarded':
      return colors.danger;
    case 'under_review':
    case 'incomplete':
    case 'not_started':
    case 'paused':
    case 'awaiting_questionnaire':
    case 'awaiting_ubo':
    case 'deposits_restricted':
      return colors.warning;
    default:
      return status ? colors.warning : colors.muted;
  }
}

export type RecaudoKycPhase = 'none' | 'continue' | 'pending' | 'approved' | 'rejected';

export function kycPhase(kyc?: RecaudoKyc | null, fallbackStatus?: string): RecaudoKycPhase {
  const status = kyc?.kycStatus || fallbackStatus || 'not_started';
  if (kyc?.verified || (status === 'approved' && kyc?.tosStatus === 'approved')) {
    return 'approved';
  }
  if (status === 'rejected' || status === 'offboarded') return 'rejected';
  if (kyc?.nextStep === 'wait' || status === 'under_review' || status === 'paused') {
    return 'pending';
  }
  return 'continue';
}

export function tosIsApproved(kyc?: RecaudoKyc | null) {
  return kyc?.tosStatus === 'approved';
}

export function nextVerificationAction(
  kyc?: RecaudoKyc | null,
  fallbackStatus?: string,
): 'tos' | 'kyc' | 'wait' | 'retry' | 'done' {
  const phase = kycPhase(kyc, fallbackStatus);
  if (phase === 'approved') return 'done';
  if (phase === 'rejected') return 'retry';
  if (phase === 'pending') return 'wait';
  if (!tosIsApproved(kyc)) return 'tos';
  return 'kyc';
}

export function kycStatusLabel(status?: string) {
  switch (status) {
    case 'approved':
      return 'Aprobada';
    case 'under_review':
    case 'paused':
    case 'deposits_restricted':
      return 'Pendiente';
    case 'incomplete':
    case 'awaiting_questionnaire':
    case 'awaiting_ubo':
      return 'Incompleta';
    case 'not_started':
      return 'Sin verificación';
    case 'rejected':
      return 'Rechazada';
    case 'offboarded':
      return 'Dada de baja';
    default:
      return status ? 'Pendiente' : 'Sin verificación';
  }
}

export function httpsUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^javascript:/i.test(raw) || /^data:/i.test(raw)) return undefined;
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^http:\/\//i.test(raw)) return `https://${raw.slice('http://'.length)}`;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) return `https://${raw}`;
  return undefined;
}

export function hostedVerificationUrl(kyc?: Pick<RecaudoKyc, 'kycUrl' | 'tosUrl'> | null) {
  return httpsUrl(kyc?.kycUrl) || httpsUrl(kyc?.tosUrl);
}

function isExternalHttps(href: string) {
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

export async function openHostedVerificationUrl(value?: string | null) {
  const href = httpsUrl(value);
  if (!href || !isExternalHttps(href)) {
    throw new Error(
      'El enlace de verificación no es válido. Pulsa de nuevo Verifica tu identidad.',
    );
  }
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return href;
  }
  await WebBrowser.openBrowserAsync(href, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    enableBarCollapsing: true,
    showInRecents: true,
  });
  return href;
}

export async function shareHostedVerificationUrl(value?: string | null) {
  const href = httpsUrl(value);
  if (!href || !isExternalHttps(href)) {
    throw new Error(
      'El enlace de verificación no es válido. Pulsa de nuevo Verifica tu identidad.',
    );
  }
  await Share.share(
    Platform.OS === 'ios' ? { url: href } : { message: href },
  );
}

function normalizeKyc(value: unknown): RecaudoKyc {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const reasons = Array.isArray(row.rejectionReasons)
    ? row.rejectionReasons.filter((item): item is string => typeof item === 'string')
    : [];
  const kycStatus = typeof row.kycStatus === 'string' ? row.kycStatus : 'not_started';
  const tosStatus = typeof row.tosStatus === 'string' ? row.tosStatus : undefined;
  return {
    verified:
      row.verified === true ||
      (kycStatus === 'approved' && tosStatus === 'approved'),
    kycStatus,
    tosStatus,
    kycUrl: httpsUrl(typeof row.kycUrl === 'string' ? row.kycUrl : undefined),
    tosUrl: httpsUrl(typeof row.tosUrl === 'string' ? row.tosUrl : undefined),
    customerId: typeof row.customerId === 'string' ? row.customerId : undefined,
    kycLinkId: typeof row.kycLinkId === 'string' ? row.kycLinkId : undefined,
    rejectionReasons: reasons,
    nextStep:
      row.nextStep === 'tos' ||
      row.nextStep === 'kyc' ||
      row.nextStep === 'wait' ||
      row.nextStep === 'done' ||
      row.nextStep === 'retry'
        ? row.nextStep
        : undefined,
  };
}

export async function fetchRecaudoKyc() {
  return normalizeKyc(await apiRequest('/bridge/kyc'));
}

export async function resetRecaudoKycDraft() {
  return normalizeKyc(
    await apiRequest('/bridge/kyc/reset-draft', { method: 'POST' }),
  );
}

export async function startRecaudoKyc(retry = false) {
  return normalizeKyc(
    await apiRequest('/bridge/kyc-links', {
      method: 'POST',
      body: JSON.stringify({ retry }),
    }),
  );
}

async function refreshKycUntil(
  done: (snap: RecaudoKyc) => boolean,
  attempts = 5,
) {
  let snap = await fetchRecaudoKyc();
  for (let i = 0; i < attempts && !done(snap); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    snap = await fetchRecaudoKyc();
  }
  return snap;
}

export async function continueRecaudoVerification() {
  let snap = await startRecaudoKyc(false);
  if (snap.verified) return snap;
  if (snap.nextStep === 'wait' || snap.nextStep === 'retry') return snap;

  if (snap.tosStatus !== 'approved') {
    if (!snap.tosUrl) {
      throw new Error(
        'No se pudo abrir los términos. Pulsa de nuevo Aceptar términos.',
      );
    }
    await openHostedVerificationUrl(snap.tosUrl);
    return refreshKycUntil(
      (next) => next.verified || next.tosStatus === 'approved',
    );
  }

  if (
    snap.kycUrl &&
    snap.kycStatus !== 'under_review' &&
    snap.kycStatus !== 'approved'
  ) {
    await openHostedVerificationUrl(snap.kycUrl);
    return refreshKycUntil(
      (next) =>
        next.verified ||
        next.kycStatus === 'under_review' ||
        next.kycStatus === 'approved',
    );
  }
  return snap;
}
