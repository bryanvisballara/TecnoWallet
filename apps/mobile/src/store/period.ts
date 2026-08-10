import { create } from 'zustand';

import {
  formatMonthLabel,
  isSameMonth,
  monthFromDate,
  shiftMonth,
  type MonthCursor,
} from '@/lib/dates';
import { useLanguageStore } from '@/store/language';

type PeriodState = MonthCursor & {
  label: string;
  isCurrentMonth: boolean;
  setMonth: (cursor: MonthCursor) => void;
  goPrevMonth: () => void;
  goNextMonth: () => void;
  goToCurrentMonth: () => void;
  refreshLabel: () => void;
};

function withMeta(cursor: MonthCursor): Pick<PeriodState, 'year' | 'month' | 'label' | 'isCurrentMonth'> {
  const now = monthFromDate();
  const locale = useLanguageStore.getState().locale;
  return {
    ...cursor,
    label: formatMonthLabel(cursor, 'long', locale),
    isCurrentMonth: isSameMonth(cursor, now),
  };
}

const initial = withMeta(monthFromDate());

export const usePeriodStore = create<PeriodState>((set, get) => ({
  ...initial,
  setMonth: (cursor) => set(withMeta(cursor)),
  goPrevMonth: () => set(withMeta(shiftMonth(get(), -1))),
  goNextMonth: () => set(withMeta(shiftMonth(get(), 1))),
  goToCurrentMonth: () => set(withMeta(monthFromDate())),
  refreshLabel: () => set(withMeta({ year: get().year, month: get().month })),
}));
