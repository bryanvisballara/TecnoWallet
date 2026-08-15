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

export type RecaudoKycPhase = 'none' | 'pending' | 'approved' | 'rejected';

export function kycPhase(kyc?: RecaudoKyc | null, fallbackStatus?: string): RecaudoKycPhase {
  const status = kyc?.kycStatus || fallbackStatus || 'not_started';
  if (kyc?.verified || status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'offboarded') return 'rejected';
  const started = Boolean(
    kyc?.kycLinkId ||
      kyc?.customerId ||
      (status && status !== 'not_started'),
  );
  return started ? 'pending' : 'none';
}

export function kycStatusLabel(status?: string) {
  switch (status) {
    case 'approved':
      return 'Verificada';
    case 'under_review':
    case 'incomplete':
    case 'paused':
    case 'awaiting_questionnaire':
    case 'awaiting_ubo':
    case 'deposits_restricted':
      return 'Pendiente';
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
  return {
    verified: row.verified === true || kycStatus === 'approved',
    kycStatus,
    tosStatus: typeof row.tosStatus === 'string' ? row.tosStatus : undefined,
    kycUrl: httpsUrl(typeof row.kycUrl === 'string' ? row.kycUrl : undefined),
    tosUrl: httpsUrl(typeof row.tosUrl === 'string' ? row.tosUrl : undefined),
    customerId: typeof row.customerId === 'string' ? row.customerId : undefined,
    kycLinkId: typeof row.kycLinkId === 'string' ? row.kycLinkId : undefined,
    rejectionReasons: reasons,
  };
}

export async function fetchRecaudoKyc() {
  return normalizeKyc(await apiRequest('/bridge/kyc'));
}

export async function startRecaudoKyc(retry = false) {
  return normalizeKyc(
    await apiRequest('/bridge/kyc-links', {
      method: 'POST',
      body: JSON.stringify({ retry }),
    }),
  );
}
