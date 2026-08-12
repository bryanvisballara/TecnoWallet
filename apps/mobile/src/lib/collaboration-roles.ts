/** True when the signed-in user is the owner of this shared resource. */
export function isSelfOwner(
  members: Array<{ id: string; role: string }> | undefined | null,
): boolean {
  if (!members?.length) return false;
  return members.some(
    (member) => member.id === 'me' && (member.role === 'owner' || member.role === 'admin'),
  );
}

/**
 * Free 5-envelope client gate applies only on personal books owned by the user.
 * Shared-team books (and any non-owner seat) must never open the owner paywall.
 */
export function shouldEnforceFreeEnvelopeLimit(
  ledger:
    | {
        type?: string;
        members?: Array<{ id: string; role: string }> | null;
      }
    | null
    | undefined,
): boolean {
  if (!ledger) return false;
  if (ledger.type === 'shared') return false;
  return isSelfOwner(ledger.members);
}
