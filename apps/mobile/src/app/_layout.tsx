import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/polyfills/web-dom-props';
import '@/global.css';
import { AffiliateWelcomeModal } from '@/components/affiliate-welcome-modal';
import { AppLockGate } from '@/components/app-lock-gate';
import { BrandSplashOverlay } from '@/components/brand-splash-overlay';
import { PlusPaywallModal } from '@/components/plus-paywall-modal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensureAuthSession, flushOfflineQueue } from '@/services/api';
import {
  claimPendingAffiliate,
  initBranchAttribution,
  setBranchIdentity,
} from '@/services/branch';
import { localStorage } from '@/services/persistence';
import { configurePurchases } from '@/services/purchases';
import { configureActivityNotifications } from '@/services/push-notifications';
import { useAuthStore } from '@/store/auth';
import { useFinanceStore } from '@/store/finance';
import { useLanguageStore } from '@/store/language';
import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';
import { useGoalsStore } from '@/store/goals';
import { useNotificationsStore } from '@/store/notifications';
import { usePreferencesStore } from '@/store/preferences';
import { usePlusStore } from '@/store/plus';
import { useRecaudosStore } from '@/store/recaudos';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 }, mutations: { retry: 1 } },
});

export default function RootLayout() {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authenticated = useAuthStore((state) => state.authenticated);
  const ledgerHydrated = useLedgerStore((state) => state.hydrated);
  const languageHydrated = useLanguageStore((state) => state.hydrated);
  const preferencesHydrated = usePreferencesStore((state) => state.hydrated);
  const hydrateFinance = useFinanceStore((state) => state.hydrate);
  const hydrateLedger = useLedgerStore((state) => state.hydrate);
  const hydrateCalendar = useCalendarStore((state) => state.hydrate);
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  const hydratePlus = usePlusStore((state) => state.hydrate);
  const hydrateNotifications = useNotificationsStore((state) => state.hydrate);
  const hydrateGoals = useGoalsStore((state) => state.hydrate);
  const hydrateRecaudos = useRecaudosStore((state) => state.hydrate);
  const refreshRecaudos = useRecaudosStore((state) => state.refresh);
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Auth alone is not enough — wait for core stores so the splash progress can finish.
  const appReady =
    hydrated &&
    languageHydrated &&
    preferencesHydrated &&
    (!authenticated || ledgerHydrated);

  useEffect(() => {
    void (async () => {
      // Auth → ledgers (Mongo workspaces) → dependent stores.
      await hydrateAuth();
      const isAuthed = useAuthStore.getState().authenticated;
      if (isAuthed) {
        const userId = await localStorage.get('auth-user-id', '');
        if (userId) {
          await configurePurchases(userId).catch(() => undefined);
        }
        await hydrateLedger();
        await Promise.all([
          hydratePlus(),
          hydrateCalendar(),
          hydrateFinance(),
          hydrateLanguage(),
          hydratePreferences(),
          hydrateNotifications(),
          hydrateGoals(),
          hydrateRecaudos(),
        ]);
      } else {
        usePlusStore.getState().reset();
        await Promise.all([
          hydrateLanguage(),
          hydratePreferences(),
          hydrateNotifications(),
          hydrateFinance(),
        ]);
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
    hydratePreferences,
    hydratePlus,
    hydrateNotifications,
    hydrateGoals,
    hydrateRecaudos,
  ]);

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync().catch(() => undefined);
  }, [hydrated]);

  // Failsafe: never leave the native splash stuck if hydration is slow.
  useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      cleanup = initBranchAttribution();
    } catch {
      // Branch requires a custom native build; web and Expo Go keep working.
    }
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (hydrated && authenticated) {
      void localStorage.get('auth-user-id', '').then((userId) => {
        if (userId) void setBranchIdentity(userId).catch(() => undefined);
      });
      void claimPendingAffiliate().catch(() => undefined);
      void configureActivityNotifications().then(() =>
        useNotificationsStore.getState().syncBadge(),
      );
      void refreshRecaudos();
    }
  }, [hydrated, authenticated, refreshRecaudos]);

  useEffect(() => {
    if (!hydrated) return;
    void flushOfflineQueue().then(() => {
      if (authenticated) return refreshRecaudos();
    });
    const pollAccessRequests = () => {
      if (!authenticated) return;
      void import('@/services/collaboration-api').then(
        ({ listOwnedAccessRequests, notifyNewAccessRequests }) =>
          listOwnedAccessRequests()
            .then((requests) => notifyNewAccessRequests(requests))
            .catch(() => undefined),
      );
    };
    const pollSharedCollaborators = () => {
      if (!authenticated) return;
      void Promise.all([
        hydrateLedger(),
        hydrateCalendar(),
        refreshRecaudos(),
      ])
        .then(() =>
          import('@/services/collaboration-api').then(
            ({ notifyAllSharedCollaborators }) => notifyAllSharedCollaborators(),
          ),
        )
        .catch(() => undefined);
    };
    pollAccessRequests();
    pollSharedCollaborators();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ensureAuthSession().then(() =>
          flushOfflineQueue().then(() => {
            if (authenticated) return refreshRecaudos();
          }),
        );
        pollAccessRequests();
        pollSharedCollaborators();
      }
      if (state === 'background' || state === 'inactive') {
        // Refresh home-screen badge before the user leaves the app.
        void useNotificationsStore.getState().syncBadge();
      }
    });
    return () => subscription.remove();
  }, [hydrated, authenticated, refreshRecaudos, hydrateLedger, hydrateCalendar]);

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
              <Stack.Screen name="restablecer" />
              <Stack.Screen name="oauth-google" />
              <Stack.Screen name="oauth-google-callback" />
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
              <Stack.Screen name="colaborar" />
              <Stack.Screen name="invite/[token]" />
              <Stack.Screen name="r/[code]" />
            </Stack>
            <PlusPaywallModal />
            <AffiliateWelcomeModal />
            <AppLockGate />
            <BrandSplashOverlay ready={appReady} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
