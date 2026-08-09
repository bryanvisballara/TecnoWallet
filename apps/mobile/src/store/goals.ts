import { create } from 'zustand';

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

const STORAGE_KEY = 'goals-v1';
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

async function persist(goals: UserGoal[]) {
  await localStorage.set(STORAGE_KEY, goals);
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  hydrated: false,

  hydrate: async () => {
    const saved = await localStorage.get<UserGoal[] | null>(STORAGE_KEY, null);
    set({ goals: Array.isArray(saved) ? saved : [], hydrated: true });
  },

  addGoal: async (value) => {
    const goal: UserGoal = {
      id: `goal-${Date.now()}`,
      title: value.title.trim(),
      period: value.period,
      targetDate:
        value.period === 'date' && value.targetDate && isValidGoalDateKey(value.targetDate)
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
    const goals = [goal, ...get().goals];
    set({ goals });
    await persist(goals);
    return goal;
  },

  linkEnvelope: async (goalId, envelopeId) => {
    const goals = get().goals.map((item) =>
      item.id === goalId ? { ...item, envelopeId } : item,
    );
    set({ goals });
    await persist(goals);
  },

  toggleCompleted: async (id) => {
    const goals = get().goals.map((item) => {
      if (item.id !== id) return item;
      const completed = !item.completed;
      return {
        ...item,
        completed,
        completedAt: completed ? new Date().toISOString() : undefined,
      };
    });
    set({ goals });
    await persist(goals);
  },

  removeGoal: async (id) => {
    const goals = get().goals.filter((item) => item.id !== id);
    set({ goals });
    await persist(goals);
  },
}));
