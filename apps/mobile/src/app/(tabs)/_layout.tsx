import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { AppIcon, useAppTheme } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { useLedgerStore } from '@/store/ledger';

const tabs = [
  { name: 'inicio', title: 'Inicio', icon: 'house.fill' },
  { name: 'sobres', title: 'Sobres', icon: 'wallet.pass.fill' },
  { name: 'cuentas', title: 'Finanzas', icon: 'creditcard.fill' },
  { name: 'recaudos', title: 'Recaudos', icon: 'person.2.fill' },
  { name: 'calendario', title: 'Calendario', icon: 'calendar', a11y: 'Calendario' },
  { name: 'mas', title: 'Más', icon: 'ellipsis.circle.fill' },
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
  'recaudo/[id]',
  'afiliados',
] as const;

export default function TabsLayout() {
  const theme = useAppTheme();
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
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.a11y ?? tab.title,
            tabBarIcon: ({ color, focused }) => (
              <AppIcon name={tab.icon} color={color} size={focused ? 22 : 20} />
            ),
          }}
        />
      ))}
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
