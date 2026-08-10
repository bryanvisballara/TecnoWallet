import { create } from 'zustand';

import { apiRequest } from '@/services/api';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';

export type BankConnection = {
  id: string;
  workspaceId: string;
  provider: 'belvo';
  belvoLinkId: string;
  institutionName: string;
  institutionCode?: string;
  status: string;
  lastSyncedAt: string | null;
};

export type PendingBankTx = {
  id: string;
  workspaceId: string;
  connectionId: string;
  description: string;
  merchantName?: string;
  amountMinor: number;
  currency: string;
  kind: 'income' | 'expense';
  occurredAt: string;
  status: string;
  ledgerTransactionId: string | null;
};

type BankState = {
  connections: BankConnection[];
  pending: PendingBankTx[];
  loading: boolean;
  error?: string;
  refresh: (workspaceId: string) => Promise<void>;
  createWidgetToken: (
    workspaceId: string,
  ) => Promise<{ access: string; widgetUrl: string }>;
  registerLink: (input: {
    workspaceId: string;
    belvoLinkId: string;
    institutionName?: string;
    institutionCode?: string;
  }) => Promise<BankConnection>;
  sync: (workspaceId: string) => Promise<{ importedPending: number }>;
  confirmPending: (id: string) => Promise<void>;
  dismissPending: (id: string) => Promise<void>;
};

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Error bancario';
}

export const useBankStore = create<BankState>((set, get) => ({
  connections: [],
  pending: [],
  loading: false,

  refresh: async (workspaceId) => {
    if (!workspaceId) {
      set({ connections: [], pending: [], loading: false });
      return;
    }
    set({ loading: true, error: undefined });
    try {
      const [connections, pending] = await Promise.all([
        apiRequest<BankConnection[]>(
          `/bank/connections?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
        apiRequest<PendingBankTx[]>(
          `/bank/pending?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
      ]);
      set({ connections, pending, loading: false });
    } catch (error) {
      const message = messageFrom(error);
      const notDeployed =
        /Cannot GET \/api\/v1\/bank/i.test(message) ||
        (error instanceof Error &&
          'status' in error &&
          Number((error as { status?: number }).status) === 404);
      set({
        connections: [],
        pending: [],
        loading: false,
        error: notDeployed
          ? 'La API de bancos aún no está desplegada en Render. Espera el deploy o vuelve a intentar en unos minutos.'
          : message,
      });
    }
  },

  createWidgetToken: async (workspaceId) => {
    return apiRequest<{ access: string; widgetUrl: string }>(
      '/bank/belvo/widget-token',
      {
        method: 'POST',
        body: JSON.stringify({ workspaceId }),
      },
    );
  },

  registerLink: async (input) => {
    const connection = await apiRequest<BankConnection>('/bank/belvo/links', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await get().refresh(input.workspaceId);
    return connection;
  },

  sync: async (workspaceId) => {
    const result = await apiRequest<{ importedPending: number }>('/bank/sync', {
      method: 'POST',
      body: JSON.stringify({ workspaceId }),
    });
    await get().refresh(workspaceId);
    return result;
  },

  confirmPending: async (id) => {
    const ledgerId = useLedgerStore.getState().activeLedgerId;
    const clearingId = useLedgerStore.getState().clearingIds[ledgerId];
    const accounts = useLedgerStore.getState().snapshots[ledgerId]?.accounts ?? [];
    const account = accounts[0];
    if (!account || !clearingId) {
      throw new Error('Necesitas una cuenta en el libro para registrar el gasto.');
    }
    await apiRequest(`/bank/pending/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        accountId: account.id,
        clearingAccountId: clearingId,
      }),
    });
    await useLedgerStore.getState().hydrate();
    if (ledgerId) await get().refresh(ledgerId);
  },

  dismissPending: async (id) => {
    await apiRequest(`/bank/pending/${id}/dismiss`, { method: 'POST' });
    const ledgerId = useLedgerStore.getState().activeLedgerId;
    if (ledgerId) await get().refresh(ledgerId);
  },
}));

export function useBankWorkspaceId() {
  const { activeLedgerId } = useActiveLedger();
  return activeLedgerId;
}
