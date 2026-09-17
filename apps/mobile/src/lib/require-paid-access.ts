import { isOwnedResourceLocked } from '@/lib/owned-resource-lock';
import { hasPaidPlan, type PlusAccess } from '@/services/plus-api';
import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';
import { usePlusStore, type PlusReason } from '@/store/plus';

export function isActiveLedgerLocked(access?: PlusAccess | null) {
  const plusAccess = access ?? usePlusStore.getState().access;
  if (hasPaidPlan(plusAccess)) return false;
  const { ledgers, activeLedgerId } = useLedgerStore.getState();
  const active = ledgers.find((ledger) => ledger.id === activeLedgerId);
  return isOwnedResourceLocked(active, plusAccess);
}

export function isActiveCalendarLocked(access?: PlusAccess | null) {
  const plusAccess = access ?? usePlusStore.getState().access;
  if (hasPaidPlan(plusAccess)) return false;
  const { calendars, activeCalendarId } = useCalendarStore.getState();
  const active = calendars.find((calendar) => calendar.id === activeCalendarId);
  return isOwnedResourceLocked(active, plusAccess);
}

/** Returns true when the action may proceed. */
export function guardPaidLedgerAction(reason: PlusReason = 'UPGRADE') {
  if (!isActiveLedgerLocked()) return true;
  usePlusStore.getState().openPaywall(reason);
  return false;
}

/** Returns true when the action may proceed. */
export function guardPaidCalendarAction(reason: PlusReason = 'UPGRADE') {
  if (!isActiveCalendarLocked()) return true;
  usePlusStore.getState().openPaywall(reason);
  return false;
}

export function withPaidLedgerAccess(
  action: () => void,
  reason: PlusReason = 'UPGRADE',
) {
  if (guardPaidLedgerAction(reason)) action();
}

export function withPaidCalendarAccess(
  action: () => void,
  reason: PlusReason = 'UPGRADE',
) {
  if (guardPaidCalendarAction(reason)) action();
}
