import { create } from 'zustand';

import {
  seedCalendarItems,
  type CalendarItem,
  type CalendarItemType,
} from '@/data/calendar';

type CalendarState = {
  items: CalendarItem[];
  addItem: (item: Omit<CalendarItem, 'id'> & { id?: string }) => void;
  toggleTask: (id: string) => void;
  removeItem: (id: string) => void;
};

export const useCalendarStore = create<CalendarState>((set) => ({
  items: seedCalendarItems,
  addItem: (item) =>
    set((state) => ({
      items: [
        {
          ...item,
          id: item.id ?? `cal-${Date.now()}`,
        },
        ...state.items,
      ],
    })),
  toggleTask: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id && item.type === 'task'
          ? { ...item, completed: !item.completed }
          : item,
      ),
    })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}));

export type { CalendarItem, CalendarItemType };
