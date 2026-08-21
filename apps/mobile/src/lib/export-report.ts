import { getActiveMoneyCurrency, money, type Account, type Envelope, type Transaction } from '@/data/demo';
import { isWealthDebt } from '@/lib/accounts';
import { parseTransactionDate } from '@/lib/dates';

export const exportTimeRanges = [
  { id: 'all', label: 'Todo el tiempo' },
  { id: 'year', label: 'Este año' },
  { id: 'month', label: 'Este mes' },
  { id: 'week', label: 'Esta semana' },
  { id: 'custom', label: 'Personalizado' },
] as const;

export type ExportTimeRangeId = (typeof exportTimeRanges)[number]['id'];
export type ExportFormat = 'xlsx' | 'pdf';
export type ExportKind = 'Ingreso' | 'Gasto';

export type ExportMovement = {
  title: string;
  category: string;
  envelope: string;
  envelopeKind: Envelope['kind'] | 'otro';
  account: string;
  amount: number;
  signedAmount: number;
  kind: ExportKind;
  date: string;
  time: string;
  note: string;
  recorder: string;
};

export type ExportAccountGroup = 'asset' | 'debt';

export type ExportAccountRow = {
  name: string;
  kind: string;
  group: ExportAccountGroup;
  balance: number;
  income: number;
  expense: number;
};

export type ExportEnvelopeRow = {
  name: string;
  kind: Envelope['kind'];
  count: number;
  periodTotal: number;
  envelopeTotal: number;
  budget: number;
};

export type ExportReport = {
  ledgerName: string;
  recorder: string;
  currency: string;
  rangeLabel: string;
  generatedAt: string;
  accountNames: string[];
  movements: ExportMovement[];
  accounts: ExportAccountRow[];
  assets: ExportAccountRow[];
  debts: ExportAccountRow[];
  incomeEnvelopes: ExportEnvelopeRow[];
  expenseEnvelopes: ExportEnvelopeRow[];
  savingsEnvelopes: ExportEnvelopeRow[];
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  assetsTotal: number;
  debtsTotal: number;
  netWorth: number;
  accountsBalance: number;
};

