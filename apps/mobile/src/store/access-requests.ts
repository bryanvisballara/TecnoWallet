import { create } from 'zustand';

import {
  listOwnedAccessRequests,
  type CollaborationAccessRequest,
} from '@/services/collaboration-api';

type AccessRequestsState = {
  requests: CollaborationAccessRequest[];
  hydrated: boolean;
  refresh: () => Promise<void>;
};

let inFlight: Promise<void> | null = null;

export const useAccessRequestsStore = create<AccessRequestsState>((set) => ({
  requests: [],
  hydrated: false,
  refresh: async () => {
    if (inFlight) return inFlight;
    inFlight = listOwnedAccessRequests()
      .then((requests) => {
        set({ requests, hydrated: true });
      })
      .catch(() => {
        set({ hydrated: true });
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },
}));

export function calendarAccessRequests(requests: CollaborationAccessRequest[]) {
  return requests.filter(
    (row) => row.resourceType === 'calendar' || Boolean(row.calendarId),
  );
}

export function workspaceAccessRequests(
  requests: CollaborationAccessRequest[],
  workspaceId?: string,
) {
  const rows = requests.filter(
    (row) =>
      row.resourceType === 'workspace' ||
      (Boolean(row.workspaceId) && !row.calendarId),
  );
  if (!workspaceId) return rows;
  return rows.filter((row) => row.workspaceId === workspaceId);
}
