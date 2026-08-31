import type { Envelope, Transaction } from '@/data/demo';
import { parseTransactionDate } from '@/lib/dates';

export type ActivityPeriod = 'week' | 'month' | 'custom';

export type CategorySlice = {
  name: string;
  amount: number;
  color: string;
  pct: number;
};

export type PeriodBucket = {
  key: string;
  label: string;
  fullLabel: string;
  start: Date;
  end: Date;
  expenseTotal: number;
  income: number;
};

const SLICE_COLORS = [
  '#F04438',
  '#0878F9',
  '#F79009',
  '#12B76A',
  '#7F56D9',
  '#EE46BC',
  '#06AED4',
  '#B54708',
  '#5925DC',
  '#0E9384',
  '#E04F16',
  '#98A2B3',
];

function normalizeColor(value: string) {
  return value.trim().toLowerCase();
}

function pickSliceColor(preferred: string | undefined, used: Set<string>, index: number) {
  if (preferred) {
    const key = normalizeColor(preferred);
    if (key && !used.has(key)) {
      used.add(key);
      return preferred;
    }
  }
  for (const color of SLICE_COLORS) {
    const key = normalizeColor(color);
    if (!used.has(key)) {
      used.add(key);
      return color;
    }
  }
  const hue = (index * 47) % 360;
  const fallback = `hsl(${hue} 72% 46%)`;
  used.add(normalizeColor(fallback));
  return fallback;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeekMonday(today: Date) {
  const day = startOfDay(today);
  const js = day.getDay();
  const offset = js === 0 ? -6 : 1 - js;
  day.setDate(day.getDate() + offset);
  return day;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function periodRange(input: {
  period: ActivityPeriod;
  weekAnchor: Date;
  year: number;
  month: number;
  customFrom: Date;
  customTo: Date;
}) {
  if (input.period === 'week') {
    const start = startOfWeekMonday(input.weekAnchor);
    return { start, end: addDays(start, 7) };
  }
  if (input.period === 'month') {
    return {
      start: new Date(input.year, input.month, 1),
      end: new Date(input.year, input.month + 1, 1),
    };
  }
  const from = startOfDay(input.customFrom);
  const to = startOfDay(input.customTo);
  const start = from <= to ? from : to;
  const end = addDays(from <= to ? to : from, 1);
  return { start, end };
}

export function filterTransactionsByRange(
  transactions: Transaction[],
  start: Date,
  end: Date,
  today = new Date(),
) {
  return transactions.filter((tx) => {
    const at = parseTransactionDate(tx, today);
    return at >= start && at < end;
  });
}

export function buildExpenseSlices(
  transactions: Transaction[],
  envelopes: Envelope[] = [],
  maxSlices = 5,
): CategorySlice[] {
  const totals = new Map<string, number>();
  transactions.forEach((tx) => {
    if (tx.amount >= 0) return;
    const name = tx.category.trim() || 'Otros';
    totals.set(name, (totals.get(name) ?? 0) + Math.abs(tx.amount));
  });

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return [];

  const head = ranked.slice(0, maxSlices);
  const rest = ranked.slice(maxSlices);
  const otherAmount = rest.reduce((sum, [, amount]) => sum + amount, 0);
  const rows = otherAmount > 0 ? [...head, ['Otros', otherAmount] as const] : head;
  const total = rows.reduce((sum, [, amount]) => sum + amount, 0);
  const usedColors = new Set<string>();

  return rows.map(([name, amount], index) => {
    const envelope = envelopes.find(
      (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
    );
    return {
      name,
      amount,
      color: pickSliceColor(envelope?.color, usedColors, index),
      pct: total > 0 ? amount / total : 0,
    };
  });
}

export function buildPeriodBuckets(
  transactions: Transaction[],
  start: Date,
  end: Date,
  locale: string,
  today = new Date(),
): PeriodBucket[] {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const daily = days <= 14;
  const tag = locale === 'es' ? 'es-CO' : 'en-US';
  const dayFmt = new Intl.DateTimeFormat(tag, { day: 'numeric', weekday: 'short' });
  const rangeFmt = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' });

  const buckets: PeriodBucket[] = [];
  if (daily) {
    for (let i = 0; i < days; i += 1) {
      const day = addDays(start, i);
      buckets.push({
        key: `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
        label: `${day.getDate()}`,
        fullLabel: dayFmt.format(day),
        start: day,
        end: addDays(day, 1),
        expenseTotal: 0,
        income: 0,
      });
    }
  } else {
    let cursor = new Date(start);
    let index = 1;
    while (cursor < end) {
      const chunkEnd = addDays(cursor, 7) < end ? addDays(cursor, 7) : end;
      const last = addDays(chunkEnd, -1);
      buckets.push({
        key: `w-${index}`,
        label: locale === 'es' ? `S${index}` : `W${index}`,
        fullLabel: `${rangeFmt.format(cursor)} – ${rangeFmt.format(last)}`,
        start: new Date(cursor),
        end: chunkEnd,
        expenseTotal: 0,
        income: 0,
      });
      cursor = chunkEnd;
      index += 1;
    }
  }

  transactions.forEach((tx) => {
    const at = parseTransactionDate(tx, today);
    if (at < start || at >= end) return;
    const offset = Math.floor((startOfDay(at).getTime() - startOfDay(start).getTime()) / 86_400_000);
    const index = daily ? offset : Math.min(buckets.length - 1, Math.floor(offset / 7));
    const bucket = buckets[index];
    if (!bucket) return;
    if (tx.amount >= 0) bucket.income += tx.amount;
    else bucket.expenseTotal += Math.abs(tx.amount);
  });

  return buckets;
}
