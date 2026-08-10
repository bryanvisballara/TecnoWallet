import { apiRequest } from './api';
import { localStorage, tokenStorage } from './persistence';

export const PENDING_COLLABORATION_INVITE_KEY = 'pending-collaboration-invite';
const PENDING_INVITE_KEY = PENDING_COLLABORATION_INVITE_KEY;
const SEEN_ACCESS_REQUESTS_KEY = 'seen-access-request-ids';
const SEEN_TEAM_TX_KEY = 'seen-team-transaction-ids';
const SEEN_TEAM_CAL_KEY = 'seen-team-calendar-item-ids';
const SEEN_TEAM_RECAUDO_KEY = 'seen-team-recaudo-activity-ids';

type SharedPushCandidate = {
  key: string;
  kind: 'income' | 'expense' | 'calendar' | 'recaudo';
  title: string;
  body: string;
  route: string;
  sound?: 'ingreso' | 'gasto' | 'calendario' | 'sobres' | 'default';
};

async function notifyFreshSharedPushes(
  storageKey: string,
  allKeys: string[],
  candidates: SharedPushCandidate[],
  maxSeen = 400,
) {
  const seen = await localStorage.get<string[]>(storageKey, []);
  const seenSet = new Set(seen);

  // First run after upgrade: seed without spamming historical activity.
  if (!seen.length && allKeys.length) {
    await localStorage.set(storageKey, allKeys.slice(0, maxSeen));
    return;
  }

  const fresh = candidates.filter((item) => !seenSet.has(item.key));
  if (!fresh.length) {
    if (allKeys.length) {
      await localStorage.set(
        storageKey,
        Array.from(new Set([...seen, ...allKeys])).slice(-maxSeen),
      );
    }
    return;
  }

  const { notifyActivity } = await import('@/services/push-notifications');
  const { recordActivity } = await import('@/store/notifications');
  for (const item of fresh) {
    if (item.kind === 'income' || item.kind === 'expense') {
      // In-app row comes from buildNotificationFeed; only fire OS push here.
      await notifyActivity({
        kind: item.kind,
        title: item.title,
        body: item.body,
        data: { route: item.route, notificationId: item.key },
      });
    } else {
      await recordActivity({
        kind: item.kind,
        title: item.title,
        body: item.body,
        icon: item.kind === 'calendar' ? 'calendar' : 'person.3.fill',
        sound: item.sound,
        route: item.route,
      });
    }
  }

  await localStorage.set(
    storageKey,
    Array.from(
      new Set([...seen, ...allKeys, ...fresh.map((item) => item.key)]),
    ).slice(-maxSeen),
  );
}

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
      kind: 'invite',
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

/**
 * Local OS push for collaborators when someone else registers a movement
 * on a shared book. Uses the same pattern as access-request polling
 * (device must open / foreground the app to pick up new activity until remote APNS exists).
 */
export async function notifyNewTeamTransactions() {
  const selfUserId = (await localStorage.get<string>('auth-user-id', '')) || '';
  if (!selfUserId) return;

  const { useLedgerStore } = await import('@/store/ledger');
  const { money } = await import('@/data/demo');

  const { ledgers, snapshots } = useLedgerStore.getState();
  const shared = ledgers.filter((ledger) => ledger.type === 'shared');
  if (!shared.length) return;

  const teamKeys: string[] = [];
  const candidates: SharedPushCandidate[] = [];

  for (const ledger of shared) {
    const txs = snapshots[ledger.id]?.transactions ?? [];
    for (const tx of txs) {
      const authorId = tx.createdByUserId?.trim();
      if (!authorId || authorId === selfUserId) continue;
      const key = `tx-${ledger.id}-${tx.id}`;
      teamKeys.push(key);
      const isIncome = tx.amount > 0;
      const who = tx.createdBy?.trim() || 'Un colaborador';
      candidates.push({
        key,
        kind: isIncome ? 'income' : 'expense',
        title: isIncome ? 'Ingreso del equipo' : 'Gasto del equipo',
        body: `${who} registró ${tx.title} · ${money(Math.abs(tx.amount))} · ${ledger.name}`,
        route: '/(tabs)/movimientos',
      });
    }
  }

  await notifyFreshSharedPushes(SEEN_TEAM_TX_KEY, teamKeys, candidates);
}

