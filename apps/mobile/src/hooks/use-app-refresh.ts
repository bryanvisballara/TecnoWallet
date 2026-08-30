import { useCallback, useState } from 'react';

import { useAuthStore } from '@/store/auth';
import { useCalendarStore } from '@/store/calendar';
import { useGoalsStore } from '@/store/goals';
import { useLedgerStore } from '@/store/ledger';
import { useNotificationsStore } from '@/store/notifications';
import { usePlusStore } from '@/store/plus';
import { useRecaudosStore } from '@/store/recaudos';

/** Reload product data from the API (ledgers, calendar, recaudos, goals, billing, notifications). */
export async function refreshAppData() {
  const authenticated = useAuthStore.getState().authenticated;
  if (!authenticated) {
    await useAuthStore.getState().hydrate().catch(() => undefined);
    return;
  }

  await Promise.all([
    useLedgerStore.getState().hydrate().catch(() => undefined),
    useCalendarStore.getState().hydrate().catch(() => undefined),
    useRecaudosStore.getState().refresh().catch(() => undefined),
    useGoalsStore.getState().hydrate().catch(() => undefined),
    usePlusStore.getState().hydrate().catch(() => undefined),
    useNotificationsStore.getState().hydrate().catch(() => undefined),
    useAuthStore.getState().hydrate().catch(() => undefined),
    import('@/store/access-requests').then(({ useAccessRequestsStore }) =>
      useAccessRequestsStore.getState().refresh(),
    ).catch(() => undefined),
  ]);

  try {
    const { notifyAllSharedCollaborators } = await import(
      '@/services/collaboration-api'
    );
    await notifyAllSharedCollaborators();
  } catch {
    // Collaborator notify is best-effort on pull-to-refresh.
  }

  await useNotificationsStore.getState().syncBadge().catch(() => undefined);
}

/** Shared pull-to-refresh state for Screen and custom scroll views. */
export function useAppRefresh() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshAppData().finally(() => setRefreshing(false));
  }, []);

  return { refreshing, onRefresh };
}
