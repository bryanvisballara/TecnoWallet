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

export function kycStatusLabel(status?: string) {
  switch (status) {
    case 'approved':
      return 'Verificada';
    case 'under_review':
      return 'En revisión';
    case 'incomplete':
    case 'not_started':
      return 'Pendiente';
    case 'awaiting_questionnaire':
      return 'Falta el cuestionario';
    case 'awaiting_ubo':
      return 'Faltan datos de la empresa';
    case 'rejected':
      return 'Rechazada';
    case 'paused':
      return 'Pausada';
    case 'offboarded':
      return 'Dada de baja';
    case 'deposits_restricted':
      return 'Depósitos restringidos';
    default:
      return status ? 'En proceso' : 'Sin verificar';
  }
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
    kycUrl: typeof row.kycUrl === 'string' ? row.kycUrl : undefined,
    tosUrl: typeof row.tosUrl === 'string' ? row.tosUrl : undefined,
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
