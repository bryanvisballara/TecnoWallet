import { create } from "zustand";

import { ApiError, apiRequest, mutateOffline } from "@/services/api";
import { tokenStorage } from "@/services/persistence";
import { scheduleRecaudoReminder } from "@/services/push-notifications";
import { useAuthStore } from "@/store/auth";
import { recordActivity } from "@/store/notifications";

export type RecaudoCategory =
  "travel" | "gift" | "event" | "purchase" | "other";
export type ContributionFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type ContributionMode = "manual" | "card_simulated" | "bank_auto";
export type RecaudoStatus = "active" | "completed" | "closed";

export type RecaudoParticipant = {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: "organizer" | "member";
  monthlyCommitmentMinor: number;
  frequency: ContributionFrequency;
  mode: ContributionMode;
  remindersEnabled: boolean;
  reminderTime: string;
  simulatedCard?: { brand: string; last4: string };
  contributedMinor: number;
  joinedAt: string;
};

export type RecaudoContribution = {
  id: string;
  participantId: string;
  participantName: string;
  /** Auth user id of who made the aporte/retiro (when known). */
  userId?: string;
  amountMinor: number;
  note?: string;
  occurredAt: string;
  method: "manual" | "card_simulated" | "withdrawal";
  pending?: boolean;
};

export type RecaudoPayoutMethod = "digital" | "personal";

export type Recaudo = {
  id: string;
  title: string;
  category: RecaudoCategory;
  targetMinor: number;
  collectedMinor: number;
  monthlyTargetMinor: number;
  currency: string;
  deadline?: string;
  status: RecaudoStatus;
  organizerId?: string;
  isOrganizer: boolean;
  shareCode?: string;
  payoutMethod?: RecaudoPayoutMethod;
  payoutAccountDetails?: string;
  digitalMonthlyIncluded?: boolean;
  digitalActivatedAt?: string;
  digitalClosedAt?: string;
  digitalQuote?: {
    spreadMinor: number;
    monthlyDueMinor: number;
    kycDueMinor: number;
    digitalFeesMinor: number;
    netPayoutMinor: number;
  } | null;
  digitalPricing?: {
    monthlyFeeMinor: number;
    kycFeeMinor: number;
    withdrawBps: number;
    minTargetMinor: number;
    kycAbsorbTargetMinor: number;
    inactiveDays: number;
    businessIncludedPerMonth?: number;
  };
  tecnoAccount?: {
    status?: string;
    kycUrl?: string;
    tosUrl?: string;
    chain?: string;
    virtualAccounts?: Array<{
      id: string;
      currency: string;
      paymentRails: string[];
    }>;
  };
  participants: RecaudoParticipant[];
  contributions: RecaudoContribution[];
  createdAt: string;
  updatedAt: string;
};

export type RecaudoAccessRequest = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

type NewRecaudo = {
  title: string;
  category: RecaudoCategory;
  targetMinor: number;
  monthlyTargetMinor: number;
  currency: string;
  deadline?: string;
  payoutMethod?: RecaudoPayoutMethod;
  payoutAccountDetails?: string;
};

type MyPlan = {
  monthlyCommitmentMinor: number;
  frequency: ContributionFrequency;
  mode: ContributionMode;
  remindersEnabled: boolean;
  reminderTime: string;
  simulatedCard?: { brand: string; last4: string };
};

