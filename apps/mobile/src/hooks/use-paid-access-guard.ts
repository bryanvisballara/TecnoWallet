import { useEffect } from 'react';

import { usePaidAccessReady } from '@/hooks/use-paid-access-ready';
import {
  guardPaidCalendarAction,
  guardPaidLedgerAction,
} from '@/lib/require-paid-access';
import { safeGoBack } from '@/lib/navigation';

export function usePaidLedgerGuard(fallback = '/(tabs)/inicio') {
  const ready = usePaidAccessReady();
  useEffect(() => {
    if (!ready) return;
    if (!guardPaidLedgerAction('UPGRADE')) {
      safeGoBack(fallback);
    }
  }, [ready, fallback]);
}

export function usePaidCalendarGuard(fallback = '/(tabs)/calendario') {
  const ready = usePaidAccessReady();
  useEffect(() => {
    if (!ready) return;
    if (!guardPaidCalendarAction('UPGRADE')) {
      safeGoBack(fallback);
    }
  }, [ready, fallback]);
}
