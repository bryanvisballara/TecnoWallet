import { create } from 'zustand';

import { money, type Transaction } from '@/data/demo';
import {
  formatDayLabel,
  parseDateKey,
  typeIcons,
  type CalendarItem,
} from '@/data/calendar';
import type { LedgerMeta } from '@/data/ledgers';
import { localStorage } from '@/services/persistence';
import { useLanguageStore } from '@/store/language';

export type NotificationKind = 'calendar' | 'income' | 'expense';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  icon: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
  when: string;
  sortKey: string;
};

type NotificationsState = {
  readIds: string[];
  dismissedIds: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markAllRead: (ids: string[]) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissMany: (ids: string[]) => Promise<void>;
};

const READ_KEY = 'notification-read-ids';
const DISMISS_KEY = 'notification-dismissed-ids';

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  readIds: [],
  dismissedIds: [],
  hydrated: false,
  hydrate: async () => {
    const [readIds, dismissedIds] = await Promise.all([
      localStorage.get<string[]>(READ_KEY, []),
      localStorage.get<string[]>(DISMISS_KEY, []),
    ]);
    set({ readIds, dismissedIds, hydrated: true });
  },
  markAllRead: async (ids) => {
    const merged = Array.from(new Set([...get().readIds, ...ids]));
    set({ readIds: merged });
    await localStorage.set(READ_KEY, merged);
  },
  markRead: async (id) => {
    if (get().readIds.includes(id)) return;
    const merged = [...get().readIds, id];
    set({ readIds: merged });
    await localStorage.set(READ_KEY, merged);
  },
  dismiss: async (id) => {
    if (get().dismissedIds.includes(id)) return;
    const merged = [...get().dismissedIds, id];
    set({ dismissedIds: merged });
    await localStorage.set(DISMISS_KEY, merged);
  },
  dismissMany: async (ids) => {
    if (!ids.length) return;
    const merged = Array.from(new Set([...get().dismissedIds, ...ids]));
    set({ dismissedIds: merged });
    await localStorage.set(DISMISS_KEY, merged);
  },
}));

function txSortKey(date: string, id: string) {
  if (date.startsWith('Hoy') || date === 'Ahora') return `9-${id}`;
  if (date.startsWith('Ayer')) return `8-${id}`;
  return `5-${date}-${id}`;
}

export function buildNotificationFeed(input: {
  calendarItems: CalendarItem[];
  ledgers: LedgerMeta[];
  snapshots: Record<string, { transactions: Transaction[] }>;
  selfName: string;
}): AppNotification[] {
  const feed: AppNotification[] = [];

  input.calendarItems.forEach((item) => {
    const day = formatDayLabel(parseDateKey(item.date), useLanguageStore.getState().locale);
    feed.push({
      id: `cal-${item.id}`,
      kind: 'calendar',
      title: item.type === 'birthday' ? 'Cumpleaños en el calendario' : 'Evento nuevo en el calendario',
      body: `${item.title} · ${day}`,
      icon: typeIcons[item.type],
      tone: item.type === 'birthday' ? 'green' : 'purple',
      when: day,
      sortKey: `cal-${item.date}-${item.id}`,
    });
  });

  input.ledgers
    .filter((ledger) => ledger.type === 'shared')
    .forEach((ledger) => {
      const txs = input.snapshots[ledger.id]?.transactions ?? [];
      txs.forEach((tx) => {
        const author = tx.createdBy?.trim();
        if (!author) return;

        const isIncome = tx.amount > 0;
        feed.push({
          id: `tx-${ledger.id}-${tx.id}`,
          kind: isIncome ? 'income' : 'expense',
          title: isIncome ? 'Ingreso del equipo' : 'Gasto del equipo',
          body: `${author} registró ${tx.title} · ${money(Math.abs(tx.amount))} · ${ledger.name}`,
          icon: isIncome ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill',
          tone: isIncome ? 'green' : 'orange',
          when: tx.date,
          sortKey: txSortKey(tx.date, tx.id),
        });
      });
    });

  return feed.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export function notificationToneColors(
  tone: AppNotification['tone'],
  theme: { primarySoft: string; primary: string; successSoft: string; success: string; surfaceSecondary: string; warning: string },
) {
  if (tone === 'green') return { bg: theme.successSoft, fg: theme.success };
  if (tone === 'orange') return { bg: theme.surfaceSecondary, fg: theme.warning };
  if (tone === 'purple') return { bg: '#F4EBFF', fg: '#7F56D9' };
  return { bg: theme.primarySoft, fg: theme.primary };
}

// Helper kept next to feed builder for UI consumers.
export function visibleNotifications(feed: AppNotification[], dismissedIds: string[]) {
  return feed.filter((item) => !dismissedIds.includes(item.id));
}

export function unreadCount(feed: AppNotification[], readIds: string[], dismissedIds: string[] = []) {
  return feed.filter((item) => !dismissedIds.includes(item.id) && !readIds.includes(item.id)).length;
}
