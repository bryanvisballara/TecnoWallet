import { apiRequest } from '@/services/api';
import { openHostedVerificationUrl } from '@/lib/recaudo-kyc';

export type RecaudoActivation = {
  paid: boolean;
  amount: number;
  currency: string;
  title: string;
  configured: boolean;
};

export function formatActivationAmount(amount: number, currency = 'USD') {
  if (currency === 'USD') {
    const major = amount >= 100 ? amount / 100 : amount;
    return `US$ ${major.toFixed(2)}`;
  }
  if (currency === 'COP') {
    return `$${amount.toLocaleString('es-CO')} COP`;
  }
  return `${amount} ${currency}`;
}

export async function fetchRecaudoActivation(): Promise<RecaudoActivation> {
  const row = (await apiRequest('/recaudos/activation')) as Record<string, unknown>;
  return {
    paid: row.paid === true,
    amount: typeof row.amount === 'number' ? row.amount : 2.99,
    currency: typeof row.currency === 'string' ? row.currency : 'USD',
    title: typeof row.title === 'string' ? row.title : 'Wallet digital TecnoWallet',
    configured: row.configured !== false,
  };
}

export async function startRecaudoActivationCheckout() {
  const row = (await apiRequest('/recaudos/activation/checkout', {
    method: 'POST',
  })) as { paid?: boolean; initPoint?: string };
  if (row.paid) return { paid: true as const };
  if (!row.initPoint) {
    throw new Error('Mercado Pago no devolvió el enlace de pago.');
  }
  await openHostedVerificationUrl(row.initPoint);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = await fetchRecaudoActivation();
    if (next.paid) return { paid: true as const, initPoint: row.initPoint };
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return { paid: false as const, initPoint: row.initPoint };
}
