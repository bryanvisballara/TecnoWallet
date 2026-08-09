import { create } from 'zustand';

import {
  seedCalendarItems,
  type CalendarItem,
  type CalendarItemType,
} from '@/data/calendar';
import { localStorage } from '@/services/persistence';

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

const STORAGE_KEY = 'calendars-v1';
const COLORS = ['#0878F9', '#7F56D9', '#12B76A', '#F79009', '#EE46BC', '#06AED4'];

export const ownerSelf: CalendarMember = {
  id: 'me',
  name: 'Alex Rivera',
  email: 'alex@tecnowallet.app',
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

async function persist(state: PersistedCalendarState) {
  await localStorage.set(STORAGE_KEY, state);
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendars: defaultCalendars,
  activeCalendarId: 'personal',
  items: defaultItems,
  hydrated: false,

  hydrate: async () => {
    const saved = await localStorage.get<PersistedCalendarState | null>(STORAGE_KEY, null);
    if (!saved?.calendars?.length) {
      const initial = {
        calendars: defaultCalendars,
        activeCalendarId: 'personal',
        items: defaultItems,
      };
      await persist(initial);
      set({ ...initial, hydrated: true });
      return;
    }
    const activeCalendarId = saved.calendars.some((item) => item.id === saved.activeCalendarId)
      ? saved.activeCalendarId
      : saved.calendars[0].id;
    const items = (saved.items?.length ? saved.items : defaultItems).map((item) => ({
      ...item,
      calendarId: item.calendarId ?? activeCalendarId,
    }));
    const next = {
      calendars: saved.calendars,
      activeCalendarId,
      items,
    };
    await persist(next);
    set({ ...next, hydrated: true });
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
            member.email === trimmed ? { ...member, role, name: name?.trim() || member.name } : member,
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
  const calendarItems = items.filter((item) => (item.calendarId ?? 'personal') === activeCalendarId);
  return { calendar, calendars, items: calendarItems, activeCalendarId };
}

export type { CalendarItem, CalendarItemType };
