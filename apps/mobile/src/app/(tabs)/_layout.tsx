import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { AppIcon, useAppTheme } from '@/components/ui';

const tabs = [
  { name: 'inicio', title: 'Inicio', icon: 'house.fill' },
  { name: 'sobres', title: 'Sobres', icon: 'wallet.pass.fill' },
  { name: 'cuentas', title: 'Finanzas', icon: 'creditcard.fill' },
  { name: 'recaudos', title: 'Recaudos', icon: 'person.2.fill' },
  { name: 'calendario', title: 'Calendario', icon: 'calendar', a11y: 'Calendario' },
  { name: 'mas', title: 'Más', icon: 'ellipsis.circle.fill' },
];

const hiddenTabs = ['mis-cuentas', 'salud-financiera', 'metas', 'movimientos'] as const;

export default function TabsLayout() {
  const theme = useAppTheme();
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
  hiddenNativeBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    height: 0,
  },
});
