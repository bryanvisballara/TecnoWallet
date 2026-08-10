import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Navigate back without risking an unhandled GO_BACK warning.
 * - Modals: dismiss when possible
 * - Native: pop history when available
 * - Web: always replace to fallback (Expo web history often reports GO_BACK
 *   that no navigator handles)
 */
export function safeGoBack(fallback: Href = '/(tabs)/inicio') {
  try {
    if (typeof router.canDismiss === 'function' && router.canDismiss()) {
      router.dismiss();
      return;
    }
  } catch {
    // dismiss only works for presented modals
  }

  if (Platform.OS !== 'web') {
    try {
      if (typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
        return;
      }
    } catch {
      // fall through to replace
    }
  }

  router.replace(fallback);
}

/** Close a sheet/modal without firing an unhandled GO_BACK. */
export function dismissSheet(fallback: Href = '/(tabs)/inicio') {
  safeGoBack(fallback);
}
