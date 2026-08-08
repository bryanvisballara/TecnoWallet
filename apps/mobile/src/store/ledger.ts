import { create } from 'zustand';

import {
  emptySnapshot,
  ownerSelf,
  seedLedgers,
  seedSnapshots,
  type LedgerMeta,
  type LedgerSnapshot,
} from '@/data/ledgers';
import type { Transaction } from '@/data/demo';
import { mutateOffline } from '@/services/api';
import { localStorage } from '@/services/persistence';

type NewTransaction = Omit<Transaction, 'id' | 'date' | 'icon'> & { date?: string; icon?: string };

type PersistedLedgerState = {
  ledgers: LedgerMeta[];
  activeLedgerId: string;
  snapshots: Record<string, LedgerSnapshot>;
};

type LedgerState = PersistedLedgerState & {
  pendingIds: string[];
  hydrate: () => Promise<void>;
  setActiveLedger: (id: string) => Promise<void>;
  createLedger: (name: string, color?: string) => Promise<string>;
  inviteMember: (ledgerId: string, email: string, name?: string) => Promise<void>;
  removeMember: (ledgerId: string, memberId: string) => Promise<void>;
  renameLedger: (ledgerId: string, name: string) => Promise<void>;
  addTransaction: (value: NewTransaction) => Promise<Transaction>;
};

const DEFAULT_ID = 'hogar';
const colors = ['#F5C518', '#F04438', '#06AED4', '#0878F9', '#12B76A', '#7F56D9', '#EE46BC'];

async function persist(state: PersistedLedgerState) {
  await localStorage.set('ledgers-v1', state);
}

function activeSlice(state: PersistedLedgerState) {
  return state.snapshots[state.activeLedgerId] ?? emptySnapshot();
}

const SEED_LEDGER_IDS = new Set(['hogar', 'teach-me', 'amazon']);

/** Clear leftover demo budgets on unused user-created books (old emptySnapshot used 500). */
function scrubUnusedBookSnapshots(
  ledgers: LedgerMeta[],
  snapshots: Record<string, LedgerSnapshot>,
): Record<string, LedgerSnapshot> {
  const next = { ...snapshots };
  ledgers.forEach((ledger) => {
    if (SEED_LEDGER_IDS.has(ledger.id)) return;
    const snap = next[ledger.id];
    if (!snap) return;
    const unused =
      snap.transactions.length === 0 &&
      snap.envelopes.every((item) => item.spent === 0) &&
      snap.accounts.every((item) => item.balance === 0);
    if (!unused) return;
    next[ledger.id] = {
      ...snap,
      summary: { ...emptySnapshot().summary },
      upcoming: [],
      envelopes: snap.envelopes.map((item) => ({ ...item, budget: 0, spent: 0 })),
    };
  });
  return next;
}

