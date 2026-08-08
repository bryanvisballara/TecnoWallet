import { useColorScheme as useSystemColorScheme } from 'react-native';

/**
 * Keep a stable hooks footprint for Fast Refresh, but always expose the
 * light palette so OS dark mode cannot wash out text on white cards.
 */
export function useColorScheme(): 'light' | 'dark' {
  useSystemColorScheme();
  return 'light';
}
