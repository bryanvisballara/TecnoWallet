import { apiRequest } from './api';
import { localStorage, tokenStorage } from './persistence';

const PENDING_INVITE_KEY = 'pending-collaboration-invite';
const SEEN_ACCESS_REQUESTS_KEY = 'seen-access-request-ids';

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

export type CollaborationAccessRequest = {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  requesterUserId: string;
  name: string;
  email: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
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

export function revokeCollaborationInvite(inviteId: string) {
  return apiRequest<{ revoked: boolean }>(
    `/collaboration/invites/${encodeURIComponent(inviteId)}`,
    { method: 'DELETE' },
  );
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

export function createAccessRequest(shareCode: string) {
  return apiRequest<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    status: 'pending';
    createdAt: string;
  }>('/collaboration/access-requests', {
    method: 'POST',
    body: JSON.stringify({ shareCode: shareCode.trim().toUpperCase() }),
  });
}

export function listAccessRequests(workspaceId: string) {
  const query = new URLSearchParams({ workspaceId });
  return apiRequest<{ requests: CollaborationAccessRequest[] }>(
    `/collaboration/access-requests?${query.toString()}`,
  ).then((result) => result.requests ?? []);
}

export function listOwnedAccessRequests() {
  return apiRequest<{ requests: CollaborationAccessRequest[] }>(
    '/collaboration/access-requests/inbox',
  ).then((result) => result.requests ?? []);
}

export function acceptAccessRequest(requestId: string) {
  return apiRequest<{ accepted: boolean; workspaceId: string }>(
    `/collaboration/access-requests/${encodeURIComponent(requestId)}/accept`,
    { method: 'POST', body: '{}' },
  );
}

export function rejectAccessRequest(requestId: string) {
  return apiRequest<{ rejected: boolean }>(
    `/collaboration/access-requests/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST', body: '{}' },
  );
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

export async function notifyNewAccessRequests(
  requests: CollaborationAccessRequest[],
) {
  if (!requests.length) return;
  const seen = await localStorage.get<string[]>(SEEN_ACCESS_REQUESTS_KEY, []);
  const seenSet = new Set(seen);
  const fresh = requests.filter((item) => !seenSet.has(item.id));
  if (!fresh.length) return;

  const { recordActivity } = await import('@/store/notifications');
  for (const request of fresh) {
    await recordActivity({
      kind: 'envelope',
      sound: 'sobres',
      title: 'Solicitud de acceso',
      body: `${request.name} quiere unirse a ${request.workspaceName ?? 'tu libro'}`,
      icon: 'person.badge.plus',
      tone: 'blue',
      route: `/(tabs)/ledgers?focus=${encodeURIComponent(request.workspaceId)}&tab=share`,
    });
  }

  const nextSeen = [...seenSet, ...fresh.map((item) => item.id)].slice(-200);
  await localStorage.set(SEEN_ACCESS_REQUESTS_KEY, nextSeen);
}
