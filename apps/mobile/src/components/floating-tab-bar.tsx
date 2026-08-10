import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInUp,
  FadeOutDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppIcon } from '@/components/ui';
import { Colors, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeLayout } from '@/hooks/use-safe-layout';
import { useTabBarStore } from '@/store/tab-bar';

type TabRoute = { key: string; name: string };
type TabOptions = {
  title?: string;
  tabBarAccessibilityLabel?: string;
  tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode;
};

type FloatingTabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: TabOptions }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
};

type TabLayout = { x: number; width: number };

const springSoft = { damping: 18, stiffness: 220, mass: 0.75 };
const springSnap = { damping: 16, stiffness: 280, mass: 0.65 };

const FINANCE_ROUTE = 'cuentas';
const MENU_WIDTH = 220;
const VISIBLE_TABS = ['inicio', 'sobres', 'cuentas', 'recaudos', 'calendario', 'mas'] as const;
const FINANCE_SCREENS = new Set([
  'cuentas',
  'mis-cuentas',
  'salud-financiera',
  'metas',
  'account/[id]',
  'patrimonio',
  'goal/[id]',
]);
const RECAUDOS_SCREENS = new Set(['recaudos', 'recaudo/[id]']);
const MAS_SCREENS = new Set([
  'mas',
  'bank-accounts',
  'feature/[slug]',
  'ledgers',
  'export',
  'afiliados',
]);
const INICIO_SCREENS = new Set(['inicio', 'notifications', 'cashflow/[type]', 'movimientos', 'profile']);
const SOBRES_SCREENS = new Set(['sobres', 'envelope/[id]']);
const CALENDARIO_SCREENS = new Set(['calendario', 'calendars']);

const financeOptions = [
  { key: 'cuentas', title: 'Cuentas', icon: 'creditcard.fill', route: 'mis-cuentas' },
  { key: 'salud', title: 'Salud financiera', icon: 'heart.fill', route: 'salud-financiera' },
  { key: 'metas', title: 'Metas/Ahorros', icon: 'target', route: 'metas' },
];

