import { useColorScheme as useSystemColorScheme } from 'react-native';

import { usePreferencesStore } from '@/store/preferences';

export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const appearance = usePreferencesStore((state) => state.appearance);
  if (appearance === 'light') return 'light';
  if (appearance === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}
