import type { Transaction } from '@/data/demo';
import type { PlanningItem } from '@/data/ledgers';
import { filterTransactionsByMonth } from '@/lib/dates';

export type RecurringBucket = PlanningItem['bucket'];

export type RecurringLineSource = 'planning' | 'transaction' | 'upcoming';

export type RecurringLine = {
  id: string;
  name: string;
  amount: number;
  bucket: RecurringBucket;
  icon: string;
  subtitle: string;
  /** Origin so swipe edit/delete can route to the right CRUD. */
  source: RecurringLineSource;
};

const subscriptionHint = /(suscrip|netflix|spotify|icloud|prime|disney|hbo|youtube|apple|adobe|gym)/i;
const billHint = /(factura|alquiler|renta|luz|agua|gas|internet|seguro|tel[eé]fono|hipoteca|servicio)/i;

function classifyExpense(tx: Transaction): Exclude<RecurringBucket, 'income'> {
  const haystack = `${tx.title} ${tx.category}`;
  if (subscriptionHint.test(haystack) || /suscrip/i.test(tx.category)) return 'subscription';
  if (billHint.test(haystack)) return 'bill';
  return 'recurring';
}

function iconFor(bucket: RecurringBucket, fallback: string) {
  if (bucket === 'income') return 'arrow.down.circle.fill';
  if (bucket === 'bill') return 'doc.text.fill';
  if (bucket === 'subscription') return 'repeat';
  return fallback || 'arrow.clockwise';
}

function bucketLabel(bucket: RecurringBucket) {
  if (bucket === 'income') return 'Ingreso recurrente';
  if (bucket === 'bill') return 'Factura';
  if (bucket === 'subscription') return 'Suscripción';
  return 'Gasto recurrente';
}

function pushLine(
  target: {
    income: RecurringLine[];
    bills: RecurringLine[];
    subscriptions: RecurringLine[];
    recurrings: RecurringLine[];
  },
  line: RecurringLine,
) {
  if (line.bucket === 'income') target.income.push(line);
  else if (line.bucket === 'bill') target.bills.push(line);
  else if (line.bucket === 'subscription') target.subscriptions.push(line);
  else target.recurrings.push(line);
}

/** Monthly recurring income/expense lines for a ledger period. */
export function buildRecurringCashflow(
  transactions: Transaction[],
  period: { year: number; month: number },
  upcoming: Array<{ name: string; date: string; amount: number; color: string }> = [],
  planning: PlanningItem[] = [],
): {
  income: RecurringLine[];
  bills: RecurringLine[];
  subscriptions: RecurringLine[];
  recurrings: RecurringLine[];
  incomeTotal: number;
  expenseTotal: number;
  net: number;
} {
  const income: RecurringLine[] = [];
  const bills: RecurringLine[] = [];
  const subscriptions: RecurringLine[] = [];
  const recurrings: RecurringLine[] = [];
  const buckets = { income, bills, subscriptions, recurrings };

  const seen = new Set<string>();

  for (const item of planning) {
    const key = item.name.trim().toLowerCase();
    if (key) seen.add(key);
    pushLine(buckets, {
      id: item.id,
      name: item.name,
      amount: Math.abs(item.amount),
      bucket: item.bucket,
      icon: item.icon || iconFor(item.bucket, 'arrow.clockwise'),
      subtitle: item.subtitle || bucketLabel(item.bucket),
      source: 'planning',
    });
  }

  const monthTx = filterTransactionsByMonth(transactions, period).filter((tx) => tx.recurring);
  for (const tx of monthTx) {
    const key = tx.title.trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    if (tx.amount > 0) {
      pushLine(buckets, {
        id: tx.id,
        name: tx.title,
        amount: tx.amount,
        bucket: 'income',
        icon: iconFor('income', tx.icon),
        subtitle: tx.category || 'Ingreso recurrente',
        source: 'transaction',
      });
      continue;
    }
    const bucket = classifyExpense(tx);
    pushLine(buckets, {
      id: tx.id,
      name: tx.title,
      amount: Math.abs(tx.amount),
      bucket,
      icon: iconFor(bucket, tx.icon),
      subtitle: tx.category || 'Gasto recurrente',
      source: 'transaction',
    });
  }

  for (const bill of upcoming) {
    const key = bill.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pushLine(buckets, {
      id: `upcoming-${key}`,
      name: bill.name,
      amount: Math.abs(bill.amount),
      bucket: 'bill',
      icon: 'doc.text.fill',
      subtitle: bill.date ? `Próximo · ${bill.date}` : 'Factura programada',
      source: 'upcoming',
    });
  }

  const incomeTotal = income.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal =
    bills.reduce((sum, item) => sum + item.amount, 0) +
    subscriptions.reduce((sum, item) => sum + item.amount, 0) +
    recurrings.reduce((sum, item) => sum + item.amount, 0);

  return {
    income,
    bills,
    subscriptions,
    recurrings,
    incomeTotal,
    expenseTotal,
    net: incomeTotal - expenseTotal,
  };
}
