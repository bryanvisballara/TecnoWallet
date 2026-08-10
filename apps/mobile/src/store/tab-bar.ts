import { create } from 'zustand';
import { runOnUI } from 'react-native-reanimated';

import {
  collapseTabBarImmediate,
  expandTabBarImmediate,
} from '@/store/tab-bar-progress';

type TabBarState = {
  collapsed: boolean;
  /** Mirror UI-thread state into React without restarting the animation. */
  mirrorCollapsed: (collapsed: boolean) => void;
  /** User/navigation action — drives animation + React state. */
  setCollapsed: (collapsed: boolean) => void;
  onScrollOffset: (offsetY: number, deltaY: number) => void;
  expand: () => void;
};

/** Hysteresis: ignore micro / rubber-band noise. */
const TOP_EXPAND_Y = 8;
const COLLAPSE_DELTA = 10;
const EXPAND_DELTA = -10;

function driveCollapsed(collapsed: boolean) {
  runOnUI(() => {
    'worklet';
    if (collapsed) collapseTabBarImmediate();
    else expandTabBarImmediate();
  })();
}

export const useTabBarStore = create<TabBarState>((set, get) => ({
  collapsed: false,

  mirrorCollapsed: (collapsed) => {
    if (get().collapsed === collapsed) return;
    set({ collapsed });
  },

  setCollapsed: (collapsed) => {
    if (get().collapsed === collapsed) return;
    set({ collapsed });
    driveCollapsed(collapsed);
  },

  expand: () => {
    get().setCollapsed(false);
  },

  onScrollOffset: (offsetY, deltaY) => {
    if (offsetY <= TOP_EXPAND_Y) {
      get().setCollapsed(false);
      return;
    }
    if (deltaY >= COLLAPSE_DELTA) {
      get().setCollapsed(true);
    } else if (deltaY <= EXPAND_DELTA) {
      get().setCollapsed(false);
    }
  },
}));
