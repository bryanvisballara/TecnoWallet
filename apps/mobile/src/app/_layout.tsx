import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/polyfills/web-dom-props';
import '@/global.css';
import { Colors } from '@/constants/theme';
import { flushOfflineQueue } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { useFinanceStore } from '@/store/finance';
import { useLanguageStore } from '@/store/language';
import { useLedgerStore } from '@/store/ledger';
import { useNotificationsStore } from '@/store/notifications';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 }, mutations: { retry: 1 } },
});

export default function RootLayout() {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrateFinance = useFinanceStore((state) => state.hydrate);
  const hydrateLedger = useLedgerStore((state) => state.hydrate);
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);
  const hydrateNotifications = useNotificationsStore((state) => state.hydrate);
  const palette = Colors.light;

  useEffect(() => {
    void Promise.all([
      hydrateAuth(),
      hydrateLedger(),
      hydrateFinance(),
      hydrateLanguage(),
      hydrateNotifications(),
    ]);
  }, [hydrateAuth, hydrateLedger, hydrateFinance, hydrateLanguage, hydrateNotifications]);

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void flushOfflineQueue();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushOfflineQueue();
    });
    return () => subscription.remove();
  }, [hydrated]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            primary: palette.primary,
            background: palette.background,
            card: palette.surface,
            text: palette.text,
            border: palette.border,
          },
        }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background }, animation: 'ios_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-transaction" options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.9, 1] }} />
            <Stack.Screen name="add-calendar-item" options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.92, 1] }} />
            <Stack.Screen name="export" options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.92, 1] }} />
            <Stack.Screen name="profile" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="ledgers" />
            <Stack.Screen name="feature/[slug]" />
            <Stack.Screen name="envelope/[id]" />
            <Stack.Screen name="account/[id]" />
            <Stack.Screen name="cashflow/[type]" />
            <Stack.Screen name="goal/[id]" />
            <Stack.Screen name="patrimonio" />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