type RecaudosState = {
  recaudos: Recaudo[];
  hydrated: boolean;
  loading: boolean;
  error?: string;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  createRecaudo: (value: NewRecaudo) => Promise<Recaudo>;
  updateRecaudo: (
    recaudoId: string,
    patch: Partial<NewRecaudo>,
  ) => Promise<Recaudo>;
  addContribution: (
    recaudoId: string,
    amountMinor: number,
    note?: string,
  ) => Promise<void>;
  withdraw: (
    recaudoId: string,
    amountMinor: number,
    note?: string,
  ) => Promise<void>;
  invite: (
    recaudoId: string,
    email: string,
  ) => Promise<{ previewLink?: string }>;
  fetchShareCode: (recaudoId: string) => Promise<string>;
  requestJoinByCode: (shareCode: string) => Promise<{ title?: string }>;
  listAccessRequests: (recaudoId: string) => Promise<RecaudoAccessRequest[]>;
  acceptAccessRequest: (requestId: string) => Promise<void>;
  rejectAccessRequest: (requestId: string) => Promise<void>;
  updateMyPlan: (
    recaudoId: string,
    plan: MyPlan,
  ) => Promise<{ reminderScheduled: boolean }>;
  acceptInvite: (token: string) => Promise<Recaudo>;
  /** Organizer only. Fails if the pot still has funds. */
  deleteRecaudo: (recaudoId: string) => Promise<void>;
};

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function seedRecaudos(): Recaudo[] {
  const createdAt = now();
  const owner: RecaudoParticipant = {
    id: "participant-alex",
    name: "Alex Rivera",
    email: "alex@tecnowallet.app",
    role: "organizer",
    monthlyCommitmentMinor: 350_00000,
    frequency: "monthly",
    mode: "manual",
    remindersEnabled: true,
    reminderTime: "09:00",
    contributedMinor: 800_00000,
    joinedAt: createdAt,
  };
  return [
    {
      id: "recaudo-viaje-fin-ano",
      title: "Viaje fin de año",
      category: "travel",
      targetMinor: 4_000_00000,
      collectedMinor: 2_450_00000,
      monthlyTargetMinor: 700_00000,
      currency: "COP",
      deadline: "2026-12-20",
      status: "active",
      isOrganizer: true,
      participants: [
        owner,
        {
          ...owner,
          id: "participant-sam",
          name: "Sam Rivera",
          email: "sam@example.com",
          role: "member",
          frequency: "biweekly",
          contributedMinor: 650_00000,
        },
        {
          ...owner,
          id: "participant-cami",
          name: "Camila",
          email: "cami@example.com",
          role: "member",
          frequency: "weekly",
          contributedMinor: 500_00000,
        },
        {
          ...owner,
          id: "participant-dani",
          name: "Daniel",
          email: "dani@example.com",
          role: "member",
          frequency: "monthly",
          contributedMinor: 500_00000,
        },
      ],
      contributions: [
        {
          id: "contribution-1",
          participantId: "participant-alex",
          participantName: "Alex Rivera",
          amountMinor: 350_00000,
          occurredAt: new Date(Date.now() - 86_400_000).toISOString(),
          method: "manual",
        },
        {
          id: "contribution-2",
          participantId: "participant-sam",
          participantName: "Sam Rivera",
          amountMinor: 175_00000,
          occurredAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          method: "manual",
        },
      ],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "recaudo-cumple-mama",
      title: "Cumpleaños de mamá",
      category: "gift",
      targetMinor: 1_200_00000,
      collectedMinor: 420_00000,
      monthlyTargetMinor: 400_00000,
      currency: "COP",
      deadline: "2026-10-05",
      status: "active",
      isOrganizer: true,
      participants: [owner],
      contributions: [],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "recaudo-viaje-amigos",
      title: "Viaje con amigos",
      category: "travel",
      targetMinor: 6_000_00000,
      collectedMinor: 900_00000,
      monthlyTargetMinor: 1_000_00000,
      currency: "COP",
      status: "active",
      isOrganizer: false,
      participants: [owner],
      contributions: [],
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No se pudieron cargar los recaudos.";
}

function objectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as { id?: unknown; _id?: unknown };
    if (typeof record.id === "string") return record.id;
    if (typeof record._id === "string") return record._id;
  }
  return "";
}

function dateString(value: unknown, fallback = now()) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