/** Backfill createdBy on known seed transactions so team alerts work after updates. */
function enrichTeamAuthorship(
  snapshots: Record<string, LedgerSnapshot>,
): Record<string, LedgerSnapshot> {
  const next = { ...snapshots };
  Object.entries(seedSnapshots).forEach(([ledgerId, seed]) => {
    const snap = next[ledgerId];
    if (!snap) return;
    const byId = new Map(seed.transactions.map((item) => [item.id, item.createdBy]));
    next[ledgerId] = {
      ...snap,
      transactions: snap.transactions.map((tx) =>
        tx.createdBy || !byId.get(tx.id) ? tx : { ...tx, createdBy: byId.get(tx.id) },
      ),
    };
  });
  return next;
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  ledgers: seedLedgers,
  activeLedgerId: DEFAULT_ID,
  snapshots: seedSnapshots,
  pendingIds: [],

  hydrate: async () => {
    const saved = await localStorage.get<PersistedLedgerState | null>('ledgers-v1', null);
    if (!saved?.ledgers?.length || !saved.snapshots || !saved.activeLedgerId) {
      const initial = {
        ledgers: seedLedgers,
        activeLedgerId: DEFAULT_ID,
        snapshots: seedSnapshots,
      };
      await persist(initial);
      set({ ...initial, pendingIds: [] });
      return;
    }
    const activeLedgerId = saved.ledgers.some((item) => item.id === saved.activeLedgerId)
      ? saved.activeLedgerId
      : saved.ledgers[0].id;
    const snapshots = enrichTeamAuthorship(
      scrubUnusedBookSnapshots(saved.ledgers, saved.snapshots),
    );
    const next = {
      ledgers: saved.ledgers,
      activeLedgerId,
      snapshots,
    };
    await persist(next);
    set({ ...next, pendingIds: [] });
  },

  setActiveLedger: async (id) => {
    if (!get().snapshots[id]) return;
    const next = {
      ledgers: get().ledgers,
      activeLedgerId: id,
      snapshots: get().snapshots,
    };
    set({ activeLedgerId: id });
    await persist(next);
  },

  createLedger: async (name, color) => {
    const id = `ledger-${Date.now()}`;
    const ledger: LedgerMeta = {
      id,
      name: name.trim() || 'Nuevo libro',
      color: color ?? colors[get().ledgers.length % colors.length],
      icon: 'wallet.pass.fill',
      type: 'personal',
      members: [{ ...ownerSelf }],
    };
    const next = {
      ledgers: [...get().ledgers, ledger],
      activeLedgerId: id,
      snapshots: { ...get().snapshots, [id]: emptySnapshot() },
    };
    set({ ...next, pendingIds: [] });
    await persist(next);
    return id;
  },

  inviteMember: async (ledgerId, email, name) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) throw new Error('Correo inválido.');
    const ledgers = get().ledgers.map((ledger) => {
      if (ledger.id !== ledgerId) return ledger;
      if (ledger.members.some((member) => member.email === trimmed)) return ledger;
      return {
        ...ledger,
        type: 'shared' as const,
        members: [
          ...ledger.members,
          {
            id: `m-${Date.now()}`,
            name: name?.trim() || trimmed.split('@')[0],
            email: trimmed,
            role: 'member' as const,
          },
        ],
      };
    });
    const next = { ledgers, activeLedgerId: get().activeLedgerId, snapshots: get().snapshots };
    set({ ledgers });
    await persist(next);
  },

  removeMember: async (ledgerId, memberId) => {
    if (memberId === 'me') return;
    const ledgers = get().ledgers.map((ledger) => {
      if (ledger.id !== ledgerId) return ledger;
      const members = ledger.members.filter((member) => member.id !== memberId);
      return {
        ...ledger,
        members,
        type: members.length > 1 ? ('shared' as const) : ('personal' as const),
      };
    });
    const next = { ledgers, activeLedgerId: get().activeLedgerId, snapshots: get().snapshots };
    set({ ledgers });
    await persist(next);
  },

  renameLedger: async (ledgerId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ledgers = get().ledgers.map((ledger) =>
      ledger.id === ledgerId ? { ...ledger, name: trimmed } : ledger,
    );
    const next = { ledgers, activeLedgerId: get().activeLedgerId, snapshots: get().snapshots };
    set({ ledgers });
    await persist(next);
  },

  addTransaction: async (value) => {
    const ledgerId = get().activeLedgerId;
    const slice = activeSlice(get());
    const optimistic: Transaction = {
      ...value,
      id: `local-${Date.now()}`,
      date: value.date ?? 'Ahora',
      icon: value.icon ?? (value.amount > 0 ? 'arrow.down.circle.fill' : 'banknote.fill'),
    };
    const beforeTx = slice.transactions;
    const nextTx = [optimistic, ...beforeTx];
    const incomeDelta = value.amount > 0 ? value.amount : 0;
    const expenseDelta = value.amount < 0 ? Math.abs(value.amount) : 0;
    const summary = {
      ...slice.summary,
      income: slice.summary.income + incomeDelta,
      expenses: slice.summary.expenses + expenseDelta,
      remaining: slice.summary.remaining + value.amount,
      total: slice.summary.total + value.amount,
    };
    const snapshots = {
      ...get().snapshots,
      [ledgerId]: { ...slice, transactions: nextTx, summary },
    };
    set({
      snapshots,
      pendingIds: [...get().pendingIds, optimistic.id],
    });
    await persist({
      ledgers: get().ledgers,
      activeLedgerId: ledgerId,
      snapshots,
    });
    try {
      const result = await mutateOffline<Transaction>({
        endpoint: '/transactions',
        method: 'POST',
        payload: { ...optimistic, workspaceId: ledgerId },
      });
      const committedTx = result.data
        ? get().snapshots[ledgerId].transactions.map((item) =>
            item.id === optimistic.id ? result.data! : item,
          )
        : get().snapshots[ledgerId].transactions;
      const committed = {
        ...get().snapshots,
        [ledgerId]: { ...get().snapshots[ledgerId], transactions: committedTx },
      };
      set({
        snapshots: committed,
        pendingIds: get().pendingIds.filter((id) => id !== optimistic.id),
      });
      await persist({
        ledgers: get().ledgers,
        activeLedgerId: get().activeLedgerId,
        snapshots: committed,
      });
      return result.data ?? optimistic;
    } catch (error) {
      const rolled = {
        ...get().snapshots,
        [ledgerId]: { ...slice, transactions: beforeTx },
      };
      set({
        snapshots: rolled,
        pendingIds: get().pendingIds.filter((id) => id !== optimistic.id),
      });
      await persist({
        ledgers: get().ledgers,
        activeLedgerId: get().activeLedgerId,
        snapshots: rolled,
      });
      throw error;
    }
  },
}));

export function useActiveLedger() {
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const ledger = ledgers.find((item) => item.id === activeLedgerId) ?? ledgers[0];
  const data = snapshots[activeLedgerId] ?? emptySnapshot();
  return { ledger, ...data, activeLedgerId };
}
