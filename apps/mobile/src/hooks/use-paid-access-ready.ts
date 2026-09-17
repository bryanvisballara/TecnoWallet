import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';
import { usePlusStore } from '@/store/plus';

/** Billing + book/calendar lists loaded enough to evaluate free locks. */
export function usePaidAccessReady() {
  const plusHydrated = usePlusStore((state) => state.hydrated);
  const ledgerHydrated = useLedgerStore((state) => state.hydrated);
  const calendarHydrated = useCalendarStore((state) => state.hydrated);
  return plusHydrated && ledgerHydrated && calendarHydrated;
}
