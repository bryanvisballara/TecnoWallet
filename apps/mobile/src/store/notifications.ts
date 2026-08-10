import { create } from 'zustand';

import { money, type Transaction } from '@/data/demo';
import type { LedgerMeta } from '@/data/ledgers';
import { localStorage } from '@/services/persistence';

export type NotificationKind =
  | 'calendar'
  | 'income'
  | 'expense'
  | 'account'
  | 'envelope'
  | 'planning'
  | 'goal'
  | 'recaudo'
  | 'system';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  icon: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  when: string;
  sortKey: string;
  route?: string;
  createdAt: string;
};

export type ActivityInput = {
  kind: NotificationKind;
  title: string;
  body: string;
  icon: string;
  tone?: AppNotification['tone'];
  route?: string;
  /** Also show as a native OS notification (default true on native). */
  push?: boolean;
  /** Override push sound (income→ingreso, expense→gasto, calendar→calendario, altas→sobres). */
  sound?: 'ingreso' | 'gasto' | 'calendario' | 'sobres' | 'default';
};

type NotificationsState = {
  activities: AppNotification[];
  readIds: string[];
  dismissedIds: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordActivity: (input: ActivityInput) => Promise<AppNotification>;
  markAllRead: (ids: string[]) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissMany: (ids: string[]) => Promise<void>;
  syncBadge: () => Promise<void>;
};

const READ_KEY = 'notification-read-ids';
const DISMISS_KEY = 'notification-dismissed-ids';
const ACTIVITY_KEY = 'notification-activities';
const MAX_ACTIVITIES = 200;

