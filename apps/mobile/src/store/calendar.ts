import { create } from 'zustand';

import {
  seedCalendarItems,
  typeLabels,
  typeIcons,
  type CalendarItem,
  type CalendarItemType,
} from '@/data/calendar';
import { apiRequest } from '@/services/api';
import {
  createCalendar as createCalendarApi,
  createCalendarItem,
  deleteCalendarItem,
  inviteCalendarMember,
  listCalendarItems,
  listCalendarMembers,
  listCalendars,
  removeCalendarMember,
  updateCalendar,
  updateCalendarItem,
  type ApiCalendar,
} from '@/services/calendar-api';
import { localStorage } from '@/services/persistence';
import { useLedgerStore } from '@/store/ledger';
import { recordActivity } from '@/store/notifications';

export type CalendarMemberRole = 'owner' | 'editor' | 'viewer';

export type CalendarMember = {
  id: string;
  name: string;
  email: string;
  role: CalendarMemberRole;
};

export type CalendarBook = {
  id: string;
  name: string;
  color: string;
  icon: string;
  members: CalendarMember[];
};

type PersistedCalendarState = {
  calendars: CalendarBook[];
  activeCalendarId: string;
  items: CalendarItem[];
};

type CalendarState = PersistedCalendarState & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setActiveCalendar: (id: string) => Promise<void>;
  createCalendar: (name: string, color?: string) => Promise<string>;
  renameCalendar: (id: string, name: string) => Promise<void>;
  inviteMember: (
    calendarId: string,
    email: string,
    role: 'editor' | 'viewer',
    name?: string,
  ) => Promise<void>;
  removeMember: (calendarId: string, memberId: string) => Promise<void>;
  addItem: (item: Omit<CalendarItem, 'id'> & { id?: string }) => Promise<string>;
  updateItem: (item: CalendarItem) => Promise<void>;
  toggleTask: (id: string) => void;
  removeItem: (id: string) => void;
};

const COLORS = ['#0878F9', '#7F56D9', '#12B76A', '#F79009', '#EE46BC', '#06AED4'];
const SETTING_NAME = 'calendar-state';

export const ownerSelf: CalendarMember = {
  id: 'me',
  name: 'Usuario',
  email: '',
  role: 'owner',
};

const defaultCalendars: CalendarBook[] = [
  {
    id: 'personal',
    name: 'Mi calendario',
    color: '#0878F9',
    icon: 'calendar',
    members: [{ ...ownerSelf }],
  },
];

const defaultItems: CalendarItem[] = seedCalendarItems.map((item) => ({
  ...item,
  calendarId: item.calendarId ?? 'personal',
}));

type SettingResource = {
  _id?: string;
  id?: string;
  name: string;
  data?: Record<string, unknown>;
  version?: number;
};

function workspaceId() {
  return useLedgerStore.getState().activeLedgerId;
}

function clientObjectId() {
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `${timestamp}${random}`.slice(0, 24);
}

