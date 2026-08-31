import type { Envelope, Transaction } from '@/data/demo';

export function foldEnvelopeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function envelopeKindForAmount(amount: number): Envelope['kind'] {
  return amount >= 0 ? 'income' : 'expense';
}

function scoreEnvelope(envelope: Envelope, title: string, category: string) {
  const name = foldEnvelopeLabel(envelope.name);
  if (name.length < 3) return 0;
  const cat = foldEnvelopeLabel(category);
  const text = foldEnvelopeLabel(title);
  if (cat && cat === name) return 120;
  if (text === name) return 110;
  if (text.includes(name)) return 80 + Math.min(name.length, 20);
  const words = text.split(' ').filter((word) => word.length >= 4);
  if (words.includes(name)) return 90;
  const hit = words.find((word) => {
    if (name === word) return true;
    if (name.startsWith(word) && word.length / name.length >= 0.72) return true;
    if (word.startsWith(name) && name.length / word.length >= 0.72) return true;
    return false;
  });
  return hit ? 50 + hit.length : 0;
}

export function resolveEnvelopeForTransaction(
  tx: Pick<Transaction, 'envelopeId' | 'category' | 'title' | 'amount'>,
  envelopes: Envelope[],
): Envelope | undefined {
  const id = tx.envelopeId?.trim().toLowerCase();
  if (id) {
    const byId = envelopes.find((item) => item.id.trim().toLowerCase() === id);
    if (byId) return byId;
  }
  const kind = envelopeKindForAmount(tx.amount);
  const pool = envelopes.filter((item) => item.kind === kind);
  const source = pool.length ? pool : envelopes;
  let best: Envelope | undefined;
  let bestScore = 0;
  for (const envelope of source) {
    const score = scoreEnvelope(envelope, tx.title, tx.category);
    if (score > bestScore) {
      best = envelope;
      bestScore = score;
    }
  }
  return bestScore >= 50 ? best : undefined;
}

/** Gasto/ingreso del sobre a partir del libro, no de spentMinor cacheado. */
export function applyLedgerEnvelopeSpent(
  envelopes: Envelope[],
  transactions: Transaction[],
): Envelope[] {
  const spentByEnvelopeId = new Map<string, number>();
  for (const tx of transactions) {
    const envelope = resolveEnvelopeForTransaction(tx, envelopes);
    if (!envelope) continue;
    spentByEnvelopeId.set(
      envelope.id,
      (spentByEnvelopeId.get(envelope.id) ?? 0) + Math.abs(tx.amount),
    );
  }
  return envelopes.map((item) => ({
    ...item,
    spent: spentByEnvelopeId.get(item.id) ?? 0,
  }));
}
