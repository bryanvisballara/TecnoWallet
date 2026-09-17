import { notifyNewAccessRequests } from '@/services/collaboration-api';
import { useAccessRequestsStore } from '@/store/access-requests';

/** Refresh organizer inbox and surface new ID join requests (bell + share UI). */
export async function pollAccessRequestsInbox() {
  await useAccessRequestsStore.getState().refresh();
  await notifyNewAccessRequests(useAccessRequestsStore.getState().requests);
}