function inTimeRange(
  at: Date,
  range: ExportTimeRangeId,
  today: Date,
  customFrom?: string,
  customTo?: string,
) {
  if (range === 'all') return true;
  if (range === 'custom') {
    const start = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0);
    const end = customTo ? new Date(`${customTo}T23:59:59`) : new Date(8640000000000000);
    return at >= start && at <= end;
  }
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - start.getDay());
  else if (range === 'month') start.setDate(1);
  else if (range === 'year') start.setMonth(0, 1);
  return at >= start && at <= today;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDate(at: Date) {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

function formatTime(at: Date) {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function rangeLabel(
  range: ExportTimeRangeId,
  customFrom?: string,
  customTo?: string,
) {
  if (range === 'custom') {
    return `${customFrom || '…'} → ${customTo || '…'}`;
  }
  return exportTimeRanges.find((item) => item.id === range)?.label ?? 'Periodo';
}

function resolveEnvelope(tx: Transaction, envelopes: Envelope[]) {
  if (tx.envelopeId) {
    const byId = envelopes.find((item) => item.id === tx.envelopeId);
    if (byId) return byId;
  }
  const byName = envelopes.find((item) => item.name === tx.category);
  if (byName) return byName;
  return envelopes.find((item) => item.name === tx.title);
}

function movementKind(tx: Transaction, envelope?: Envelope): ExportKind {
  if (envelope?.kind === 'income') return 'Ingreso';
  if (envelope?.kind === 'expense' || envelope?.kind === 'savings') return 'Gasto';
  const label = `${tx.category} ${tx.title}`.toLowerCase();
  if (/\b(ingreso|ingresos|nomina|nómina|sueldo|salario|income)\b/.test(label)) {
    return 'Ingreso';
  }
  return tx.amount >= 0 ? 'Ingreso' : 'Gasto';
}

function accountGroup(account: Pick<Account, 'kind' | 'balance'>): ExportAccountGroup {
  return isWealthDebt(account) ? 'debt' : 'asset';
}

function namesMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function emptyEnvelopeRow(envelope: Envelope): ExportEnvelopeRow {
  return {
    name: envelope.name,
    kind: envelope.kind,
    count: 0,
    periodTotal: 0,
    envelopeTotal: 0,
    budget: Math.abs(envelope.budget || 0),
  };
}

export function buildExportReport(options: {
  accounts: Account[];
  transactions: Transaction[];
  envelopes?: Envelope[];
  accountIds: string[];
  range: ExportTimeRangeId;
  customFrom?: string;
  customTo?: string;
  ledgerName?: string;
  recorder?: string;
  currency?: string;
}): ExportReport {
  const today = new Date();
  const selected = options.accounts.filter((account) => options.accountIds.includes(account.id));
  const selectedNames = new Set(selected.map((account) => account.name));
  const envelopes = options.envelopes ?? [];
  const currency = options.currency || getActiveMoneyCurrency() || 'COP';
  const recorder = options.recorder?.trim() || 'Usuario';

  const movements = options.transactions
    .map((tx) => {
      const at = parseTransactionDate(tx, today);
      return { tx, at, envelope: resolveEnvelope(tx, envelopes) };
    })
    .filter(({ tx, at, envelope }) => {
      const accountHit = [...selectedNames].some((name) => namesMatch(name, tx.account));
      const envelopeHit = Boolean(envelope);
      return (accountHit || envelopeHit) && inTimeRange(at, options.range, today, options.customFrom, options.customTo);
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map(({ tx, at, envelope }) => {
      const kind = movementKind(tx, envelope);
      const amount = Math.abs(tx.amount);
      return {
        title: tx.title,
        category: envelope?.name || tx.category || 'Sin sobre',
        envelope: envelope?.name || tx.category || 'Sin sobre',
        envelopeKind: envelope?.kind ?? 'otro',
        account: tx.account,
        amount,
        signedAmount: kind === 'Ingreso' ? amount : -amount,
        kind,
        date: formatDate(at),
        time: formatTime(at),
        note: tx.note ?? '',
        recorder: tx.createdBy?.trim() || recorder,
      } satisfies ExportMovement;
    });

  const incomeFromMovements = movements
    .filter((item) => item.kind === 'Ingreso')
    .reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = movements
    .filter((item) => item.kind === 'Gasto')
    .reduce((sum, item) => sum + item.amount, 0);

  const accountRows = selected.map((account) => {
    const rows = movements.filter((item) => namesMatch(item.account, account.name));
    return {
      name: account.name,
      kind: account.kind,
      group: accountGroup(account),
      balance: account.balance,
      income: rows.filter((item) => item.kind === 'Ingreso').reduce((sum, item) => sum + item.amount, 0),
      expense: rows.filter((item) => item.kind === 'Gasto').reduce((sum, item) => sum + item.amount, 0),
    } satisfies ExportAccountRow;
  });
  const assets = accountRows.filter((item) => item.group === 'asset');
  const debts = accountRows.filter((item) => item.group === 'debt');
  const assetsTotal = assets.reduce((sum, item) => sum + item.balance, 0);
  const debtsTotal = debts.reduce((sum, item) => sum + Math.abs(item.balance), 0);

  const rollup = (kind: Envelope['kind']) => {
    const rows = new Map<string, ExportEnvelopeRow>();
    envelopes
      .filter((item) => item.kind === kind)
      .forEach((item) => rows.set(item.name, emptyEnvelopeRow(item)));

    movements
      .filter((item) =>
        kind === 'income'
          ? item.kind === 'Ingreso'
          : item.kind === 'Gasto' && (item.envelopeKind === kind || (kind === 'expense' && item.envelopeKind === 'otro')),
      )
      .forEach((item) => {
        const current = rows.get(item.envelope) ?? {
          name: item.envelope,
          kind,
          count: 0,
          periodTotal: 0,
          envelopeTotal: 0,
          budget: 0,
        };
        current.count += 1;
        current.periodTotal += item.amount;
        current.envelopeTotal = current.periodTotal;
        rows.set(item.envelope, current);
      });

    return [...rows.values()].sort((a, b) => b.periodTotal - a.periodTotal || a.name.localeCompare(b.name, 'es'));
  };

  const incomeEnvelopes = rollup('income');
  const expenseEnvelopes = rollup('expense');
  const savingsEnvelopes = rollup('savings');
  const incomeTotal = incomeFromMovements;

  return {
    ledgerName: options.ledgerName?.trim() || 'Hogar',
    recorder,
    currency,
    rangeLabel: rangeLabel(options.range, options.customFrom, options.customTo),
    generatedAt: `${formatDate(today)} ${formatTime(today)}`,
    accountNames: selected.map((account) => account.name),
    movements,
    accounts: accountRows,
    assets,
    debts,
    incomeEnvelopes,
    expenseEnvelopes,
    savingsEnvelopes,
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
    assetsTotal,
    debtsTotal,
    netWorth: assetsTotal - debtsTotal,
    accountsBalance: assetsTotal - debtsTotal,
  };
}

export function formatMoney(value: number, currency?: string) {
  const code = currency || getActiveMoneyCurrency() || 'COP';
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return money(value);
  }
}

/** ASCII-safe money for PDF (avoids NBSP / locale symbols that Helvetica drops). */
export function formatPdfMoney(value: number, currency?: string) {
  const code = currency || getActiveMoneyCurrency() || 'COP';
  const digits = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  return `${code} ${digits}`;
}

export function exportFileName(range: ExportTimeRangeId, format: ExportFormat) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `TecnoWallet-${range}-${stamp}.${format}`;
}
