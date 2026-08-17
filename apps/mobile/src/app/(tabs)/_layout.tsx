import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { AppIcon, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import { FEATURE_RECAUDOS_ENABLED } from '@/lib/feature-flags';
import { useAuthStore } from '@/store/auth';
import { useLedgerStore } from '@/store/ledger';

const tabDefs = [
  { name: 'inicio', key: 'inicio' as const, icon: 'house.fill' },
  { name: 'sobres', key: 'sobres' as const, icon: 'wallet.pass.fill' },
  { name: 'cuentas', key: 'finanzas' as const, icon: 'creditcard.fill' },
  ...(FEATURE_RECAUDOS_ENABLED
    ? [{ name: 'recaudos', key: 'recaudos' as const, icon: 'person.2.fill' }]
    : []),
  { name: 'calendario', key: 'calendario' as const, icon: 'calendar' },
  { name: 'mas', key: 'mas' as const, icon: 'ellipsis.circle.fill' },
];

/** Secondary routes keep the floating tab bar but stay out of the tab strip. */
const hiddenTabs = [
  'mis-cuentas',
  'salud-financiera',
  'metas',
  'movimientos',
  'bank-accounts',
  'feature/[slug]',
  'profile',
  'notifications',
  'ledgers',
  'calendars',
  'patrimonio',
  'export',
  'envelope/[id]',
  'account/[id]',
  'cashflow/[type]',
  'goal/[id]',
  ...(FEATURE_RECAUDOS_ENABLED ? [] : (['recaudos'] as const)),
  'recaudo/[id]',
  'afiliados',
  'admin',
] as const;

export default function TabsLayout() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const hydrated = useAuthStore((state) => state.hydrated);
  const authenticated = useAuthStore((state) => state.authenticated);
  const ledgerHydrated = useLedgerStore((state) => state.hydrated);
  const ledgerCount = useLedgerStore((state) => state.ledgers.length);

  if (!hydrated || (authenticated && !ledgerHydrated)) {
    return (
      <View style={[styles.boot, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!authenticated || ledgerCount === 0) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      initialRouteName="inicio"
      tabBar={(props) => (
        <FloatingTabBar
          state={props.state}
          descriptors={props.descriptors}
          navigation={props.navigation}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: styles.hiddenNativeBar,
        sceneStyle: { backgroundColor: theme.background },
      }}>
      {tabDefs.map((tab) => {
        const title = copy.tabs[tab.key];
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title,
              tabBarAccessibilityLabel: title,
              tabBarIcon: ({ color, focused }) => (
                <AppIcon name={tab.icon} color={color} size={focused ? 22 : 20} />
              ),
            }}
          />
        );
      })}
      {hiddenTabs.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hiddenNativeBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    height: 0,
  },
});
