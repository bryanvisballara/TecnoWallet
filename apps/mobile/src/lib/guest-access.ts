import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';

export {
  firstUnlockedCalendarId,
  firstUnlockedLedgerId,
  isOwnedResourceLocked,
} from '@/lib/owned-resource-lock';

function isNonOwnerSelf(member: { id: string; role: string }) {
  return member.id === 'me' && member.role !== 'owner';
}

/** True when this device already joined someone else's book or calendar. */
export function hasLocalGuestAccess() {
  const onSharedBook = useLedgerStore.getState().ledgers.some((ledger) => {
    if (ledger.members.some(isNonOwnerSelf)) return true;
    const isOwner = ledger.members.some(
      (member) => member.id === 'me' && member.role === 'owner',
    );
    return ledger.type === 'shared' && !isOwner && ledger.members.length > 1;
  });
  if (onSharedBook) return true;
  return useCalendarStore.getState().calendars.some((calendar) =>
    calendar.members.some(isNonOwnerSelf),
  );
}

