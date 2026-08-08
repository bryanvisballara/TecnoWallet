import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FloatingTabBar } from '@/components/floating-tab-bar';
import { AppIcon, useAppTheme } from '@/components/ui';

const tabs = [
  { name: 'inicio', title: 'Inicio', icon: 'house.fill' },
  { name: 'sobres', title: 'Sobres', icon: 'wallet.pass.fill' },
  { name: 'cuentas', title: 'Cuentas', icon: 'creditcard.fill' },
  { name: 'movimientos', title: 'Movs', icon: 'arrow.up.arrow.down.circle.fill', a11y: 'Movimientos' },
  { name: 'calendario', title: 'Calendario', icon: 'calendar', a11y: 'Calendario' },
  { name: 'mas', title: 'Más', icon: 'ellipsis.circle.fill' },
];

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
