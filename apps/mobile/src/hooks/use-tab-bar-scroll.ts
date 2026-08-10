import { useCallback } from 'react';
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import {
  collapseTabBarImmediate,
  expandTabBarImmediate,
  tabBarIsCollapsed,
} from '@/store/tab-bar-progress';
import { useTabBarStore } from '@/store/tab-bar';

/**
 * Directional hysteresis — Instagram-style minimize without flicker.
 * Accumulate delta in one direction; require a clear intent before toggling.
 */
const TOP_EXPAND_Y = 8;
const INTENT_PX = 12;
const MAX_ACCUM = 48;

/**
 * Scroll → tab-bar collapse on the UI thread.
 * Zustand is mirrored only (no second withTiming) to avoid animation fights.
 */
export function useTabBarScrollHandler() {
  const mirrorCollapsed = useTabBarStore((state) => state.mirrorCollapsed);
  const lastY = useSharedValue(0);
  const accum = useSharedValue(0);
  const lastYJs = useSharedValue(0);
  const accumJs = useSharedValue(0);

  const syncCollapsed = useCallback(
    (collapsed: boolean) => {
      mirrorCollapsed(collapsed);
    },
    [mirrorCollapsed],
  );

  const animatedOnScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const y = Math.max(0, event.contentOffset.y);
      const dy = y - lastY.value;
      lastY.value = y;

      // Near the top → always expand and reset intent
      if (y <= TOP_EXPAND_Y) {
        accum.value = 0;
        if (tabBarIsCollapsed.value === 1) {
          expandTabBarImmediate();
          runOnJS(syncCollapsed)(false);
        }
        return;
      }

      // Ignore tiny jitter / float noise
      if (Math.abs(dy) < 0.5) return;

      // Same-direction accumulation; reverse resets
      if (accum.value === 0 || Math.sign(accum.value) === Math.sign(dy)) {
        accum.value = Math.max(-MAX_ACCUM, Math.min(MAX_ACCUM, accum.value + dy));
      } else {
        accum.value = dy;
      }

      if (accum.value >= INTENT_PX && tabBarIsCollapsed.value === 0) {
        accum.value = 0;
        collapseTabBarImmediate();
        runOnJS(syncCollapsed)(true);
        return;
      }

      if (accum.value <= -INTENT_PX && tabBarIsCollapsed.value === 1) {
        accum.value = 0;
        expandTabBarImmediate();
        runOnJS(syncCollapsed)(false);
      }
    },
  });

  const jsOnScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = Math.max(0, event.nativeEvent.contentOffset.y);
      const dy = y - lastYJs.value;
      lastYJs.value = y;

      if (y <= TOP_EXPAND_Y) {
        accumJs.value = 0;
        useTabBarStore.getState().setCollapsed(false);
        return;
      }
      if (Math.abs(dy) < 0.5) return;

      if (accumJs.value === 0 || Math.sign(accumJs.value) === Math.sign(dy)) {
        accumJs.value = Math.max(-MAX_ACCUM, Math.min(MAX_ACCUM, accumJs.value + dy));
      } else {
        accumJs.value = dy;
      }

      if (accumJs.value >= INTENT_PX) {
        accumJs.value = 0;
        useTabBarStore.getState().setCollapsed(true);
      } else if (accumJs.value <= -INTENT_PX) {
        accumJs.value = 0;
        useTabBarStore.getState().setCollapsed(false);
      }
    },
    [lastYJs, accumJs],
  );

  const useAnimatedScrollView = Platform.OS !== 'web';

  return {
    onScroll: useAnimatedScrollView ? animatedOnScroll : jsOnScroll,
    useAnimatedScrollView,
  };
}