function normalizeRecaudo(raw: unknown): Recaudo {
  const value = (raw ?? {}) as Record<string, unknown>;
  const rawContributions = Array.isArray(value.contributions)
    ? value.contributions
    : [];
  const contributions: RecaudoContribution[] = rawContributions.map((item) => {
    const contribution = item as Record<string, unknown>;
    const userIdRaw = contribution.userId;
    return {
      id: objectId(contribution),
      participantId: objectId(contribution.participantId),
      participantName:
        typeof contribution.participantName === "string"
          ? contribution.participantName
          : "Participante",
      userId:
        typeof userIdRaw === "string"
          ? userIdRaw
          : userIdRaw
            ? String(userIdRaw)
            : undefined,
      amountMinor: Number(contribution.amountMinor) || 0,
      note:
        typeof contribution.note === "string" ? contribution.note : undefined,
      occurredAt: dateString(contribution.occurredAt ?? contribution.createdAt),
      method:
        contribution.paymentMode === "withdrawal"
          ? "withdrawal"
          : contribution.paymentMode === "card_simulated"
            ? "card_simulated"
            : "manual",
    };
  });
  const rawParticipants = Array.isArray(value.participants)
    ? value.participants
    : [];
  const participants: RecaudoParticipant[] = rawParticipants.map(
    (item, index) => {
      const participant = item as Record<string, unknown>;
      const plan =
        participant.plan && typeof participant.plan === "object"
          ? (participant.plan as Record<string, unknown>)
          : {};
      const participantId = objectId(participant);
      const contributedMinor = contributions
        .filter(
          (contribution) =>
            contribution.participantId === participantId &&
            contribution.method !== "withdrawal",
        )
        .reduce((sum, contribution) => sum + contribution.amountMinor, 0);
      const email =
        typeof participant.email === "string"
          ? participant.email
          : `participante-${index + 1}@local`;
      const simulated =
        plan.simulatedCard && typeof plan.simulatedCard === "object"
          ? (plan.simulatedCard as Record<string, unknown>)
          : undefined;
      return {
        id: participantId,
        userId: objectId(participant.userId) || undefined,
        name:
          typeof participant.name === "string"
            ? participant.name
            : email.includes("@")
              ? email.split("@")[0]
              : `Participante ${index + 1}`,
        email,
        role: participant.role === "organizer" ? "organizer" : "member",
        monthlyCommitmentMinor:
          Number(participant.monthlyCommitmentMinor ?? plan.amountMinor) || 0,
        frequency:
          plan.frequency === "daily" ||
          plan.frequency === "weekly" ||
          plan.frequency === "biweekly"
            ? plan.frequency
            : "monthly",
        mode:
          plan.paymentMode === "card_simulated"
            ? "card_simulated"
            : plan.paymentMode === "bank_ach"
              ? "bank_auto"
              : "manual",
        remindersEnabled: Boolean(plan.remindersEnabled),
        reminderTime:
          typeof plan.reminderTime === "string" &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(plan.reminderTime)
            ? plan.reminderTime
            : "09:00",
        simulatedCard: simulated
          ? {
              brand:
                typeof simulated.brand === "string"
                  ? simulated.brand.replace("_simulated", "")
                  : "Visa",
              last4:
                typeof simulated.last4 === "string" ? simulated.last4 : "4242",
            }
          : undefined,
        contributedMinor:
          Number(participant.contributedMinor) || contributedMinor,
        joinedAt: dateString(participant.joinedAt ?? participant.createdAt),
      };
    },
  );
  const currentRole =
    value.currentRole === "organizer" || value.currentRole === "member"
      ? value.currentRole
      : undefined;
  return {
    id: objectId(value),
    title: typeof value.title === "string" ? value.title : "Recaudo",
    category:
      value.category === "travel" ||
      value.category === "gift" ||
      value.category === "event" ||
      value.category === "purchase"
        ? value.category
        : "other",
    targetMinor: Number(value.targetMinor) || 0,
    collectedMinor: Number(value.collectedMinor) || 0,
    monthlyTargetMinor:
      Number(value.monthlyTargetMinor) || Number(value.targetMinor) || 0,
    currency: typeof value.currency === "string" ? value.currency : "COP",
    deadline: value.deadline ? dateString(value.deadline) : undefined,
    status:
      value.status === "closed"
        ? "closed"
        : Number(value.collectedMinor) >= Number(value.targetMinor) &&
            Number(value.targetMinor) > 0
          ? "completed"
          : "active",
    organizerId: objectId(value.organizerId) || undefined,
    isOrganizer:
      typeof value.isOrganizer === "boolean"
        ? value.isOrganizer
        : currentRole === "organizer",
    shareCode:
      typeof value.shareCode === "string" && value.shareCode.trim()
        ? value.shareCode.trim().toUpperCase()
        : undefined,
    payoutMethod: value.payoutMethod === "digital" ? "digital" : "personal",
    payoutAccountDetails:
      typeof value.payoutAccountDetails === "string" &&
      value.payoutAccountDetails.trim()
        ? value.payoutAccountDetails.trim()
        : undefined,
    digitalMonthlyIncluded: false,
    digitalActivatedAt:
      typeof value.digitalActivatedAt === "string"
        ? value.digitalActivatedAt
        : undefined,
    digitalClosedAt:
      typeof value.digitalClosedAt === "string"
        ? value.digitalClosedAt
        : undefined,
    tecnoAccount: (() => {
      const account = value.tecnoAccount;
      if (!account || typeof account !== "object") return undefined;
      const row = account as Record<string, unknown>;
      return {
        status: typeof row.status === "string" ? row.status : undefined,
        kycUrl: typeof row.kycUrl === "string" ? row.kycUrl : undefined,
        tosUrl: typeof row.tosUrl === "string" ? row.tosUrl : undefined,
        chain: typeof row.chain === "string" ? row.chain : undefined,
        virtualAccounts: Array.isArray(row.virtualAccounts)
          ? row.virtualAccounts.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const va = item as Record<string, unknown>;
              if (typeof va.id !== "string") return [];
              return [
                {
                  id: va.id,
                  currency: typeof va.currency === "string" ? va.currency : "",
                  paymentRails: Array.isArray(va.paymentRails)
                    ? va.paymentRails.filter(
                        (rail): rail is string => typeof rail === "string",
                      )
                    : [],
                },
              ];
            })
          : [],
      };
    })(),
    digitalQuote: (() => {
      const quote = value.digitalQuote;
      if (!quote || typeof quote !== "object") return null;
      const row = quote as Record<string, unknown>;
      return {
        spreadMinor: Number(row.spreadMinor) || 0,
        monthlyDueMinor: Number(row.monthlyDueMinor) || 0,
        kycDueMinor: Number(row.kycDueMinor) || 0,
        digitalFeesMinor: Number(row.digitalFeesMinor) || 0,
        netPayoutMinor: Number(row.netPayoutMinor) || 0,
      };
    })(),
    participants,
    contributions,
    createdAt: dateString(value.createdAt),
    updatedAt: dateString(value.updatedAt),
  };
}

