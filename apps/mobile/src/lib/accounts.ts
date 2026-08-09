import type { Account } from '@/data/demo';

/** Cuentas bancarias / efectivo que forman la liquidez. */
export function isLiquidAccount(kind: string) {
  const value = kind.toLowerCase();
  if (value.includes('sin cuenta')) return false;
  if (value.includes('invers')) return false;
  if (value.includes('préstamo') || value.includes('prestamo')) return false;
  if (value.includes('hipoteca')) return false;
  if (value.includes('pasivo')) return false;
  if (value.includes('crédit') || value.includes('credit')) return false;
  return true;
}

/** Bienes / activos no líquidos (casa, inversión, etc.). */
export function isWealthAsset(account: Pick<Account, 'kind' | 'balance'>) {
  return !isLiquidAccount(account.kind) && account.balance >= 0;
}

/** Deudas y pasivos (tarjeta, préstamo, hipoteca…). */
export function isWealthDebt(account: Pick<Account, 'kind' | 'balance'>) {
  return !isLiquidAccount(account.kind) && account.balance < 0;
}

export function sumBalances(items: Account[]) {
  return items.reduce((sum, item) => sum + item.balance, 0);
}
