import type { Transaction } from '@/data/demo';
import { useLedgerStore } from '@/store/ledger';

type NewTransaction = Omit<Transaction, 'id' | 'date' | 'icon'> & { date?: string; icon?: string };

/** Compatibility layer: transactions always belong to the active ledger. */
export function useFinanceStore(): {
  transactions: Transaction[];
  pendingIds: string[];
  hydrate: () => Promise<void>;
  addTransaction: (value: NewTransaction) => Promise<Transaction>;
};
export function useFinanceStore<T>(
  selector: (state: {
    transactions: Transaction[];
    pendingIds: string[];
    hydrate: () => Promise<void>;
    addTransaction: (value: NewTransaction) => Promise<Transaction>;
  }) => T,
): T;
export function useFinanceStore<T>(selector?: (state: any) => T) {
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const pendingIds = useLedgerStore((state) => state.pendingIds);
  const hydrate = useLedgerStore((state) => state.hydrate);
  const addTransaction = useLedgerStore((state) => state.addTransaction);
  const state = {
    transactions: snapshots[activeLedgerId]?.transactions ?? [],
    pendingIds,
    hydrate,
    addTransaction,
  };
  return selector ? selector(state) : state;
}
