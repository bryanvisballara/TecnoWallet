import type { Transaction } from '@/data/demo';
import { useLedgerStore } from '@/store/ledger';

type NewTransaction = Omit<Transaction, 'id' | 'date' | 'icon'> & { date?: string; icon?: string };
const EMPTY_TX: Transaction[] = [];

/** Compatibility layer: transactions always belong to the active ledger. */
export function useFinanceStore(): {
  transactions: Transaction[];
  pendingIds: string[];
  hydrate: () => Promise<void>;
  addTransaction: (value: NewTransaction) => Promise<Transaction>;
  updateTransaction: (
    transactionId: string,
    value: NewTransaction,
  ) => Promise<Transaction>;
  voidTransaction: (transactionId: string) => Promise<void>;
};
export function useFinanceStore<T>(
  selector: (state: {
    transactions: Transaction[];
    pendingIds: string[];
    hydrate: () => Promise<void>;
    addTransaction: (value: NewTransaction) => Promise<Transaction>;
    updateTransaction: (
      transactionId: string,
      value: NewTransaction,
    ) => Promise<Transaction>;
    voidTransaction: (transactionId: string) => Promise<void>;
  }) => T,
): T;
export function useFinanceStore<T>(selector?: (state: any) => T) {
  const transactions = useLedgerStore(
    (state) => state.snapshots[state.activeLedgerId]?.transactions ?? EMPTY_TX,
  );
  const pendingIds = useLedgerStore((state) => state.pendingIds);
  const hydrate = useLedgerStore((state) => state.hydrate);
  const addTransaction = useLedgerStore((state) => state.addTransaction);
  const updateTransaction = useLedgerStore((state) => state.updateTransaction);
  const voidTransaction = useLedgerStore((state) => state.voidTransaction);
  const state = {
    transactions,
    pendingIds,
    hydrate,
    addTransaction,
    updateTransaction,
    voidTransaction,
  };
  return selector ? selector(state) : state;
}