/** Push + in-app when someone else adds an item on a shared calendar. */
export async function notifyNewTeamCalendarItems() {
  const selfUserId = (await localStorage.get<string>('auth-user-id', '')) || '';
  if (!selfUserId) return;

  const { useCalendarStore } = await import('@/store/calendar');
  const { calendars, items } = useCalendarStore.getState();
  const shared = calendars.filter((calendar) => calendar.members.length > 1);
  if (!shared.length) return;

  const sharedIds = new Set(shared.map((calendar) => calendar.id));
  const nameByCalendar = new Map(shared.map((calendar) => [calendar.id, calendar.name]));
  const memberNameById = new Map<string, string>();
  for (const calendar of shared) {
    for (const member of calendar.members) {
      if (member.id && member.name) memberNameById.set(String(member.id), member.name);
    }
  }

  const teamKeys: string[] = [];
  const candidates: SharedPushCandidate[] = [];
  const typeLabel: Record<string, string> = {
    event: 'evento',
    task: 'tarea',
    birthday: 'cumpleaños',
  };

  for (const item of items) {
    const calendarId = item.calendarId ?? '';
    if (!sharedIds.has(calendarId)) continue;
    const authorId = item.createdByUserId?.trim();
    if (!authorId || authorId === selfUserId) continue;
    const key = `cal-${calendarId}-${item.id}`;
    teamKeys.push(key);
    const who =
      item.createdBy?.trim() ||
      memberNameById.get(authorId) ||
      'Un colaborador';
    const calendarName = nameByCalendar.get(calendarId) ?? 'Calendario';
    const kindLabel = typeLabel[item.type] ?? 'elemento';
    candidates.push({
      key,
      kind: 'calendar',
      title: 'Calendario compartido',
      body: `${who} agregó ${kindLabel} «${item.title}» · ${item.date} · ${calendarName}`,
      route: '/(tabs)/calendario',
      sound: 'calendario',
    });
  }

  await notifyFreshSharedPushes(SEEN_TEAM_CAL_KEY, teamKeys, candidates);
}

/** Push + in-app when someone else contributes or withdraws on a shared recaudo. */
export async function notifyNewTeamRecaudoActivity() {
  const selfUserId = (await localStorage.get<string>('auth-user-id', '')) || '';
  if (!selfUserId) return;

  const { useRecaudosStore } = await import('@/store/recaudos');
  const recaudos = useRecaudosStore.getState().recaudos.filter(
    (item) => item.participants.length > 1,
  );
  if (!recaudos.length) return;

  const teamKeys: string[] = [];
  const candidates: SharedPushCandidate[] = [];

  for (const recaudo of recaudos) {
    for (const contribution of recaudo.contributions) {
      const authorId = contribution.userId?.trim();
      if (!authorId || authorId === selfUserId) continue;
      const key = `rec-${recaudo.id}-${contribution.id}`;
      teamKeys.push(key);
      const who = contribution.participantName?.trim() || 'Un colaborador';
      const amount = (contribution.amountMinor / 100).toLocaleString('es-CO', {
        style: 'currency',
        currency: recaudo.currency || 'COP',
        maximumFractionDigits: 0,
      });
      const isWithdrawal = contribution.method === 'withdrawal';
      candidates.push({
        key,
        kind: 'recaudo',
        title: isWithdrawal ? 'Retiro del recaudo' : 'Aporte del equipo',
        body: isWithdrawal
          ? `${who} retiró ${amount} de ${recaudo.title}`
          : `${who} aportó ${amount} a ${recaudo.title}`,
        route: `/(tabs)/recaudo/${recaudo.id}`,
        sound: isWithdrawal ? 'gasto' : 'ingreso',
      });
    }
  }

  await notifyFreshSharedPushes(SEEN_TEAM_RECAUDO_KEY, teamKeys, candidates);
}

/** Fan-out local pushes for shared books, calendars, and recaudos. */
export async function notifyAllSharedCollaborators() {
  await Promise.all([
    notifyNewTeamTransactions().catch(() => undefined),
    notifyNewTeamCalendarItems().catch(() => undefined),
    notifyNewTeamRecaudoActivity().catch(() => undefined),
  ]);
  try {
    const { useNotificationsStore } = await import('@/store/notifications');
    await useNotificationsStore.getState().syncBadge();
  } catch {
    // Badge sync is best-effort.
  }
}
