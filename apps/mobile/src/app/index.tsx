import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { useLedgerStore } from '@/store/ledger';

export default function IndexScreen() {
  const theme = useAppTheme();
  const { hydrated, onboarded, authenticated } = useAuthStore();
  const ledgerHydrated = useLedgerStore((state) => state.hydrated);
  const ledgerCount = useLedgerStore((state) => state.ledgers.length);

  if (!hydrated || (authenticated && !ledgerHydrated)) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!authenticated) return <Redirect href="/auth" />;
  // Auth flag without books usually means a dead token mid-hydrate — back to login.
  if (ledgerCount === 0) return <Redirect href="/auth" />;
  return <Redirect href="/(tabs)/inicio" />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