function activityId() {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function whenLabel(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'Ahora';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const dayDiff = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
  if (dayDiff === 0) {
    return `Hoy · ${at.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (dayDiff === 1) {
    return `Ayer · ${at.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return at.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function defaultTone(kind: NotificationKind): AppNotification['tone'] {
  if (kind === 'income' || kind === 'recaudo') return 'green';
  if (kind === 'expense') return 'orange';
  if (kind === 'calendar') return 'purple';
  if (kind === 'system') return 'red';
  if (kind === 'envelope' || kind === 'goal') return 'blue';
  return 'blue';
}

async function syncBadgeCount(count: number) {
  try {
    const { syncAppBadge } = await import('@/services/push-notifications');
    await syncAppBadge(count);
  } catch {
    // Badge sync must never break the app.
  }
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  activities: [],
  readIds: [],
  dismissedIds: [],
  hydrated: false,

  hydrate: async () => {
    const [readIds, dismissedIds, activities] = await Promise.all([
      localStorage.get<string[]>(READ_KEY, []),
      localStorage.get<string[]>(DISMISS_KEY, []),
      localStorage.get<AppNotification[]>(ACTIVITY_KEY, []),
    ]);
    set({
      readIds,
      dismissedIds,
      activities: Array.isArray(activities) ? activities : [],
      hydrated: true,
    });
    await get().syncBadge();
  },

  recordActivity: async (input) => {
    const createdAt = new Date().toISOString();
    const item: AppNotification = {
      id: activityId(),
      kind: input.kind,
      title: input.title,
      body: input.body,
      icon: input.icon,
      tone: input.tone ?? defaultTone(input.kind),
      when: whenLabel(createdAt),
      sortKey: createdAt,
      route: input.route,
      createdAt,
    };
    const activities = [item, ...get().activities].slice(0, MAX_ACTIVITIES);
    set({ activities });
    await localStorage.set(ACTIVITY_KEY, activities);
    await get().syncBadge();

    if (input.push !== false) {
      void import('@/services/push-notifications').then(({ notifyActivity }) =>
        notifyActivity({
          kind: input.kind,
          title: input.title,
          body: input.body,
          sound: input.sound,
          data: {
            notificationId: item.id,
            ...(input.route ? { route: input.route } : {}),
          },
        }),
      );
    }
    return item;
  },

  markAllRead: async (ids) => {
    const merged = Array.from(new Set([...get().readIds, ...ids]));
    set({ readIds: merged });
    await localStorage.set(READ_KEY, merged);
    await get().syncBadge();
  },

  markRead: async (id) => {
    if (get().readIds.includes(id)) return;
    const merged = [...get().readIds, id];
    set({ readIds: merged });
    await localStorage.set(READ_KEY, merged);
    await get().syncBadge();
  },

  dismiss: async (id) => {
    if (get().dismissedIds.includes(id)) return;
    const merged = [...get().dismissedIds, id];
    set({ dismissedIds: merged });
    await localStorage.set(DISMISS_KEY, merged);
    await get().syncBadge();
  },

  dismissMany: async (ids) => {
    if (!ids.length) return;
    const merged = Array.from(new Set([...get().dismissedIds, ...ids]));
    set({ dismissedIds: merged });
    await localStorage.set(DISMISS_KEY, merged);
    await get().syncBadge();
  },

  syncBadge: async () => {
    const { activities, readIds, dismissedIds } = get();
    let count = unreadCount(
      visibleNotifications(activities, dismissedIds),
      readIds,
      dismissedIds,
    );
    try {
      const { useLedgerStore } = await import('@/store/ledger');
      const { useAuthStore } = await import('@/store/auth');
      const { ledgers, snapshots } = useLedgerStore.getState();
      const selfName = useAuthStore.getState().profile?.name ?? '';
      const feed = buildNotificationFeed({
        activities,
        ledgers,
        snapshots,
        selfName,
      });
      count = unreadCount(feed, readIds, dismissedIds);
    } catch {
      // Fall back to activity-only count if stores are unavailable.
    }
    await syncBadgeCount(count);
  },
}));

function txSortKey(date: string, id: string, occurredAt?: string) {
  if (occurredAt) return occurredAt;
  if (date.startsWith('Hoy') || date === 'Ahora') return `9-${id}`;
  if (date.startsWith('Ayer')) return `8-${id}`;
  return `5-${date}-${id}`;
}

/**
 * Feed = persisted activities + shared-ledger team movements (other members).
 */
export function buildNotificationFeed(input: {
  activities: AppNotification[];
  ledgers: LedgerMeta[];
  snapshots: Record<string, { transactions: Transaction[] }>;
  selfName: string;
}): AppNotification[] {
  const feed: AppNotification[] = [...input.activities];
  const self = input.selfName.trim().toLowerCase();

  input.ledgers
    .filter((ledger) => ledger.type === 'shared')
    .forEach((ledger) => {
      const txs = input.snapshots[ledger.id]?.transactions ?? [];
      txs.forEach((tx) => {
        const author = tx.createdBy?.trim();
        if (!author) return;
        if (self && author.toLowerCase() === self) return;

        const isIncome = tx.amount > 0;
        feed.push({
          id: `tx-${ledger.id}-${tx.id}`,
          kind: isIncome ? 'income' : 'expense',
          title: isIncome ? 'Ingreso del equipo' : 'Gasto del equipo',
          body: `${author} registró ${tx.title} · ${money(Math.abs(tx.amount))} · ${ledger.name}`,
          icon: isIncome ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill',
          tone: isIncome ? 'green' : 'orange',
          when: tx.date,
          sortKey: txSortKey(tx.date, tx.id, tx.occurredAt),
          route: '/(tabs)/movimientos',
          createdAt: tx.occurredAt ?? new Date().toISOString(),
        });
      });
    });

  return feed.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export function notificationToneColors(
  tone: AppNotification['tone'],
  theme: {
    primarySoft: string;
    primary: string;
    successSoft: string;
    success: string;
    surfaceSecondary: string;
    warning: string;
    danger: string;
  },
) {
  if (tone === 'green') return { bg: theme.successSoft, fg: theme.success };
  if (tone === 'orange') return { bg: theme.surfaceSecondary, fg: theme.warning };
  if (tone === 'purple') return { bg: '#F4EBFF', fg: '#7F56D9' };
  if (tone === 'red') return { bg: '#FEE4E2', fg: theme.danger };
  return { bg: theme.primarySoft, fg: theme.primary };
}

export function visibleNotifications(feed: AppNotification[], dismissedIds: string[]) {
  return feed.filter((item) => !dismissedIds.includes(item.id));
}

export function unreadCount(
  feed: AppNotification[],
  readIds: string[],
  dismissedIds: string[] = [],
) {
  return feed.filter(
    (item) => !dismissedIds.includes(item.id) && !readIds.includes(item.id),
  ).length;
}

/** Fire-and-forget helper for stores/UI. */
export function recordActivity(input: ActivityInput) {
  return useNotificationsStore.getState().recordActivity(input);
}
