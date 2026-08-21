import { create } from 'zustand';

type CalendarFabState = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const useCalendarFabStore = create<CalendarFabState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