function deterministicObjectId(value: string) {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
  }
  const seed = `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
  return `${seed}${seed.slice(0, 8)}`.slice(0, 24);
}

async function persist(state: PersistedCalendarState) {
  const demo = await localStorage.get('demo-session', false);
  const ws = workspaceId();
  if (demo || !ws) return;
  await localStorage.set(`calendar-active-${ws}`, state.activeCalendarId);
}

function calendarBook(calendar: ApiCalendar, members: CalendarMember[] = []): CalendarBook {
  return {
    id: calendar._id,
    name: calendar.name,
    color: calendar.color,
    icon: calendar.icon,
    members,
  };
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendars: defaultCalendars,
  activeCalendarId: 'personal',
  items: [],
  hydrated: false,

  hydrate: async () => {
    const demo = await localStorage.get('demo-session', false);
    if (demo) {
      set({
        calendars: defaultCalendars,
        activeCalendarId: 'personal',
        items: defaultItems,
        hydrated: true,
      });
      return;
    }

    const ws = workspaceId();
    if (!ws) {
      set({
        calendars: defaultCalendars,
        activeCalendarId: 'personal',
        items: [],
        hydrated: true,
      });
      return;
    }

    try {
      const settings = await apiRequest<SettingResource[]>(
        `/resources/setting?workspaceId=${encodeURIComponent(ws)}&limit=50`,
      );
      const found = settings.find((item) => item.name === SETTING_NAME);
      const data = (found?.data ?? {}) as Partial<PersistedCalendarState>;
      const legacyCalendars =
        Array.isArray(data.calendars) && data.calendars.length
          ? data.calendars
          : defaultCalendars;
      const legacyItems = (Array.isArray(data.items) ? data.items : []).map((item) => ({
        ...item,
        calendarId: item.calendarId ?? data.activeCalendarId ?? 'personal',
      }));

      let remoteCalendars = await listCalendars(ws);
      if (
        remoteCalendars.length === 0 ||
        remoteCalendars.some((calendar) => calendar.migrationSourceId)
      ) {
        for (const legacy of legacyCalendars) {
          if (
            remoteCalendars.some(
              (calendar) => calendar.migrationSourceId === legacy.id,
            )
          ) {
            continue;
          }
          try {
            const created = await createCalendarApi({
              workspaceId: ws,
              name: legacy.name,
              color: legacy.color,
              icon: legacy.icon,
              migrationSourceId: legacy.id,
            });
            remoteCalendars = [...remoteCalendars, created];
          } catch {
            // A shared-workspace collaborator cannot migrate owner metadata.
          }
        }
      }

      const legacyToRemote = new Map(
        remoteCalendars
          .filter((calendar) => calendar.migrationSourceId)
          .map((calendar) => [calendar.migrationSourceId as string, calendar._id]),
      );
      let items = (
        await Promise.all(
          remoteCalendars.map((calendar) =>
            listCalendarItems(calendar._id).catch(() => []),
          ),
        )
      ).flat();
      const existingIds = new Set(items.map((item) => item.id));
      for (const legacy of legacyItems) {
        const calendarId = legacyToRemote.get(
          legacy.calendarId ?? data.activeCalendarId ?? 'personal',
        );
        if (!calendarId) continue;
        const id = deterministicObjectId(`${ws}:${legacy.id}`);
        if (existingIds.has(id)) continue;
        try {
          const migrated = await createCalendarItem({
            ...legacy,
            id,
            calendarId,
          });
          items = [...items, migrated];
          existingIds.add(id);
        } catch {
          // Duplicate retries are harmless; the next hydration reads MongoDB.
        }
      }

      const calendars = await Promise.all(
        remoteCalendars.map(async (calendar) => {
          const members = await listCalendarMembers(calendar._id).catch(() => []);
          return calendarBook(
            calendar,
            members.map((member) => ({
              id: String(member.userId),
              name: member.name ?? member.email?.split('@')[0] ?? 'Miembro',
              email: member.email ?? '',
              role: member.role,
            })),
          );
        }),
      );
      const nameByUserId = new Map<string, string>();
      for (const calendar of calendars) {
        for (const member of calendar.members) {
          if (member.id && member.name) nameByUserId.set(String(member.id), member.name);
        }
      }
      items = items.map((item) => {
        const authorId = item.createdByUserId?.trim();
        if (!authorId) return item;
        return {
          ...item,
          createdBy: nameByUserId.get(authorId) ?? item.createdBy,
        };
      });
      const savedActive = await localStorage.get(
        `calendar-active-${ws}`,
        '',
      );
      const migratedActive = legacyToRemote.get(
        data.activeCalendarId ?? 'personal',
      );
      const activeCalendarId = calendars.some(
        (calendar) => calendar.id === savedActive,
      )
        ? savedActive
        : calendars.some((calendar) => calendar.id === migratedActive)
          ? (migratedActive as string)
          : calendars[0]?.id ?? '';
      set({ calendars, activeCalendarId, items, hydrated: true });
      void import('@/services/collaboration-api').then(
        ({ notifyNewTeamCalendarItems }) =>
          notifyNewTeamCalendarItems().catch(() => undefined),
      );
    } catch {
      set({ hydrated: true });
    }
  },

  setActiveCalendar: async (id) => {
    if (!get().calendars.some((item) => item.id === id)) return;
    const next = {
      calendars: get().calendars,
      activeCalendarId: id,
      items: get().items,
    };
    set({ activeCalendarId: id });
    await persist(next);
  },

  createCalendar: async (name, color) => {
    const ws = workspaceId();
    if (!ws) throw new Error('Selecciona un libro primero.');
    const created = await createCalendarApi({
      workspaceId: ws,
      name: name.trim() || 'Nuevo calendario',
      color: color ?? COLORS[get().calendars.length % COLORS.length],
      icon: 'calendar',
    });
    const members = await listCalendarMembers(created._id).catch(() => []);
    const calendar = calendarBook(
      created,
      members.map((member) => ({
        id: member.userId,
        name: member.name ?? member.email?.split('@')[0] ?? 'Miembro',
        email: member.email ?? '',
        role: member.role,
      })),
    );
    const id = calendar.id;
    const next = {
      calendars: [...get().calendars, calendar],
      activeCalendarId: id,
      items: get().items,
    };
    set(next);
    await persist(next);
    return id;
  },

  renameCalendar: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const calendars = get().calendars.map((item) =>
      item.id === id ? { ...item, name: trimmed } : item,
    );
    const next = {
      calendars,
      activeCalendarId: get().activeCalendarId,
      items: get().items,
    };
    set({ calendars });
    await updateCalendar(id, { name: trimmed });
    await persist(next);
  },

  inviteMember: async (calendarId, email, role, name) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) throw new Error('Correo inválido.');
    await inviteCalendarMember({ calendarId, email: trimmed, role });
  },

  removeMember: async (calendarId, memberId) => {
    if (memberId === 'me') return;
    const member = get()
      .calendars.find((calendar) => calendar.id === calendarId)
      ?.members.find((item) => item.id === memberId);
    if (!member) return;
    await removeCalendarMember(calendarId, member.id);
    const calendars = get().calendars.map((calendar) => {
      if (calendar.id !== calendarId) return calendar;
      return {
        ...calendar,
        members: calendar.members.filter((member) => member.id !== memberId),
      };
    });
    const next = {
      calendars,
      activeCalendarId: get().activeCalendarId,
      items: get().items,
    };
    set({ calendars });
    await persist(next);
  },

  addItem: async (item) => {
    const calendarId = item.calendarId ?? get().activeCalendarId;
    if (!calendarId) {
      throw new Error('No hay un calendario activo.');
    }
    const nextItem: CalendarItem = {
      ...item,
      id: item.id ?? clientObjectId(),
      calendarId,
    };
    const items = [nextItem, ...get().items];
    set({ items });
    try {
      const created = await createCalendarItem(nextItem);
      set({
        items: get().items.map((current) =>
          current.id === nextItem.id ? { ...created, calendarId } : current,
        ),
      });
      const typeLabel = typeLabels[created.type] ?? 'Elemento';
      void recordActivity({
        kind: 'calendar',
        title: `${typeLabel} agregado`,
        body: created.reminder
          ? `${created.title} · ${created.date} · con recordatorio`
          : `${created.title} · ${created.date}`,
        icon: typeIcons[created.type] ?? 'calendar',
        route: '/(tabs)/calendario',
      });
      return created.id;
    } catch (error) {
      set({ items: get().items.filter((current) => current.id !== nextItem.id) });
      throw error instanceof Error
        ? error
        : new Error('No se pudo guardar en el calendario.');
    }
  },

  updateItem: async (item) => {
    const previous = get().items.find((current) => current.id === item.id);
    set({
      items: get().items.map((current) =>
        current.id === item.id ? item : current,
      ),
    });
    try {
      const saved = await updateCalendarItem(item);
      set({
        items: get().items.map((current) =>
          current.id === item.id
            ? { ...saved, calendarId: item.calendarId }
            : current,
        ),
      });
    } catch (error) {
      if (previous) {
        set({
          items: get().items.map((current) =>
            current.id === item.id ? previous : current,
          ),
        });
      }
      throw error instanceof Error
        ? error
        : new Error('No se pudo actualizar el elemento.');
    }
  },

  toggleTask: (id) => {
    let changed: CalendarItem | undefined;
    const items = get().items.map((item) =>
      item.id === id && item.type === 'task'
        ? (changed = { ...item, completed: !item.completed })
        : item,
    );
    set({ items });
    if (changed) void updateCalendarItem(changed);
  },

  removeItem: (id) => {
    const removed = get().items.find((item) => item.id === id);
    const items = get().items.filter((item) => item.id !== id);
    set({ items });
    void deleteCalendarItem(id);
    void import('@/services/push-notifications').then(({ cancelCalendarReminder }) =>
      cancelCalendarReminder(id),
    );
    if (removed) {
      const typeLabel = typeLabels[removed.type] ?? 'Elemento';
      void recordActivity({
        kind: 'calendar',
        title: `${typeLabel} eliminado`,
        body: `${removed.title} · ${removed.date}`,
        icon: 'trash',
        tone: 'red',
        route: '/(tabs)/calendario',
      });
    }
  },
}));

export function useActiveCalendar() {
  const activeCalendarId = useCalendarStore((state) => state.activeCalendarId);
  const calendars = useCalendarStore((state) => state.calendars);
  const items = useCalendarStore((state) => state.items);
  const calendar = calendars.find((item) => item.id === activeCalendarId) ?? calendars[0];
  const calendarItems = items.filter(
    (item) => (item.calendarId ?? 'personal') === activeCalendarId,
  );
  return { calendar, calendars, items: calendarItems, activeCalendarId };
}

export type { CalendarItem, CalendarItemType };