async function resolveWorkspaceId() {
  // Always resolve from Mongo workspaces (no localStorage). Prefer Hogar.
  const workspaces = await apiRequest<
    Array<{ id?: string; _id?: string; name?: string }>
  >("/workspaces");
  const hogar = workspaces.find(
    (item) => (item.name || "").trim().toLowerCase() === "hogar",
  );
  let workspaceId = objectId(hogar) || objectId(workspaces[0]);
  if (!workspaceId) {
    const created = await apiRequest<{ id?: string; _id?: string }>(
      "/workspaces",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Hogar",
          type: "personal",
          baseCurrency: "COP",
          color: "#F5C518",
          icon: "house.fill",
        }),
      },
    );
    workspaceId = objectId(created);
  }
  if (!workspaceId) {
    throw new Error(
      "No encontramos un espacio de trabajo para crear el recaudo.",
    );
  }
  return workspaceId;
}

/** Shared workspace id used by Recaudos + Unit wallet setup. */
export async function getRecaudosWorkspaceId() {
  return resolveWorkspaceId();
}

export const useRecaudosStore = create<RecaudosState>((set, get) => ({
  recaudos: [],
  hydrated: false,
  loading: false,

  hydrate: async () => {
    set({ hydrated: true });
    const auth = useAuthStore.getState();
    const hasToken = Boolean(await tokenStorage.get());
    if (auth.demo || auth.authenticated || hasToken) {
      await get().refresh();
    }
  },

  refresh: async () => {
    const auth = useAuthStore.getState();
    if (auth.demo) {
      if (!get().recaudos.length) {
        const recaudos = seedRecaudos();
        set({ recaudos });
      }
      return;
    }
    const hasToken = Boolean(await tokenStorage.get());
    if (!auth.authenticated && !hasToken) {
      set({ recaudos: [], loading: false, error: undefined });
      return;
    }
    set({ loading: true, error: undefined });
    try {
      const summaries = await apiRequest<unknown[]>("/recaudos");
      const recaudos = await Promise.all(
        summaries.map(async (summary) => {
          const summaryId = objectId(summary);
          if (!summaryId) return normalizeRecaudo(summary);
          try {
            return normalizeRecaudo(await apiRequest(`/recaudos/${summaryId}`));
          } catch {
            return normalizeRecaudo(summary);
          }
        }),
      );
      set({ recaudos, loading: false });
      void import('@/services/collaboration-api').then(
        ({ notifyNewTeamRecaudoActivity }) =>
          notifyNewTeamRecaudoActivity().catch(() => undefined),
      );
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },

  createRecaudo: async (value) => {
    const demo = useAuthStore.getState().demo;
    const timestamp = now();
    const profile = useAuthStore.getState().profile;
    const optimistic: Recaudo = {
      id: id("recaudo"),
      ...value,
      collectedMinor: 0,
      status: "active",
      isOrganizer: true,
      participants: [
        {
          id: id("participant"),
          name: profile.name,
          email: profile.email,
          role: "organizer",
          monthlyCommitmentMinor: value.monthlyTargetMinor,
          frequency: "monthly",
          mode: "manual",
          remindersEnabled: true,
          reminderTime: "09:00",
          contributedMinor: 0,
          joinedAt: timestamp,
        },
      ],
      contributions: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (demo) {
      const recaudos = [optimistic, ...get().recaudos];
      set({ recaudos });
      void recordActivity({
        kind: "recaudo",
        title: "Recaudo creado",
        body: optimistic.title,
        icon: "person.3.fill",
        sound: "sobres",
        route: `/(tabs)/recaudo/${optimistic.id}`,
      });
      return optimistic;
    }

    const workspaceId = await resolveWorkspaceId();
    const created = normalizeRecaudo(
      await apiRequest("/recaudos", {
        method: "POST",
        body: JSON.stringify({ ...value, workspaceId }),
      }),
    );
    const recaudos = [created, ...get().recaudos];
    set({ recaudos });
    void recordActivity({
      kind: "recaudo",
      title: "Recaudo creado",
      body: created.title,
      icon: "person.3.fill",
      sound: "sobres",
      route: `/(tabs)/recaudo/${created.id}`,
    });
    return created;
  },

  updateRecaudo: async (recaudoId, patch) => {
    const current = get().recaudos.find((item) => item.id === recaudoId);
    if (!current) throw new Error("Recaudo no encontrado.");
    if (!current.isOrganizer) {
      throw new Error("Solo el organizador puede editar este recaudo.");
    }
    const demo = useAuthStore.getState().demo;
    if (demo) {
      const next: Recaudo = {
        ...current,
        ...patch,
        updatedAt: now(),
      };
      set({
        recaudos: get().recaudos.map((item) =>
          item.id === recaudoId ? next : item,
        ),
      });
      return next;
    }
    const updated = normalizeRecaudo(
      await apiRequest(`/recaudos/${recaudoId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    );
    set({
      recaudos: get().recaudos.map((item) =>
        item.id === recaudoId
          ? {
              ...item,
              ...updated,
              participants: updated.participants.length
                ? updated.participants
                : item.participants,
              contributions: updated.contributions.length
                ? updated.contributions
                : item.contributions,
            }
          : item,
      ),
    });
    return updated;
  },

  addContribution: async (recaudoId, amountMinor, note) => {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("El aporte debe ser mayor a cero.");
    }
    const demo = useAuthStore.getState().demo;
    const profile = useAuthStore.getState().profile;
    const contribution: RecaudoContribution = {
      id: id("contribution"),
      participantId: "self",
      participantName: profile.name,
      amountMinor,
      note: note?.trim() || undefined,
      occurredAt: now(),
      method: "manual",
      pending: !demo,
    };
    const recaudos = get().recaudos.map((item) =>
      item.id === recaudoId
        ? {
            ...item,
            collectedMinor: item.collectedMinor + amountMinor,
            contributions: [contribution, ...item.contributions],
            participants: item.participants.map((participant) =>
              participant.email.toLowerCase() === profile.email.toLowerCase()
                ? {
                    ...participant,
                    contributedMinor:
                      participant.contributedMinor + amountMinor,
                  }
                : participant,
            ),
            updatedAt: now(),
          }
        : item,
    );
    set({ recaudos });
    if (demo) {
      const recaudo = get().recaudos.find((item) => item.id === recaudoId);
      void recordActivity({
        kind: "recaudo",
        title: "Aporte al recaudo",
        body: `${profile.name} aportó ${(amountMinor / 100).toLocaleString("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        })} a ${recaudo?.title ?? "recaudo"}`,
        icon: "person.3.fill",
        sound: "ingreso",
        route: `/(tabs)/recaudo/${recaudoId}`,
      });
      return;
    }
    try {
      const result = await mutateOffline<RecaudoContribution>({
        endpoint: `/recaudos/${recaudoId}/contributions`,
        method: "POST",
        payload: { amountMinor, note },
      });
      if (!result.queued) await get().refresh();
      const recaudo = get().recaudos.find((item) => item.id === recaudoId);
      void recordActivity({
        kind: "recaudo",
        title: "Aporte al recaudo",
        body: `${profile.name} aportó ${(amountMinor / 100).toLocaleString("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        })} a ${recaudo?.title ?? "recaudo"}`,
        icon: "person.3.fill",
        sound: "ingreso",
        route: `/(tabs)/recaudo/${recaudoId}`,
      });
    } catch (error) {
      await get().refresh();
      throw error;
    }
  },

  withdraw: async (recaudoId, amountMinor, note) => {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("El retiro debe ser mayor a cero.");
    }
    const current = get().recaudos.find((item) => item.id === recaudoId);
    if (!current) throw new Error("Recaudo no encontrado.");
    if (!current.isOrganizer) {
      throw new Error("Solo quien organiza puede retirar del pozo.");
    }
    if (current.status === "closed") {
      throw new Error("Este recaudo ya está cerrado.");
    }
    if (amountMinor > current.collectedMinor) {
      throw new Error("No puedes retirar más de lo recaudado.");
    }
    const demo = useAuthStore.getState().demo;
    const profile = useAuthStore.getState().profile;
    const nextCollected = current.collectedMinor - amountMinor;
    const withdrawal: RecaudoContribution = {
      id: id("withdrawal"),
      participantId: "self",
      participantName: profile.name,
      amountMinor,
      note: note?.trim() || undefined,
      occurredAt: now(),
      method: "withdrawal",
      pending: !demo,
    };
    const recaudos = get().recaudos.map((item) =>
      item.id === recaudoId
        ? {
            ...item,
            collectedMinor: nextCollected,
            status: nextCollected <= 0 ? ("closed" as const) : item.status,
            contributions: [withdrawal, ...item.contributions],
            updatedAt: now(),
          }
        : item,
    );
    set({ recaudos });
    const notifyWithdraw = () => {
      void recordActivity({
        kind: "recaudo",
        title: "Retiro del recaudo",
        body: `${profile.name} retiró ${(amountMinor / 100).toLocaleString("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        })} de ${current.title}`,
        icon: "arrow.up.circle.fill",
        tone: "orange",
        sound: "gasto",
        route: `/(tabs)/recaudo/${recaudoId}`,
      });
    };
    if (demo) {
      notifyWithdraw();
      return;
    }
    try {
      const result = await mutateOffline<{ collectedMinor?: number }>({
        endpoint: `/recaudos/${recaudoId}/withdrawals`,
        method: "POST",
        payload: { amountMinor, note },
      });
      if (!result.queued) await get().refresh();
      notifyWithdraw();
    } catch (error) {
      await get().refresh();
      throw error;
    }
  },

  invite: async (recaudoId, email) => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Escribe un correo válido.");
    }
    if (useAuthStore.getState().demo) {
      return {
        previewLink: `https://tecnowallet.app/invite/demo-${recaudoId}`,
      };
    }
    return apiRequest<{ previewLink?: string }>(
      `/recaudos/${recaudoId}/invites`,
      {
        method: "POST",
        body: JSON.stringify({ email: normalized }),
      },
    );
  },

  fetchShareCode: async (recaudoId) => {
    const cached = get()
      .recaudos.find((item) => item.id === recaudoId)
      ?.shareCode?.trim()
      .toUpperCase();
    if (cached) return cached;
    if (useAuthStore.getState().demo) {
      const code = `TRDEMO${recaudoId.slice(-4).toUpperCase()}XX`.slice(0, 10);
      set({
        recaudos: get().recaudos.map((item) =>
          item.id === recaudoId ? { ...item, shareCode: code } : item,
        ),
      });
      return code;
    }
    const result = await apiRequest<{ shareCode?: string }>(
      `/recaudos/${recaudoId}/share-code`,
    );
    const shareCode = result.shareCode?.trim().toUpperCase() || "";
    if (shareCode) {
      set({
        recaudos: get().recaudos.map((item) =>
          item.id === recaudoId ? { ...item, shareCode } : item,
        ),
      });
    }
    return shareCode;
  },

  requestJoinByCode: async (shareCode) => {
    const code = shareCode.trim().toUpperCase();
    if (code.length < 4) throw new Error("Escribe un ID de recaudo válido.");
    if (useAuthStore.getState().demo) {
      return { title: "Recaudo (demo)" };
    }
    return apiRequest<{ title?: string }>("/recaudos/join", {
      method: "POST",
      body: JSON.stringify({ shareCode: code }),
    });
  },

  listAccessRequests: async (recaudoId) => {
    if (useAuthStore.getState().demo) return [];
    const rows = await apiRequest<RecaudoAccessRequest[]>(
      `/recaudos/${recaudoId}/access-requests`,
    );
    return Array.isArray(rows) ? rows : [];
  },

  acceptAccessRequest: async (requestId) => {
    if (useAuthStore.getState().demo) return;
    await apiRequest(`/recaudos/access-requests/${requestId}/accept`, {
      method: "POST",
    });
    await get().refresh();
  },

  rejectAccessRequest: async (requestId) => {
    if (useAuthStore.getState().demo) return;
    await apiRequest(`/recaudos/access-requests/${requestId}/reject`, {
      method: "POST",
    });
  },

  updateMyPlan: async (recaudoId, plan) => {
    if (
      !Number.isSafeInteger(plan.monthlyCommitmentMinor) ||
      plan.monthlyCommitmentMinor <= 0
    ) {
      throw new Error("Define un aporte mensual mayor a cero.");
    }
    if (plan.mode === "card_simulated" && !plan.simulatedCard) {
      throw new Error("Selecciona una tarjeta simulada.");
    }
    if (
      plan.remindersEnabled &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.reminderTime)
    ) {
      throw new Error("Selecciona una hora válida para el recordatorio.");
    }
    if (useAuthStore.getState().demo) {
      const profile = useAuthStore.getState().profile;
      const recaudos = get().recaudos.map((item) => {
        if (item.id !== recaudoId) return item;
        const participants = item.participants.map((participant, index) =>
          participant.email === profile.email ||
          (index === 0 && item.isOrganizer)
            ? { ...participant, ...plan }
            : participant,
        );
        return { ...item, participants, updatedAt: now() };
      });
      set({ recaudos });
      const recaudo = recaudos.find((item) => item.id === recaudoId);
      if (recaudo) {
        const reminderScheduled = await scheduleRecaudoReminder({
          recaudoId,
          title: recaudo.title,
          frequency: plan.frequency,
          enabled: plan.remindersEnabled,
          time: plan.reminderTime,
        });
        return { reminderScheduled };
      }
      return { reminderScheduled: !plan.remindersEnabled };
    }
    const updatedParticipant = await apiRequest(
      `/recaudos/${recaudoId}/participants/me/plan`,
      {
        method: "PATCH",
        body: JSON.stringify({
          amountMinor: plan.monthlyCommitmentMinor,
          frequency: plan.frequency,
          paymentMode:
            plan.mode === "bank_auto"
              ? "bank_ach"
              : plan.mode === "card_simulated"
                ? "card_simulated"
                : "manual",
          remindersEnabled: plan.remindersEnabled,
          reminderTime: plan.reminderTime,
          reminderDaysBefore: plan.remindersEnabled ? [0] : [],
        }),
      },
    );
    void updatedParticipant;
    const updated = normalizeRecaudo(
      await apiRequest(`/recaudos/${recaudoId}`),
    );
    const recaudos = get().recaudos.map((item) =>
      item.id === recaudoId ? updated : item,
    );
    set({ recaudos });
    const reminderScheduled = await scheduleRecaudoReminder({
      recaudoId,
      title: updated.title,
      frequency: plan.frequency,
      enabled: plan.remindersEnabled,
      time: plan.reminderTime,
    });
    return { reminderScheduled };
  },

  acceptInvite: async (token) => {
    if (!token.trim()) throw new Error("La invitación no es válida.");
    const recaudo = normalizeRecaudo(
      await apiRequest("/recaudos/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: token.trim() }),
      }),
    );
    const recaudos = [
      recaudo,
      ...get().recaudos.filter((item) => item.id !== recaudo.id),
    ];
    set({ recaudos });
    return recaudo;
  },

  deleteRecaudo: async (recaudoId) => {
    const current = get().recaudos.find((item) => item.id === recaudoId);
    if (!current) throw new Error("El recaudo no existe.");
    if (!current.isOrganizer) {
      throw new Error("Solo el organizador puede eliminar el recaudo.");
    }
    if (current.collectedMinor > 0) {
      throw new Error(
        "Retira el dinero del recaudo antes de eliminarlo. El pozo debe quedar en 0.",
      );
    }
    const demo = useAuthStore.getState().demo;
    if (demo) {
      set({
        recaudos: get().recaudos.filter((item) => item.id !== recaudoId),
      });
      void recordActivity({
        kind: "recaudo",
        title: "Recaudo eliminado",
        body: current.title,
        icon: "trash",
        tone: "red",
        sound: "default",
        route: "/(tabs)/recaudos",
      });
      return;
    }
    try {
      await apiRequest(`/recaudos/${recaudoId}`, { method: "DELETE" });
    } catch (error) {
      const missingDelete =
        error instanceof ApiError &&
        (error.status === 404 || /Cannot DELETE/i.test(error.message));
      if (!missingDelete) throw error;
      try {
        await apiRequest(`/recaudos/${recaudoId}/delete`, { method: "POST" });
      } catch (fallbackError) {
        const missingPost =
          fallbackError instanceof ApiError && fallbackError.status === 404;
        if (!missingPost) throw fallbackError;
        await apiRequest(`/recaudos/${recaudoId}/close`, { method: "POST" });
      }
    }
    set({
      recaudos: get().recaudos.filter((item) => item.id !== recaudoId),
    });
    void recordActivity({
      kind: "recaudo",
      title: "Recaudo eliminado",
      body: current.title,
      icon: "trash",
      tone: "red",
      sound: "default",
      route: "/(tabs)/recaudos",
    });
  },
}));
