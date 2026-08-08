import type { Account, Transaction } from '@/data/demo';

export const exportTimeRanges = [
  { id: 'all', label: 'Todo el Tiempo' },
  { id: 'year', label: 'Este Año' },
  { id: 'month', label: 'Este Mes' },
  { id: 'week', label: 'Esta Semana' },
  { id: 'custom', label: 'Personalizado' },
] as const;

export type ExportTimeRangeId = (typeof exportTimeRanges)[number]['id'];

const DEMO_TODAY = new Date(2026, 7, 5, 12, 0, 0);

export type ExportRowDate = { date: string; time: string; at: Date };

export function parseTransactionMoment(tx: Transaction, today = DEMO_TODAY): ExportRowDate {
  const raw = tx.date.trim();
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
  const hours = timeMatch ? Number(timeMatch[1]) : 12;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  let day = new Date(today);
  if (/^hoy/i.test(raw)) {
    day = new Date(today);
  } else if (/^ayer/i.test(raw)) {
    day = new Date(today);
    day.setDate(day.getDate() - 1);
  } else {
    const dayMatch = raw.match(/^(\d{1,2})\s*ago/i);
    if (dayMatch) {
      day = new Date(today.getFullYear(), today.getMonth(), Number(dayMatch[1]));
    }
  }

  day.setHours(hours, minutes, 0, 0);
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, '0');
  const dd = String(day.getDate()).padStart(2, '0');
  const hh = String(day.getHours()).padStart(2, '0');
  const mi = String(day.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}`, at: day };
}

function inTimeRange(
  at: Date,
  range: ExportTimeRangeId,
  today: Date,
  customFrom?: string,
  customTo?: string,
) {
  if (range === 'all') return true;

  if (range === 'custom') {
    if (!customFrom && !customTo) return true;
    const start = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0);
    const end = customTo ? new Date(`${customTo}T23:59:59`) : new Date(8640000000000000);
    return at >= start && at <= end;
  }

  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  if (range === 'week') {
    start.setDate(start.getDate() - start.getDay());
  } else if (range === 'month') {
    start.setDate(1);
  } else if (range === 'year') {
    start.setMonth(0, 1);
  }

  return at >= start && at <= today;
}

function formatPrice(amount: number) {
  const absolute = Math.abs(amount);
  const fixed = Number.isInteger(absolute) ? String(absolute) : absolute.toFixed(2);
  const [whole, decimal] = fixed.split('.');
  const withThousands = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal ? `${withThousands}.${decimal}` : withThousands;
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(value)) return `"${value}"`;
  return value;
}

export function buildBudgetCsv(options: {
  accounts: Account[];
  transactions: Transaction[];
  accountIds: string[];
  range: ExportTimeRangeId;
  customFrom?: string;
  customTo?: string;
  recorder?: string;
  ledgerName?: string;
  currency?: string;
}) {
  const selectedNames = new Set(
    options.accounts.filter((account) => options.accountIds.includes(account.id)).map((account) => account.name),
  );
  const today = DEMO_TODAY;
  const header = [
    'Libro Mayor',
    'Categoría',
    'Subcategoría',
    'Moneda',
    'Precio',
    'Cuenta',
    'Grabadora',
    'Fecha',
    'Tiempo',
    'Etiqueta',
    'Nota',
    'Transacción',
  ];

  const rows = options.transactions
    .map((tx) => {
      const moment = parseTransactionMoment(tx, today);
      return { tx, moment };
    })
    .filter(({ tx, moment }) => {
      if (!selectedNames.has(tx.account)) return false;
      return inTimeRange(moment.at, options.range, today, options.customFrom, options.customTo);
    })
    .sort((a, b) => b.moment.at.getTime() - a.moment.at.getTime())
    .map(({ tx, moment }) => {
      const cells = [
        options.ledgerName ?? 'Personal',
        tx.category,
        '',
        options.currency ?? 'USD',
        formatPrice(tx.amount),
        tx.account,
        options.recorder ?? 'Alex Rivera',
        moment.date,
        moment.time,
        (tx.tags ?? []).join('; '),
        tx.note ?? '',
        tx.amount >= 0 ? 'Ingresos' : 'Gastos',
      ];
      return cells.map(csvCell).join(',');
    });

  return [header.join(','), ...rows].join('\n');
}

export function exportFileName(range: ExportTimeRangeId) {
  const stamp = DEMO_TODAY.toISOString().slice(0, 10);
  return `TecnoWallet-${range}-${stamp}.csv`;
}
