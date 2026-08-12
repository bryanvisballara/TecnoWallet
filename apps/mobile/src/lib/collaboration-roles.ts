/** True when the signed-in user is the owner of this shared resource. */
export function isSelfOwner(
  members: Array<{ id: string; role: string }> | undefined | null,
): boolean {
  if (!members?.length) return false;
  return members.some(
    (member) => member.id === 'me' && (member.role === 'owner' || member.role === 'admin'),
  );
}