export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const dark = useColorScheme() === 'dark';
  const theme = Colors[dark ? 'dark' : 'light'];
  const { tabBarPadding } = useSafeLayout();
  const collapsed = useTabBarStore((s) => s.collapsed);
  const expand = useTabBarStore((s) => s.expand);
  const progress = useSharedValue(0);
  const activeIndex = useSharedValue(0);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(40);
  const [layouts, setLayouts] = useState<Record<number, TabLayout>>({});
  const [tabFrames, setTabFrames] = useState<Record<number, TabLayout>>({});
  const [financeMenuOpen, setFinanceMenuOpen] = useState(false);

  const visibleRoutes = state.routes.filter((route) =>
    (VISIBLE_TABS as readonly string[]).includes(route.name),
  );
  const currentRouteName = state.routes[state.index]?.name ?? 'inicio';
  const highlightedName = FINANCE_SCREENS.has(currentRouteName)
    ? FINANCE_ROUTE
    : RECAUDOS_SCREENS.has(currentRouteName)
      ? 'recaudos'
      : MAS_SCREENS.has(currentRouteName)
        ? 'mas'
        : SOBRES_SCREENS.has(currentRouteName)
          ? 'sobres'
          : CALENDARIO_SCREENS.has(currentRouteName)
            ? 'calendario'
            : INICIO_SCREENS.has(currentRouteName)
              ? 'inicio'
              : currentRouteName;
  const highlightedVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.name === highlightedName),
  );
  const financeVisibleIndex = visibleRoutes.findIndex((route) => route.name === FINANCE_ROUTE);
  const financeFrame = tabFrames[financeVisibleIndex];
  const menuLeft = financeFrame
    ? Math.max(0, financeFrame.x + financeFrame.width / 2 - MENU_WIDTH / 2)
    : undefined;

  useEffect(() => {
    progress.value = withSpring(collapsed ? 1 : 0, springSoft);
  }, [collapsed, progress]);

  useEffect(() => {
    expand();
    activeIndex.value = withSpring(highlightedVisibleIndex, springSnap);
    const layout = layouts[highlightedVisibleIndex];
    if (layout) {
      indicatorX.value = withSpring(layout.x, springSnap);
      indicatorW.value = withSpring(layout.width, springSnap);
    }
  }, [highlightedVisibleIndex, expand, layouts, activeIndex, indicatorX, indicatorW]);

  useEffect(() => {
    if (collapsed) setFinanceMenuOpen(false);
  }, [collapsed]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, 14]) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.9]) },
    ],
    paddingVertical: interpolate(progress.value, [0, 1], [10, 8]),
    paddingHorizontal: interpolate(progress.value, [0, 1], [4, 12]),
    borderRadius: interpolate(progress.value, [0, 1], [28, 999]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    maxHeight: interpolate(progress.value, [0, 1], [16, 0]),
    marginTop: interpolate(progress.value, [0, 1], [3, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.85]) }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
    opacity: interpolate(progress.value, [0, 1], [1, 0.85]),
  }));

  const onItemLayout = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    const pillWidth = Math.min(40, width - 8);
    const pillX = x + (width - pillWidth) / 2;
    setTabFrames((prev) => {
      const current = prev[index];
      if (current && current.x === x && current.width === width) return prev;
      return { ...prev, [index]: { x, width } };
    });
    setLayouts((prev) => {
      const current = prev[index];
      if (current && current.x === pillX && current.width === pillWidth) return prev;
      return { ...prev, [index]: { x: pillX, width: pillWidth } };
    });
  };

  const closeFinanceMenu = () => setFinanceMenuOpen(false);

  const openFinanceOption = (route: (typeof financeOptions)[number]['route']) => {
    closeFinanceMenu();
    void Haptics.selectionAsync();
    navigation.navigate(route);
  };

  const bottomPad = tabBarPadding;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {financeMenuOpen ? (
        <Pressable
          accessibilityLabel="Cerrar menú de finanzas"
          onPress={closeFinanceMenu}
          style={styles.scrim}
        />
      ) : null}

      <View pointerEvents="box-none" style={[styles.host, { paddingBottom: bottomPad }]}>
        <View pointerEvents="box-none" style={styles.barColumn}>
          {financeMenuOpen ? (
            <Animated.View
              entering={FadeInUp.duration(180).springify().damping(20)}
              exiting={FadeOutDown.duration(120)}
              style={[
                styles.menu,
                menuLeft !== undefined ? { left: menuLeft } : styles.menuFallback,
              ]}>
              {Platform.OS !== 'web' ? (
                <BlurView
                  tint="systemChromeMaterialLight"
                  intensity={80}
                  style={StyleSheet.absoluteFill}
                  blurMethod="dimezisBlurViewSdk31Plus"
                />
              ) : null}
              <View style={styles.menuGlass} />
              {financeOptions.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={option.title}
                  onPress={() => openFinanceOption(option.route)}
                  style={({ pressed }) => [
                    styles.menuRow,
                    pressed && styles.menuRowPressed,
                  ]}>
                  <AppIcon name={option.icon} color="#0B1220" size={18} />
                  <Text style={styles.menuItemTitle}>{option.title}</Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : null}

          <Animated.View
            style={[
              styles.shell,
              shellStyle,
              {
                backgroundColor: Platform.OS === 'web'
                  ? (dark ? 'rgba(19,24,36,0.92)' : 'rgba(255,255,255,0.92)')
                  : 'transparent',
                borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.06)',
                shadowColor: theme.shadow,
              },
            ]}>
            {Platform.OS !== 'web' ? (
              <BlurView
                tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
                intensity={88}
                style={StyleSheet.absoluteFill}
                blurMethod="dimezisBlurViewSdk31Plus"
              />
            ) : null}
            <View style={[styles.fill, { backgroundColor: dark ? 'rgba(19,24,36,0.55)' : 'rgba(255,255,255,0.55)' }]} />
            <View style={styles.row}>
              <Animated.View
                pointerEvents="none"
                style={[styles.indicator, indicatorStyle, { backgroundColor: theme.primarySoft }]}
              />
              {visibleRoutes.map((route, index) => {
                const isFinance = route.name === FINANCE_ROUTE;
                const isCurrent =
                  route.name === highlightedName || (isFinance && FINANCE_SCREENS.has(currentRouteName));
                const focused = financeMenuOpen ? isFinance : isCurrent;
                const { options } = descriptors[route.key];
                const color = focused ? theme.primary : theme.muted;
                const label = options.title ?? route.name;
                const onPress = () => {
                  void Haptics.selectionAsync();
                  if (isFinance) {
                    setFinanceMenuOpen((open) => !open);
                    expand();
                    return;
                  }
                  closeFinanceMenu();
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isCurrent && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                  expand();
                };

                return (
                  <TabItem
                    key={route.key}
                    index={index}
                    activeIndex={activeIndex}
                    labelStyle={labelStyle}
                    focused={focused}
                    color={color}
                    label={label}
                    accessibilityLabel={
                      isFinance
                        ? financeMenuOpen
                          ? 'Cerrar menú de finanzas'
                          : 'Finanzas, abrir menú'
                        : (options.tabBarAccessibilityLabel ?? label)
                    }
                    onPress={onPress}
                    onLayout={(event) => onItemLayout(index, event)}
                    icon={options.tabBarIcon?.({ focused, color, size: focused ? 22 : 20 })}
                  />
                );
              })}
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function TabItem({
  index,
  activeIndex,
  labelStyle,
  focused,
  color,
  label,
  accessibilityLabel,
  onPress,
  onLayout,
  icon,
}: {
  index: number;
  activeIndex: SharedValue<number>;
  labelStyle: object;
  focused: boolean;
  color: string;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  icon?: ReactNode;
}) {
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (!focused) {
      bounce.value = withTiming(1, { duration: 120 });
      return;
    }
    bounce.value = withSequence(
      withSpring(1.18, { damping: 12, stiffness: 320 }),
      withSpring(1, springSoft),
    );
  }, [focused, bounce]);

  const itemStyle = useAnimatedStyle(() => {
    const distance = Math.abs(activeIndex.value - index);
    const scale = interpolate(distance, [0, 1], [1, 0.98], Extrapolation.CLAMP);
    return {
      transform: [{ scale: scale * bounce.value }],
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLayout={onLayout}
      style={styles.item}>
      <Animated.View style={[styles.itemInner, itemStyle]}>
        <View style={styles.iconWrap}>{icon}</View>
        <Animated.View style={labelStyle}>
          <Text numberOfLines={1} style={[styles.label, { color }]}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  barColumn: {
    width: '100%',
    maxWidth: 480,
    position: 'relative',
  },
  menu: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 12,
    width: MENU_WIDTH,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(16, 24, 40, 0.08)',
    paddingVertical: 8,
    shadowColor: '#0B1D3A',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
    zIndex: 2,
  },
  menuFallback: {
    alignSelf: 'center',
    left: undefined,
  },
  menuGlass: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.72)',
  },
  menuRow: {
    minHeight: 46,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuRowPressed: {
    backgroundColor: 'rgba(11, 18, 32, 0.05)',
  },
  menuItemTitle: {
    color: '#0B1220',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  shell: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 32,
    borderRadius: Radius.pill,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    zIndex: 1,
    paddingHorizontal: 2,
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
