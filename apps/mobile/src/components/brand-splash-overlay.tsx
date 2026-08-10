import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth';
import { useCalendarStore } from '@/store/calendar';
import { useGoalsStore } from '@/store/goals';
import { useLanguageStore } from '@/store/language';
import { useLedgerStore } from '@/store/ledger';
import { useNotificationsStore } from '@/store/notifications';
import { usePlusStore } from '@/store/plus';
import { usePreferencesStore } from '@/store/preferences';
import { useRecaudosStore } from '@/store/recaudos';

const GREEN = '#39E639';
const BG = '#002787';

type BrandSplashOverlayProps = {
  /** When true, fill to 100% and fade out. */
  ready: boolean;
};

/**
 * Brand splash with live hydration progress.
 * Native preset is solid brand color only — this overlay owns the art + loader.
 */
export function BrandSplashOverlay({ ready }: BrandSplashOverlayProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(true);
  const [displayPct, setDisplayPct] = useState(8);
  const opacity = useSharedValue(1);
  const fill = useSharedValue(0.08);

  const authHydrated = useAuthStore((s) => s.hydrated);
  const languageHydrated = useLanguageStore((s) => s.hydrated);
  const preferencesHydrated = usePreferencesStore((s) => s.hydrated);
  const notificationsHydrated = useNotificationsStore((s) => s.hydrated);
  const ledgerHydrated = useLedgerStore((s) => s.hydrated);
  const calendarHydrated = useCalendarStore((s) => s.hydrated);
  const goalsHydrated = useGoalsStore((s) => s.hydrated);
  const recaudosHydrated = useRecaudosStore((s) => s.hydrated);
  const plusHydrated = usePlusStore((s) => s.hydrated);

  const progressRatio = useMemo(() => {
    if (ready) return 1;
    const steps = [
      authHydrated,
      languageHydrated,
      preferencesHydrated,
      notificationsHydrated,
      ledgerHydrated,
      calendarHydrated,
      goalsHydrated,
      recaudosHydrated,
      plusHydrated,
    ];
    const done = steps.filter(Boolean).length;
    return Math.min(0.92, Math.max(0.08, done / steps.length));
  }, [
    ready,
    authHydrated,
    languageHydrated,
    preferencesHydrated,
    notificationsHydrated,
    ledgerHydrated,
    calendarHydrated,
    goalsHydrated,
    recaudosHydrated,
    plusHydrated,
  ]);

  useEffect(() => {
    // Hide native solid splash as soon as this overlay mounts.
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => {
      setDisplayPct((prev) => {
        const target = Math.round(progressRatio * 100);
        if (prev < target) return Math.min(target, prev + 2);
        if (prev < Math.min(90, target + 6)) return prev + 1;
        return prev;
      });
    }, 90);
    return () => clearInterval(id);
  }, [ready, progressRatio]);

  useEffect(() => {
    const next = ready ? 1 : progressRatio;
    fill.value = withTiming(next, {
      duration: ready ? 280 : 420,
      easing: Easing.out(Easing.cubic),
    });
    if (ready) setDisplayPct(100);
    else setDisplayPct((prev) => Math.max(prev, Math.round(progressRatio * 100)));
  }, [progressRatio, ready, fill]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      opacity.value = withTiming(
        0,
        { duration: 360, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }, 220);
    return () => clearTimeout(t);
  }, [ready, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.round(interpolate(fill.value, [0, 1], [0, 100]))}%`,
  }));

  if (!mounted) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, fadeStyle]}>
      <Image
        source={require('@/assets/images/splash-screen.png')}
        style={styles.image}
        contentFit="cover"
        transition={0}
      />

      <View style={[styles.loader, { bottom: Math.max(insets.bottom, 16) + 56 }]}>
        <Text style={styles.loadingLabel}>Cargando tu experiencia...</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, barStyle]} />
          </View>
          <Text style={styles.progressPct}>{displayPct}%</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: BG,
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    left: 28,
    right: 28,
    gap: 12,
  },
  loadingLabel: {
    color: 'rgba(230,236,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(120,170,255,0.55)',
    backgroundColor: 'rgba(0,20,70,0.45)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GREEN,
  },
  progressPct: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
});
