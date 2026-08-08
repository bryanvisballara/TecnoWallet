import { create } from 'zustand';

type TabBarState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onScrollOffset: (offsetY: number, deltaY: number) => void;
  expand: () => void;
};

export const useTabBarStore = create<TabBarState>((set, get) => ({
  collapsed: false,
  setCollapsed: (collapsed) => {
    if (get().collapsed !== collapsed) set({ collapsed });
  },
  expand: () => {
    if (get().collapsed) set({ collapsed: false });
  },
  onScrollOffset: (offsetY, deltaY) => {
    if (offsetY < 12) {
      if (get().collapsed) set({ collapsed: false });
      return;
    }
    if (deltaY > 6 && !get().collapsed) set({ collapsed: true });
    else if (deltaY < -6 && get().collapsed) set({ collapsed: false });
  },
}));
