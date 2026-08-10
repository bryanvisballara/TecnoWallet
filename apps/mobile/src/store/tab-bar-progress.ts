import { makeMutable, withTiming, type SharedValue } from 'react-native-reanimated';

/**
 * UI-thread collapse progress for the floating tab bar.
 * 0 = expanded, 1 = minimized.
 *
 * Scroll worklets own this value. JS/zustand only mirrors for React consumers
 * and must not restart animations (that causes jitter).
 */
export const tabBarCollapseProgress: SharedValue<number> = makeMutable(0);
export const tabBarIsCollapsed: SharedValue<number> = makeMutable(0);

export const TAB_BAR_COLLAPSE_MS = 180;
export const TAB_BAR_EXPAND_MS = 220;

export function collapseTabBarImmediate() {
  'worklet';
  if (tabBarIsCollapsed.value === 1) return;
  tabBarIsCollapsed.value = 1;
  tabBarCollapseProgress.value = withTiming(1, { duration: TAB_BAR_COLLAPSE_MS });
}

export function expandTabBarImmediate() {
  'worklet';
  if (tabBarIsCollapsed.value === 0) return;
  tabBarIsCollapsed.value = 0;
  tabBarCollapseProgress.value = withTiming(0, { duration: TAB_BAR_EXPAND_MS });
}
