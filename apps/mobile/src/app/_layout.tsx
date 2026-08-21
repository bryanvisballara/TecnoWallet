import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ComponentType } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/polyfills/web-dom-props';
import '@/global.css';
import { BrandSplashOverlay } from '@/components/brand-splash-overlay';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensureAuthSession, flushOfflineQueue } from '@/services/api';
import { localStorage } from '@/services/persistence';
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
import { deliverGoogleIdToken } from '@/lib/google-oauth-return';
import { requestVoiceDictation, isVoiceCommandUrl, voiceTextFromUrl } from '@/lib/voice-intent';
import { isGoogleReturnUrl, parseIdTokenFromUrl } from '@/services/google-auth';
import { syncCalendarWidget } from '@/lib/sync-calendar-widget';

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
  const [bootExtras, setBootExtras] = useState(false);

  // Auth alone is not enough — wait for core stores so the splash progress can finish.
  const appReady =
    hydrated &&
    languageHydrated &&
    preferencesHydrated &&
    (!authenticated || ledgerHydrated);

  useEffect(() => {
    void (async () => {
      // Local prefs first so the branded overlay can move immediately.
      const localBoot = Promise.all([
        hydrateLanguage(),
        hydratePreferences(),
        hydrateNotifications(),
      ]);

      await hydrateAuth();
      await localBoot;

      const isAuthed = useAuthStore.getState().authenticated;
      if (isAuthed) {
        // Purchases / push / Branch must never gate ledger or first paint.
        void localStorage.get('auth-user-id', '').then((userId) => {
          if (!userId) return;
          void import('@/services/purchases').then(({ configurePurchases }) =>
            configurePurchases(userId).catch(() => undefined),
          );
        });

        await hydrateLedger();
        await Promise.all([
          hydratePlus(),
          hydrateCalendar(),
          hydrateFinance(),
          hydrateGoals(),
          hydrateRecaudos(),
        ]);
      } else {
        usePlusStore.getState().reset();
        await hydrateFinance();
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
    // Never hide the native splash before the branded overlay can paint.
    // BrandSplashOverlay calls hideAsync on first layout; this is a last resort.
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!appReady) return;
    // Mount heavier chrome only after the first interactive shell is ready.
    setBootExtras(true);
  }, [appReady]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void import('@/services/branch')
      .then(({ initBranchAttribution }) => {
        try {
          cleanup = initBranchAttribution();
        } catch {
          // Branch requires a custom native build; web and Expo Go keep working.
        }
      })
      .catch(() => undefined);
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (hydrated && authenticated) {
      void localStorage.get('auth-user-id', '').then((userId) => {
        if (!userId) return;
        void import('@/services/branch').then(({ setBranchIdentity }) =>
          setBranchIdentity(userId).catch(() => undefined),
        );
      });
      void import('@/services/branch').then(({ claimPendingAffiliate }) =>
        claimPendingAffiliate().catch(() => undefined),
      );
      void import('@/services/push-notifications').then(
        ({ configureActivityNotifications }) =>
          configureActivityNotifications().then(() =>
            useNotificationsStore.getState().syncBadge(),
          ),
      );
      void refreshRecaudos();
    }
  }, [hydrated, authenticated, refreshRecaudos]);

  useEffect(() => {
    if (!hydrated) return;
    void flushOfflineQueue().then(() => {
      if (authenticated) return refreshRecaudos();
    });

    // Guard against AppState "active" storms that freeze the JS thread:
    // full ledger/calendar hydrate + 7 team scanners must not overlap.
    let sharedPollInFlight = false;
    let lastSharedPollAt = 0;
    const SHARED_POLL_MIN_MS = 45_000;

    const pollAccessRequests = () => {
      if (!authenticated) return;
      void import('@/services/collaboration-api').then(
        ({ listOwnedAccessRequests, notifyNewAccessRequests }) =>
          listOwnedAccessRequests()
            .then((requests) => notifyNewAccessRequests(requests))
            .catch(() => undefined),
      );
    };

    const pollSharedCollaborators = (force = false) => {
      if (!authenticated) return;
      const now = Date.now();
      if (sharedPollInFlight) return;
      if (!force && now - lastSharedPollAt < SHARED_POLL_MIN_MS) return;
      sharedPollInFlight = true;
      lastSharedPollAt = now;
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
        .catch(() => undefined)
        .finally(() => {
          sharedPollInFlight = false;
        });
    };

    // Defer boot poll so it never competes with first paint.
    const bootPoll = setTimeout(() => {
      pollAccessRequests();
      pollSharedCollaborators(true);
    }, 2500);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ensureAuthSession().then(() =>
          flushOfflineQueue().then(() => {
            if (authenticated) return refreshRecaudos();
          }),
        );
        if (authenticated) {
          const calendar = useCalendarStore.getState();
          if (calendar.hydrated) syncCalendarWidget(calendar.items);
          void import('@/services/push-notifications').then(
            ({ registerRemotePushToken }) =>
              registerRemotePushToken().catch(() => undefined),
          );
        }
        pollAccessRequests();
        // Debounced — returning from background must not freeze the UI.
        pollSharedCollaborators(false);
      }
      if (state === 'background' || state === 'inactive') {
        void useNotificationsStore.getState().syncBadge();
      }
    });
    return () => {
      clearTimeout(bootPoll);
      subscription.remove();
    };
  }, [hydrated, authenticated, refreshRecaudos, hydrateLedger, hydrateCalendar]);

  useEffect(() => {
    let lastVoiceUrlAt = 0;
    const handleUrl = (url: string | null) => {
      if (!url) return;
      if (isGoogleReturnUrl(url)) {
        const token = parseIdTokenFromUrl(url);
        if (token) deliverGoogleIdToken(token);
        return;
      }
      if (!isVoiceCommandUrl(url)) return;
      const now = Date.now();
      if (now - lastVoiceUrlAt < 1500) return;
      lastVoiceUrlAt = now;
      requestVoiceDictation(voiceTextFromUrl(url));
    };
    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, []);

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
              <Stack.Screen name="oauthredirect" />
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
            {bootExtras ? <BootExtras /> : null}
            <BrandSplashOverlay ready={appReady} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function BootExtras() {
  const [mods, setMods] = useState<{
    PlusPaywallModal: ComponentType;
    AffiliateWelcomeModal: ComponentType;
    AppLockGate: ComponentType;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      import('@/components/plus-paywall-modal'),
      import('@/components/affiliate-welcome-modal'),
      import('@/components/app-lock-gate'),
    ]).then(([plus, affiliate, lock]) => {
      if (cancelled) return;
      setMods({
        PlusPaywallModal: plus.PlusPaywallModal,
        AffiliateWelcomeModal: affiliate.AffiliateWelcomeModal,
        AppLockGate: lock.AppLockGate,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mods) return null;
  const { PlusPaywallModal, AffiliateWelcomeModal, AppLockGate } = mods;
  return (
    <>
      <PlusPaywallModal />
      <AffiliateWelcomeModal />
      <AppLockGate />
    </>
  );
}
