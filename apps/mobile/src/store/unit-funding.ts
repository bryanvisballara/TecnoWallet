import { create } from "zustand";

import { apiRequest } from "@/services/api";
import { useAuthStore } from "@/store/auth";

export type UnitIdentityStatus =
  | "none"
  | "pending"
  | "awaitingDocuments"
  | "approved"
  | "denied"
  | "canceled";

export type UnitIdentity = {
  unitApplicationId?: string;
  unitCustomerId?: string;
  status: UnitIdentityStatus;
};

export type UnitCounterparty = {
  id: string;
  unitCounterpartyId: string;
  name: string;
  bank?: string;
  accountType?: string;
  accountNumberMask?: string;
  verificationMethod?: string;
  active: boolean;
};

export type RecaudoBalances = {
  availableMinor: number;
  pendingMinor: number;
  processingMinor: number;
  failedMinor: number;
  inFlightMinor: number;
};

export type UnitWallet = {
  recaudoId: string;
  workspaceId?: string;
  unitWalletId?: string;
  unitCustomerId?: string;
  status: string;
  walletTerms?: string;
};

type FundResult = {
  intent: PaymentIntentSummary;
  balances: RecaudoBalances;
  idempotentReplay?: boolean;
};

export type PaymentIntentSummary = {
  id: string;
  status: string;
  amountMinor: number;
  direction: "inbound" | "outbound";
  note?: string;
};

type UnitFundingState = {
  identity: UnitIdentity;
  counterparties: UnitCounterparty[];
  walletsByRecaudo: Record<string, UnitWallet>;
  balancesByRecaudo: Record<string, RecaudoBalances>;
  loading: boolean;
  setupBusy: boolean;
  error?: string;
  refreshIdentity: () => Promise<UnitIdentity>;
  refreshCounterparties: () => Promise<UnitCounterparty[]>;
  refreshBalances: (recaudoId: string) => Promise<RecaudoBalances>;
  refreshWallet: (recaudoId: string) => Promise<UnitWallet | undefined>;
  bootstrapForRecaudo: (recaudoId: string) => Promise<void>;
  activatePayments: () => Promise<UnitIdentity>;
  ensureRecaudoWallet: (recaudoId: string) => Promise<UnitWallet>;
  /** @deprecated Use ensureRecaudoWallet */
  ensureWorkspaceWallet: (recaudoId: string) => Promise<UnitWallet>;
  linkBankAccount: (input: {
    name: string;
    routingNumber: string;
    accountNumber: string;
    accountType?: "Checking" | "Savings";
  }) => Promise<UnitCounterparty>;
  fundContribution: (input: {
    recaudoId: string;
    amountMinor: number;
    note?: string;
    counterpartyId?: string;
  }) => Promise<FundResult>;
  fundWithdrawal: (input: {
    recaudoId: string;
    amountMinor: number;
    note?: string;
    counterpartyId?: string;
  }) => Promise<FundResult>;
  syncSchedule: (recaudoId: string) => Promise<{
    scheduleId: string;
    frequency: string;
    driver: string;
    enabled: boolean;
    nextRunAt?: string;
    amountMinor: number;
  } | undefined>;
  isFundingReady: (recaudoId: string, isOrganizer: boolean) => boolean;
};

const emptyBalances: RecaudoBalances = {
  availableMinor: 0,
  pendingMinor: 0,
  processingMinor: 0,
  failedMinor: 0,
  inFlightMinor: 0,
};

function newIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

