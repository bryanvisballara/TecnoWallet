import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/polyfills/web-dom-props';
import '@/global.css';
import { Colors } from '@/constants/theme';
import { ensureAuthSession, flushOfflineQueue } from '@/services/api';
import { configureActivityNotifications } from '@/services/push-notifications';
import { useAuthStore } from '@/store/auth';
import { useFinanceStore } from '@/store/finance';
import { useLanguageStore } from '@/store/language';
import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';
import { useGoalsStore } from '@/store/goals';
import { useNotificationsStore } from '@/store/notifications';
import { useRecaudosStore } from '@/store/recaudos';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 }, mutations: { retry: 1 } },
});

export default function RootLayout() {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authenticated = useAuthStore((state) => state.authenticated);
  const hydrateFinance = useFinanceStore((state) => state.hydrate);
  const hydrateLedger = useLedgerStore((state) => state.hydrate);
  const hydrateCalendar = useCalendarStore((state) => state.hydrate);
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);
  const hydrateNotifications = useNotificationsStore((state) => state.hydrate);
  const hydrateGoals = useGoalsStore((state) => state.hydrate);
  const hydrateRecaudos = useRecaudosStore((state) => state.hydrate);
  const refreshRecaudos = useRecaudosStore((state) => state.refresh);
  const palette = Colors.light;

  useEffect(() => {
    void (async () => {
      // Auth → ledgers (Mongo workspaces) → dependent stores.
      await hydrateAuth();
      const isAuthed = useAuthStore.getState().authenticated;
      if (isAuthed) {
        await hydrateLedger();
        await Promise.all([
          hydrateCalendar(),
          hydrateFinance(),
          hydrateLanguage(),
          hydrateNotifications(),
          hydrateGoals(),
          hydrateRecaudos(),
        ]);
      } else {
        await Promise.all([hydrateLanguage(), hydrateNotifications(), hydrateFinance()]);
        // Mark empty product stores so the UI does not wait forever.
        useLedgerStore.setState({ hydrated: true, ledgers: [], activeLedgerId: '' });
        useRecaudosStore.setState({ hydrated: true, recaudos: [] });
        useGoalsStore.setState({ hydrated: true, goals: [] });
        useCalendarStore.setState({ hydrated: true });
      }
    })();
  }, [
    hydrateAuth,
    hydrateLedger,
    hydrateCalendar,
    hydrateFinance,
    hydrateLanguage,
    hydrateNotifications,
    hydrateGoals,
    hydrateRecaudos,
  ]);

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync();
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && authenticated) {
      void configureActivityNotifications();
      void refreshRecaudos();
    }
  }, [hydrated, authenticated, refreshRecaudos]);

  useEffect(() => {
    if (!hydrated) return;
    void flushOfflineQueue().then(() => {
      if (authenticated) return refreshRecaudos();
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ensureAuthSession().then(() =>
          flushOfflineQueue().then(() => {
            if (authenticated) return refreshRecaudos();
          }),
        );
      }
    });
    return () => subscription.remove();
  }, [hydrated, authenticated, refreshRecaudos]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
              <Stack.Screen
                name="add-transaction"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="add-envelope"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="add-account"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="add-goal"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="add-calendar-item"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="add-recaudo"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="add-planning-item"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen
                name="export"
                options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
              />
              <Stack.Screen name="profile" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="ledgers" />
              <Stack.Screen name="calendars" />
              <Stack.Screen name="feature/[slug]" />
              <Stack.Screen name="envelope/[id]" />
              <Stack.Screen name="account/[id]" />
              <Stack.Screen name="cashflow/[type]" />
              <Stack.Screen name="goal/[id]" />
              <Stack.Screen name="invite/[token]" />
              <Stack.Screen name="patrimonio" />
              <Stack.Screen name="bank-accounts" />
            </Stack>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
