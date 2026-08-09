import { create } from 'zustand';

import {
  seedCalendarItems,
  type CalendarItem,
  type CalendarItemType,
} from '@/data/calendar';
import { apiRequest } from '@/services/api';
import { objectId } from '@/services/ledgers-api';
import { localStorage } from '@/services/persistence';
import { useLedgerStore } from '@/store/ledger';

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
  addItem: (item: Omit<CalendarItem, 'id'> & { id?: string }) => string;
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

let settingResourceId: string | null = null;

function workspaceId() {
  return useLedgerStore.getState().activeLedgerId;
}

function sanitize(state: PersistedCalendarState): PersistedCalendarState {
  return {
    calendars: state.calendars,
    activeCalendarId: state.activeCalendarId,
    items: state.items,
  };
}

async function persist(state: PersistedCalendarState) {
  const demo = await localStorage.get('demo-session', false);
  const ws = workspaceId();
  if (demo || !ws) return;
  const payload = sanitize(state);
  if (settingResourceId) {
    await apiRequest(`/resources/setting/${settingResourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: payload }),
    });
    return;
  }
  const created = await apiRequest<SettingResource>('/resources/setting', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: ws,
      name: SETTING_NAME,
      privacy: 'workspace',
      data: payload,
    }),
  });
  settingResourceId = objectId(created);
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
      if (!found) {
        const initial = {
          calendars: defaultCalendars,
          activeCalendarId: 'personal',
          items: [] as CalendarItem[],
        };
        settingResourceId = null;
        await persist(initial);
        set({ ...initial, hydrated: true });
        return;
      }
      settingResourceId = objectId(found);
      const data = (found.data ?? {}) as Partial<PersistedCalendarState>;
      const calendars =
        Array.isArray(data.calendars) && data.calendars.length
          ? data.calendars
          : defaultCalendars;
      const activeCalendarId = calendars.some(
        (item) => item.id === data.activeCalendarId,
      )
        ? (data.activeCalendarId as string)
        : calendars[0].id;
      const items = (Array.isArray(data.items) ? data.items : []).map((item) => ({
        ...item,
        calendarId: item.calendarId ?? activeCalendarId,
      }));
      set({ calendars, activeCalendarId, items, hydrated: true });
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
    const id = `cal-book-${Date.now()}`;
    const calendar: CalendarBook = {
      id,
      name: name.trim() || 'Nuevo calendario',
      color: color ?? COLORS[get().calendars.length % COLORS.length],
      icon: 'calendar',
      members: [{ ...ownerSelf }],
    };
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
    await persist(next);
  },

  inviteMember: async (calendarId, email, role, name) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) throw new Error('Correo inválido.');
    const calendars = get().calendars.map((calendar) => {
      if (calendar.id !== calendarId) return calendar;
      if (calendar.members.some((member) => member.email === trimmed)) {
        return {
          ...calendar,
          members: calendar.members.map((member) =>
            member.email === trimmed
              ? { ...member, role, name: name?.trim() || member.name }
              : member,
          ),
        };
      }
      return {
        ...calendar,
        members: [
          ...calendar.members,
          {
            id: `cm-${Date.now()}`,
            name: name?.trim() || trimmed.split('@')[0],
            email: trimmed,
            role,
          },
        ],
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

  removeMember: async (calendarId, memberId) => {
    if (memberId === 'me') return;
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

  addItem: (item) => {
    const calendarId = item.calendarId ?? get().activeCalendarId;
    const nextItem: CalendarItem = {
      ...item,
      id: item.id ?? `cal-${Date.now()}`,
      calendarId,
    };
    const items = [nextItem, ...get().items];
    set({ items });
    void persist({
      calendars: get().calendars,
      activeCalendarId: get().activeCalendarId,
      items,
    });
    return nextItem.id;
  },

  toggleTask: (id) => {
    const items = get().items.map((item) =>
      item.id === id && item.type === 'task'
        ? { ...item, completed: !item.completed }
        : item,
    );
    set({ items });
    void persist({
      calendars: get().calendars,
      activeCalendarId: get().activeCalendarId,
      items,
    });
  },

  removeItem: (id) => {
    const items = get().items.filter((item) => item.id !== id);
    set({ items });
    void persist({
      calendars: get().calendars,
      activeCalendarId: get().activeCalendarId,
      items,
    });
    void import('@/services/push-notifications').then(({ cancelCalendarReminder }) =>
      cancelCalendarReminder(id),
    );
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
