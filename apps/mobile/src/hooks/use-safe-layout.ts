import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Approximate floating tab bar content height (without home-indicator inset). */
export const FLOATING_TAB_BAR_HEIGHT = 72;

export function useSafeLayout() {
  const insets = useSafeAreaInsets();

  const top = Math.max(insets.top, 0);
  const bottom = Math.max(insets.bottom, 0);
  /** Extra space so content clears the home indicator / Android nav. */
  const stackBottom = bottom + 20;
  /** Extra space so tab screens clear the floating tab bar + home indicator. */
  const tabsBottom = bottom + FLOATING_TAB_BAR_HEIGHT + 24;
  /** FAB / floating controls above the tab bar. */
  const fabBottom = bottom + FLOATING_TAB_BAR_HEIGHT + 18;
  /** Padding under the floating tab bar host itself. */
  const tabBarPadding = Math.max(bottom, 10);

  return {
    insets,
    top,
    bottom,
    stackBottom,
    tabsBottom,
    fabBottom,
    tabBarPadding,
  };
}
