import { apiRequest } from './api';
import { localStorage, tokenStorage } from './persistence';

const PENDING_INVITE_KEY = 'pending-collaboration-invite';

export type CollaborationInvitePreview = {
  resourceType: 'workspace' | 'calendar';
  resourceName: string;
  role: 'member' | 'editor' | 'viewer';
  sponsorName: string;
  emailHint: string;
  expiresAt: string;
};

export type CollaborationResourceInvite = {
  id: string;
  email: string;
  role: 'member' | 'editor' | 'viewer';
  status: 'pending' | 'accepted';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export function lookupCollaborationInvite(token: string) {
  return apiRequest<CollaborationInvitePreview>(
    `/collaboration/invites/${encodeURIComponent(token)}`,
  );
}

export function listCollaborationInvites(input: {
  resourceType: 'workspace' | 'calendar';
  resourceId: string;
}) {
  const query = new URLSearchParams({
    resourceType: input.resourceType,
    resourceId: input.resourceId,
  });
  return apiRequest<{ invites: CollaborationResourceInvite[] }>(
    `/collaboration/invites?${query.toString()}`,
  ).then((result) => result.invites ?? []);
}

export function acceptCollaborationInvite(token: string) {
  return apiRequest<{
    accepted: boolean;
    resourceType: 'workspace' | 'calendar';
    resourceId: string;
  }>('/collaboration/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function storePendingCollaborationInvite(token: string) {
  return localStorage.set(PENDING_INVITE_KEY, token);
}

export async function claimPendingCollaborationInvite() {
  if (!(await tokenStorage.get())) return null;
  const token = await localStorage.get(PENDING_INVITE_KEY, '');
  if (!token) return null;
  const result = await acceptCollaborationInvite(token);
  await localStorage.remove(PENDING_INVITE_KEY);
  return result;
}
