import type { Transaction } from '@/data/demo';

const MONTH_SHORT: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

export type MonthCursor = { year: number; month: number };

export function monthFromDate(date = new Date()): MonthCursor {
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function formatMonthLabel(
  { year, month }: MonthCursor,
  style: 'long' | 'short' = 'long',
  locale: string = 'es',
) {
  const tag = locale === 'es' ? 'es-ES' : 'en-US';
  const label = new Intl.DateTimeFormat(tag, {
    month: style,
    year: 'numeric',
  }).format(new Date(year, month, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const date = new Date(cursor.year, cursor.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function isSameMonth(a: MonthCursor, b: MonthCursor) {
  return a.year === b.year && a.month === b.month;
}

export function parseTransactionDate(tx: Transaction, today = new Date()): Date {
  if (tx.occurredAt) {
    const isoDate = new Date(tx.occurredAt);
    if (!Number.isNaN(isoDate.getTime())) return isoDate;
  }

  const raw = tx.date.trim();
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
  const hours = timeMatch ? Number(timeMatch[1]) : 12;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  let day = new Date(today);

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    day = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  } else if (/^(hoy|ahora)/i.test(raw)) {
    day = new Date(today);
  } else if (/^ayer/i.test(raw)) {
    day = new Date(today);
    day.setDate(day.getDate() - 1);
  } else {
    const dayMonth = raw.match(/^(\d{1,2})\s*([a-zA-Záéíóúñ]{3})/i);
    if (dayMonth) {
      const monthKey = dayMonth[2].slice(0, 3).toLowerCase();
      const monthIndex = MONTH_SHORT[monthKey] ?? today.getMonth();
      day = new Date(today.getFullYear(), monthIndex, Number(dayMonth[1]));
    }
  }

  day.setHours(hours, minutes, 0, 0);
  return day;
}

export function transactionInMonth(
  tx: Transaction,
  cursor: MonthCursor,
  today = new Date(),
) {
  const at = parseTransactionDate(tx, today);
  return at.getFullYear() === cursor.year && at.getMonth() === cursor.month;
}

export function filterTransactionsByMonth(
  transactions: Transaction[],
  cursor: MonthCursor,
  today = new Date(),
) {
  return transactions.filter((tx) => transactionInMonth(tx, cursor, today));
}

export function monthTotals(transactions: Transaction[]) {
  return transactions.reduce(
    (acc, item) => {
      if (item.amount > 0) acc.income += item.amount;
      else acc.expenses += Math.abs(item.amount);
      return acc;
    },
    { income: 0, expenses: 0 },
  );
}
