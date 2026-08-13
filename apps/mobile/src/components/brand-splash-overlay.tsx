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

import { AppLinearGradient } from '@/components/app-linear-gradient';
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
const LOGO = require('@/assets/images/splash-logo.png');

type BrandSplashOverlayProps = {
  /** When true, fill to 100% and fade out. */
  ready: boolean;
};

/**
 * Branded launch overlay: gradient + wordmark, with the hydration loader at the bottom.
 * Native splash is white so the first frames are not a solid blue hold.
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

  const hideNativeSplash = () => {
    void SplashScreen.hideAsync().catch(() => undefined);
  };

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
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, fadeStyle]}
      onLayout={hideNativeSplash}>
      <AppLinearGradient
        colors={['#04102C', '#0A2C7A', '#1A58C8']}
        locations={[0, 0.42, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.stage, { paddingTop: insets.top + 72 }]}>
        <View style={styles.markWrap}>
          <Image
            source={LOGO}
            style={styles.mark}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            priority="high"
          />
        </View>
        <Text style={styles.wordmark}>
          TECNO<Text style={styles.wordmarkAccent}>WALLET</Text>
        </Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>Tu dinero, tu control</Text>
      </View>

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
    backgroundColor: '#FFFFFF',
  },
  stage: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  markWrap: {
    width: 92,
    height: 92,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 28,
  },
  mark: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  wordmarkAccent: {
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '700',
  },
  rule: {
    width: 36,
    height: 2,
    borderRadius: 2,
    backgroundColor: GREEN,
    marginTop: 16,
    marginBottom: 12,
  },
  tagline: {
    color: 'rgba(220,230,255,0.72)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.4,
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