export const useUnitFundingStore = create<UnitFundingState>((set, get) => ({
  identity: { status: "none" },
  counterparties: [],
  walletsByRecaudo: {},
  balancesByRecaudo: {},
  loading: false,
  setupBusy: false,

  refreshIdentity: async () => {
    if (useAuthStore.getState().demo) {
      const identity: UnitIdentity = { status: "none" };
      set({ identity });
      return identity;
    }
    const identity = await apiRequest<UnitIdentity>("/unit/me");
    set({
      identity: {
        unitApplicationId: identity.unitApplicationId,
        unitCustomerId: identity.unitCustomerId,
        status: identity.status ?? "none",
      },
    });
    return get().identity;
  },

  refreshCounterparties: async () => {
    if (useAuthStore.getState().demo) {
      set({ counterparties: [] });
      return [];
    }
    const rows = await apiRequest<UnitCounterparty[]>("/unit/counterparties");
    set({ counterparties: rows });
    return rows;
  },

  refreshBalances: async (recaudoId) => {
    if (useAuthStore.getState().demo) {
      set((state) => ({
        balancesByRecaudo: {
          ...state.balancesByRecaudo,
          [recaudoId]: emptyBalances,
        },
      }));
      return emptyBalances;
    }
    const balances = await apiRequest<RecaudoBalances>(
      `/payments/recaudos/${recaudoId}/balances`,
    );
    set((state) => ({
      balancesByRecaudo: {
        ...state.balancesByRecaudo,
        [recaudoId]: balances,
      },
    }));
    return balances;
  },

  refreshWallet: async (recaudoId) => {
    if (useAuthStore.getState().demo) return undefined;
    const wallet = await apiRequest<UnitWallet>(
      `/unit/recaudos/${recaudoId}/wallet`,
    );
    if (!wallet.unitWalletId || wallet.status === "none") {
      set((state) => {
        const next = { ...state.walletsByRecaudo };
        delete next[recaudoId];
        return { walletsByRecaudo: next };
      });
      return undefined;
    }
    set((state) => ({
      walletsByRecaudo: {
        ...state.walletsByRecaudo,
        [recaudoId]: { ...wallet, recaudoId },
      },
    }));
    return get().walletsByRecaudo[recaudoId];
  },

  bootstrapForRecaudo: async (recaudoId) => {
    if (useAuthStore.getState().demo) return;
    set({ loading: true, error: undefined });
    try {
      await Promise.all([
        get().refreshIdentity(),
        get().refreshCounterparties(),
        get().refreshBalances(recaudoId),
        get().refreshWallet(recaudoId),
      ]);
      set({ loading: false });
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },

  activatePayments: async () => {
    if (useAuthStore.getState().demo) {
      throw new Error(
        "La cuenta de banco digital no está disponible en demo.",
      );
    }
    set({ setupBusy: true, error: undefined });
    try {
      const profile = useAuthStore.getState().profile;
      const identity = await apiRequest<UnitIdentity>("/unit/applications", {
        method: "POST",
        body: JSON.stringify({
          fullName: profile.name,
          phone: "5555550100",
          ssn: "000000000",
          dateOfBirth: "1990-01-01",
          address: {
            street: "20 Ingram St",
            city: "Forest Hills",
            state: "NY",
            postalCode: "11375",
            country: "US",
          },
        }),
      });
      set({
        identity: {
          unitApplicationId: identity.unitApplicationId,
          unitCustomerId: identity.unitCustomerId,
          status: identity.status ?? "pending",
        },
        setupBusy: false,
      });
      return get().identity;
    } catch (error) {
      set({ setupBusy: false, error: messageFrom(error) });
      throw error;
    }
  },

  ensureRecaudoWallet: async (recaudoId) => {
    if (useAuthStore.getState().demo) {
      throw new Error("La cuenta digital no está disponible en demo.");
    }
    const identity = get().identity.unitCustomerId
      ? get().identity
      : await get().refreshIdentity();
    if (!identity.unitCustomerId || identity.status !== "approved") {
      throw new Error(
        "Primero abre y aprueba tu cuenta de banco digital.",
      );
    }
    set({ setupBusy: true, error: undefined });
    try {
      const wallet = await apiRequest<UnitWallet>(
        `/unit/recaudos/${recaudoId}/wallet`,
        {
          method: "POST",
          body: JSON.stringify({
            unitCustomerId: identity.unitCustomerId,
          }),
        },
      );
      set((state) => ({
        walletsByRecaudo: {
          ...state.walletsByRecaudo,
          [recaudoId]: { ...wallet, recaudoId },
        },
        setupBusy: false,
      }));
      return get().walletsByRecaudo[recaudoId]!;
    } catch (error) {
      set({ setupBusy: false, error: messageFrom(error) });
      throw error;
    }
  },

  ensureWorkspaceWallet: async (recaudoId) => get().ensureRecaudoWallet(recaudoId),

  linkBankAccount: async (input) => {
    if (useAuthStore.getState().demo) {
      throw new Error("Vincular cuenta no está disponible en demo.");
    }
    set({ setupBusy: true, error: undefined });
    try {
      const created = await apiRequest<UnitCounterparty>("/unit/counterparties", {
        method: "POST",
        body: JSON.stringify({
          name: input.name.trim(),
          routingNumber: input.routingNumber.replace(/\D/g, ""),
          accountNumber: input.accountNumber.replace(/\D/g, ""),
          accountType: input.accountType ?? "Checking",
        }),
      });
      const counterparties = await get().refreshCounterparties();
      set({ setupBusy: false });
      return (
        counterparties.find(
          (item) => item.unitCounterpartyId === created.unitCounterpartyId,
        ) ?? created
      );
    } catch (error) {
      set({ setupBusy: false, error: messageFrom(error) });
      throw error;
    }
  },

  fundContribution: async (input) => {
    if (useAuthStore.getState().demo) {
      throw new Error("El aporte con cuenta no está disponible en demo.");
    }
    const counterparty =
      get().counterparties.find(
        (item) => item.unitCounterpartyId === input.counterpartyId,
      ) ?? get().counterparties[0];
    if (!counterparty) {
      throw new Error("Vincula una cuenta bancaria antes de aportar.");
    }
    const result = await apiRequest<FundResult>(
      `/payments/recaudos/${input.recaudoId}/contributions/funded`,
      {
        method: "POST",
        headers: { "Idempotency-Key": newIdempotencyKey() },
        body: JSON.stringify({
          amountMinor: input.amountMinor,
          note: input.note,
          counterpartyId: counterparty.unitCounterpartyId,
        }),
      },
    );
    set((state) => ({
      balancesByRecaudo: {
        ...state.balancesByRecaudo,
        [input.recaudoId]: result.balances,
      },
    }));
    return result;
  },

  fundWithdrawal: async (input) => {
    if (useAuthStore.getState().demo) {
      throw new Error("El retiro con cuenta no está disponible en demo.");
    }
    const counterparty =
      get().counterparties.find(
        (item) => item.unitCounterpartyId === input.counterpartyId,
      ) ?? get().counterparties[0];
    if (!counterparty) {
      throw new Error("Vincula una cuenta bancaria antes de retirar.");
    }
    const result = await apiRequest<FundResult>(
      `/payments/recaudos/${input.recaudoId}/withdrawals/funded`,
      {
        method: "POST",
        headers: { "Idempotency-Key": newIdempotencyKey() },
        body: JSON.stringify({
          amountMinor: input.amountMinor,
          note: input.note,
          counterpartyId: counterparty.unitCounterpartyId,
        }),
      },
    );
    set((state) => ({
      balancesByRecaudo: {
        ...state.balancesByRecaudo,
        [input.recaudoId]: result.balances,
      },
    }));
    const profile = useAuthStore.getState().profile;
    void import("@/store/notifications").then(({ recordActivity }) =>
      recordActivity({
        kind: "recaudo",
        title: "Retiro del recaudo",
        body: `${profile.name} retiró ${(input.amountMinor / 100).toLocaleString("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        })} del pozo`,
        icon: "arrow.up.circle.fill",
        tone: "orange",
        sound: "gasto",
        route: `/(tabs)/recaudo/${input.recaudoId}`,
      }),
    );
    return result;
  },

  syncSchedule: async (recaudoId) => {
    if (useAuthStore.getState().demo) return undefined;
    return apiRequest(`/payments/schedules/recaudos/${recaudoId}/me`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  isFundingReady: (recaudoId, isOrganizer) => {
    const { identity, counterparties, walletsByRecaudo } = get();
    const hasIdentity =
      identity.status === "approved" && Boolean(identity.unitCustomerId);
    const hasBank = counterparties.some((item) => item.active);
    if (!hasIdentity || !hasBank) return false;
    if (isOrganizer) {
      const wallet = walletsByRecaudo[recaudoId];
      return Boolean(wallet?.unitWalletId && wallet.status === "open");
    }
    // Members can attempt funding once identity + bank are ready;
    // API enforces that this recaudo's digital account exists.
    return true;
  },
}));
