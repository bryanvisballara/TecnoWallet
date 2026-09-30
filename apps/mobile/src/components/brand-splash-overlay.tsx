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
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

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

const ICON = require('@/assets/images/app-icon.png');
const COBALT = '#1E4BB3';
const SKY = '#79B2F9';
type BrandSplashOverlayProps = {
  /** When true, fill to 100% and fade out. */
  ready: boolean;
};

/**
 * Branded launch overlay matching the Tw wallet icon:
 * cobalt field, sky-blue loader, gold accent. Native hold matches this field.
 */
export function BrandSplashOverlay({ ready }: BrandSplashOverlayProps) {
  const [mounted, setMounted] = useState(true);
  const opacity = useSharedValue(1);
  const fill = useSharedValue(0.08);
  const pulse = useSharedValue(1);

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
    pulse.value = withRepeat(
      withTiming(1.045, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  useEffect(() => {
    const next = ready ? 1 : progressRatio;
    fill.value = withTiming(next, {
      duration: ready ? 280 : 420,
      easing: Easing.out(Easing.cubic),
    });
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
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
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
        colors={['#12357A', COBALT, '#5AA4F0']}
        locations={[0, 0.48, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.stage}>
        <Animated.View style={[styles.markWrap, iconStyle]}>
          <Image
            source={ICON}
            style={styles.mark}
            contentFit="contain"
            transition={0}
            cachePolicy="none"
            priority="high"
          />
        </Animated.View>
        <Text style={styles.brand}>TecnoWallet</Text>
        <View style={styles.loader}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, barStyle]} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    backgroundColor: '#12357A',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  markWrap: {
    width: 132,
    height: 132,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 22,
    shadowColor: '#0B2A6A',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  mark: {
    width: '100%',
    height: '100%',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  loader: {
    width: 160,
    marginTop: 28,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: SKY,
  },
});
