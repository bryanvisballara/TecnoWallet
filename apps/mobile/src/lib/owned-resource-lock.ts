import { hasPaidPlan, type PlusAccess } from '@/services/plus-api';

type MemberLike = { id: string; role: string };

type ResourceLike = {
  type?: string;
  members?: MemberLike[] | null;
};

function isGuestSeat(members: MemberLike[] | null | undefined) {
  const me = members?.find((member) => member.id === 'me');
  return Boolean(me && me.role !== 'owner');
}

/** Owned personal books stay locked until the user pays or starts the trial. */
export function isOwnedResourceLocked(
  resource: ResourceLike | null | undefined,
  access: PlusAccess | null | undefined,
) {
  if (hasPaidPlan(access)) return false;
  if (!resource) return true;
  if (isGuestSeat(resource.members)) return false;
  if (resource.type === 'shared' && !resource.members?.some((member) => member.id === 'me' && member.role === 'owner')) {
    return false;
  }
  if (
    !resource.members?.some((member) => member.id === 'me') &&
    (resource.members?.length ?? 0) > 1
  ) {
    return false;
  }
  return true;
}

export function firstUnlockedLedgerId(
  ledgers: Array<{ id: string; type?: string; members?: MemberLike[] | null }>,
  access: PlusAccess | null | undefined,
) {
  return ledgers.find((ledger) => !isOwnedResourceLocked(ledger, access))?.id;
}

export function firstUnlockedCalendarId(
  calendars: Array<{ id: string; members?: MemberLike[] | null }>,
  access: PlusAccess | null | undefined,
) {
  return calendars.find((calendar) => !isOwnedResourceLocked(calendar, access))?.id;
}
