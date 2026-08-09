import { create } from 'zustand';

import { apiRequest } from '@/services/api';
import { objectId, toMinor, fromMinor } from '@/services/ledgers-api';
import { useLedgerStore } from '@/store/ledger';
import { localStorage } from '@/services/persistence';

export type GoalPeriod = 'week' | 'month' | 'year' | 'date';

export type UserGoal = {
  id: string;
  title: string;
  period: GoalPeriod;
  /** Fecha objetivo YYYY-MM-DD (cuando period === 'date'). */
  targetDate?: string;
  targetAmount?: number;
  completed: boolean;
  color: string;
  createdAt: string;
  completedAt?: string;
  /** Sobre de ahorros vinculado (creado desde Metas/Ahorros). */
  envelopeId?: string;
};

type GoalsState = {
  goals: UserGoal[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addGoal: (value: {
    title: string;
    period: GoalPeriod;
    targetDate?: string;
    targetAmount?: number;
    color?: string;
    envelopeId?: string;
  }) => Promise<UserGoal>;
  linkEnvelope: (goalId: string, envelopeId: string) => Promise<void>;
  toggleCompleted: (id: string) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
};

const COLORS = ['#0878F9', '#12B76A', '#F79009', '#7F56D9', '#06AED4', '#EE46BC'];
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const goalPeriodLabels: Record<GoalPeriod, string> = {
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
  date: 'Fecha',
};

export function isValidGoalDateKey(value: string) {
  if (!DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return (
    date.getFullYear() === y &&
    date.getMonth() === (m ?? 1) - 1 &&
    date.getDate() === d
  );
}

type ApiGoal = {
  _id?: string;
  id?: string;
  name: string;
  data?: Record<string, unknown>;
};

function workspaceIdOrThrow() {
  const id = useLedgerStore.getState().activeLedgerId;
  if (!id) throw new Error('Selecciona un libro antes de gestionar metas.');
  return id;
}

function mapGoal(resource: ApiGoal): UserGoal {
  const data = resource.data ?? {};
  const periodRaw = typeof data.period === 'string' ? data.period : 'month';
  const period = (['week', 'month', 'year', 'date'].includes(periodRaw)
    ? periodRaw
    : 'month') as GoalPeriod;
  return {
    id: objectId(resource),
    title: resource.name,
    period,
    targetDate: typeof data.targetDate === 'string' ? data.targetDate : undefined,
    targetAmount:
      typeof data.targetMinor === 'number'
        ? fromMinor(data.targetMinor)
        : undefined,
    completed: Boolean(data.completed),
    color: typeof data.color === 'string' ? data.color : COLORS[0],
    createdAt:
      typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    completedAt:
      typeof data.completedAt === 'string' ? data.completedAt : undefined,
    envelopeId: typeof data.envelopeId === 'string' ? data.envelopeId : undefined,
  };
}

function goalData(goal: Omit<UserGoal, 'id' | 'title'>) {
  return {
    period: goal.period,
    ...(goal.targetDate ? { targetDate: goal.targetDate } : {}),
    ...(goal.targetAmount !== undefined
      ? { targetMinor: toMinor(goal.targetAmount), savedMinor: 0 }
      : { targetMinor: 0, savedMinor: 0 }),
    completed: goal.completed,
    color: goal.color,
    createdAt: goal.createdAt,
    ...(goal.completedAt ? { completedAt: goal.completedAt } : {}),
    ...(goal.envelopeId ? { envelopeId: goal.envelopeId } : {}),
  };
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  hydrated: false,

  hydrate: async () => {
    const demo = await localStorage.get('demo-session', false);
    const workspaceId = useLedgerStore.getState().activeLedgerId;
    if (demo || !workspaceId) {
      set({ goals: [], hydrated: true });
      return;
    }
    try {
      const resources = await apiRequest<ApiGoal[]>(
        `/resources/goal?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`,
      );
      set({
        goals: resources.map(mapGoal),
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  addGoal: async (value) => {
    const workspaceId = workspaceIdOrThrow();
    const payload = {
      title: value.title.trim(),
      period: value.period,
      targetDate:
        value.period === 'date' &&
        value.targetDate &&
        isValidGoalDateKey(value.targetDate)
          ? value.targetDate
          : undefined,
      targetAmount:
        value.targetAmount !== undefined && Number.isFinite(value.targetAmount)
          ? Math.max(0, value.targetAmount)
          : undefined,
      completed: false,
      color: value.color ?? COLORS[get().goals.length % COLORS.length],
      createdAt: new Date().toISOString(),
      envelopeId: value.envelopeId,
    };
    const created = await apiRequest<ApiGoal>('/resources/goal', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        name: payload.title,
        privacy: 'workspace',
        data: goalData(payload),
      }),
    });
    const goal = mapGoal(created);
    set({ goals: [goal, ...get().goals] });
    return goal;
  },

  linkEnvelope: async (goalId, envelopeId) => {
    const current = get().goals.find((item) => item.id === goalId);
    if (!current) return;
    const { title, id: _id, ...rest } = current;
    await apiRequest(`/resources/goal/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: goalData({ ...rest, envelopeId }),
      }),
    });
    set({
      goals: get().goals.map((item) =>
        item.id === goalId ? { ...item, envelopeId } : item,
      ),
    });
  },

  toggleCompleted: async (id) => {
    const current = get().goals.find((item) => item.id === id);
    if (!current) return;
    const completed = !current.completed;
    const next = {
      ...current,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    };
    const { title, id: _id, ...rest } = next;
    await apiRequest(`/resources/goal/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: goalData(rest) }),
    });
    set({
      goals: get().goals.map((item) => (item.id === id ? next : item)),
    });
  },

  removeGoal: async (id) => {
    await apiRequest(`/resources/goal/${id}`, { method: 'DELETE' });
    set({ goals: get().goals.filter((item) => item.id !== id) });
  },
}));
