import type { Account, Transaction } from '@/data/demo';

const TEAM_ACCOUNT_LABEL = 'cuenta del equipo';

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

function isUnassignedAccount(name: string) {
  return !name.trim() || name.trim().toLowerCase() === TEAM_ACCOUNT_LABEL;
}

/**
 * Saldo visible = movimientos del libro (no el balanceMinor guardado, que
 * se queda viejo en libros compartidos). Si la cuenta no tiene movimientos,
 * se respeta el saldo inicial que escribió el usuario.
 */
export function applyLedgerAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
): Account[] {
  if (accounts.length === 0) return accounts;

  const netByName = new Map<string, number>();
  let unmatched = 0;

  for (const tx of transactions) {
    const name = tx.account?.trim() ?? '';
    if (isUnassignedAccount(name)) {
      unmatched += tx.amount;
      continue;
    }
    netByName.set(name, (netByName.get(name) ?? 0) + tx.amount);
  }

  const liquid = accounts.filter((item) => isLiquidAccount(item.kind));
  const knownNames = new Set(accounts.map((item) => item.name));
  if (liquid.length === 1) {
    const only = liquid[0].name;
    let extra = unmatched;
    for (const [name, net] of netByName) {
      if (!knownNames.has(name)) extra += net;
    }
    if (extra !== 0) {
      netByName.set(only, (netByName.get(only) ?? 0) + extra);
    }
    for (const name of [...netByName.keys()]) {
      if (name !== only && !knownNames.has(name)) netByName.delete(name);
    }
  }

  return accounts.map((account) => {
    if (!netByName.has(account.name)) return account;
    return { ...account, balance: netByName.get(account.name)! };
  });
}
