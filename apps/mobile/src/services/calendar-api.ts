import type { CalendarItem } from '../data/calendar';
import { ApiError, apiRequest } from './api';

export type ApiCalendar = {
  _id: string;
  workspaceId: string;
  ownerId: string;
  name: string;
  color: string;
  icon: string;
  migrationSourceId?: string;
};

export type ApiCalendarMember = {
  id: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  name?: string;
  email?: string;
  sponsored: boolean;
};

type ApiCalendarItem = {
  _id: string;
  calendarId: string;
  ownerId?: string;
  data: Omit<CalendarItem, 'id' | 'calendarId' | 'createdBy' | 'createdByUserId'>;
};

function mapApiCalendarItem(record: ApiCalendarItem): CalendarItem {
  const createdByUserId = record.ownerId ? String(record.ownerId) : undefined;
  return {
    ...record.data,
    id: record._id,
    calendarId: String(record.calendarId),
    createdByUserId,
  };
}

export async function listCalendars(workspaceId: string) {
  try {
    return await apiRequest<ApiCalendar[]>(
      `/calendars?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
  } catch (error) {
    // Older API deploys may not expose /calendars yet — treat as empty.
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}

export function createCalendar(input: {
  workspaceId: string;
  name: string;
  color?: string;
  icon?: string;
  migrationSourceId?: string;
}) {
  return apiRequest<ApiCalendar>('/calendars', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCalendar(
  id: string,
  input: { name?: string; color?: string; icon?: string },
) {
  return apiRequest<ApiCalendar>(`/calendars/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCalendar(id: string) {
  return apiRequest<{ deleted: boolean }>(
    `/calendars/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export function fetchCalendarShareCode(calendarId: string) {
  return apiRequest<{ shareCode: string }>(
    `/calendars/${encodeURIComponent(calendarId)}/share-code`,
  ).then((result) => result.shareCode?.trim().toUpperCase() || '');
}

export function listCalendarMembers(id: string) {
  return apiRequest<ApiCalendarMember[]>(`/calendars/${id}/members`);
}

export function removeCalendarMember(calendarId: string, userId: string) {
  return apiRequest<{ removed: boolean }>(
    `/calendars/${encodeURIComponent(calendarId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}

export function inviteCalendarMember(input: {
  calendarId: string;
  email: string;
  role: 'editor' | 'viewer';
}) {
  return apiRequest<{ delivered?: boolean }>('/collaboration/invites', {
    method: 'POST',
    body: JSON.stringify({
      resourceType: 'calendar',
      resourceId: input.calendarId,
      email: input.email,
      role: input.role,
    }),
  });
}

export async function listCalendarItems(calendarId: string) {
  const records = await apiRequest<ApiCalendarItem[]>(
    `/calendars/${calendarId}/items`,
  );
  return records.map(mapApiCalendarItem);
}

export async function createCalendarItem(item: CalendarItem) {
  if (!item.calendarId) throw new Error('El evento necesita un calendario.');
  const {
    id,
    calendarId,
    createdBy: _createdBy,
    createdByUserId: _createdByUserId,
    ...data
  } = item;
  const record = await apiRequest<ApiCalendarItem>(
    `/calendars/${calendarId}/items`,
    { method: 'POST', body: JSON.stringify({ id, data }) },
  );
  return mapApiCalendarItem(record);
}

export async function updateCalendarItem(item: CalendarItem) {
  const {
    id,
    calendarId: _calendarId,
    createdBy: _createdBy,
    createdByUserId: _createdByUserId,
    ...data
  } = item;
  const record = await apiRequest<ApiCalendarItem>(
    `/calendars/items/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify({ data }) },
  );
  return mapApiCalendarItem(record);
}

export function deleteCalendarItem(id: string) {
  return apiRequest<{ deleted: boolean }>(
    `/calendars/items/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
