import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { type PropsWithChildren, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAppRefresh } from '@/hooks/use-app-refresh';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeLayout } from '@/hooks/use-safe-layout';
import { useTabBarScrollHandler } from '@/hooks/use-tab-bar-scroll';
import { safeGoBack } from '@/lib/navigation';
import { usePreferencesStore } from '@/store/preferences';
import type { Href } from 'expo-router';

export type AppIconName = string;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedScrollView = Animated.ScrollView;

const fallback: Record<string, keyof typeof Ionicons.glyphMap> = {
  'house.fill': 'home', 'creditcard.fill': 'card', 'building.columns.fill': 'business',
  'banknote.fill': 'cash', 'cart.fill': 'cart', 'arrow.down.circle.fill': 'arrow-down-circle',
  'cup.and.saucer.fill': 'cafe', 'tram.fill': 'train', 'play.rectangle.fill': 'play',
  'leaf.fill': 'leaf', 'gamecontroller.fill': 'game-controller', 'car.fill': 'car',
  'heart.fill': 'heart', airplane: 'airplane', 'doc.text.fill': 'document-text',
  repeat: 'repeat', target: 'flag', calendar: 'calendar', 'chart.bar.fill': 'bar-chart',
  sparkles: 'sparkles', 'star.fill': 'star', 'person.2.fill': 'people', 'person.badge.plus': 'person-add', 'trophy.fill': 'trophy',
  'gearshape.fill': 'settings', 'lock.shield.fill': 'shield-checkmark',
  'checkmark.shield.fill': 'shield-checkmark',
  'arrow.up.arrow.down.circle.fill': 'swap-vertical', 'line.3.horizontal.decrease': 'options',
  magnifyingglass: 'search', plus: 'add', chevron: 'chevron-forward', 'chevron.down': 'chevron-down',
  'chevron.left': 'chevron-back', 'chevron.right': 'chevron-forward',
  bell: 'notifications-outline', 'person.crop.circle': 'person-circle', 'wallet.pass.fill': 'wallet',
  'mic.fill': 'mic',
  'person.crop.circle.badge.checkmark': 'person-circle',
  'chart.pie.fill': 'pie-chart', 'arrow.left': 'arrow-back', 'arrow.right': 'arrow-forward', camera: 'camera',
  checkmark: 'checkmark', 'checkmark.circle.fill': 'checkmark-circle', circle: 'ellipse-outline',
  trash: 'trash', pencil: 'create-outline', 'paperplane.fill': 'send', 'moon.fill': 'moon',
  'faceid': 'scan', 'icloud.and.arrow.up': 'cloud-upload', 'lock.fill': 'lock-closed',
  'ellipsis.circle.fill': 'ellipsis-horizontal-circle',
  'eye.fill': 'eye', 'eye.slash.fill': 'eye-off', 'arrow.up.circle.fill': 'arrow-up-circle',
  globe: 'globe', iphone: 'phone-portrait', 'key.fill': 'key', 'hand.raised.fill': 'hand-left',
  'tablecells.fill': 'grid', curlybraces: 'code-slash', 'doc.richtext.fill': 'document',
  'square.and.arrow.down': 'download', 'square.and.arrow.up': 'share-outline', 'lock.icloud.fill': 'cloud-done', 'photo.fill': 'image',
  paperclip: 'attach', 'doc.fill': 'document',
  'flame.fill': 'flame',
  'arrow.clockwise': 'refresh', 'arrow.left.arrow.right': 'swap-horizontal',
  'externaldrive.fill': 'server', 'paintbrush.fill': 'color-palette',
  'speaker.wave.2.fill': 'volume-medium', 'hand.thumbsup.fill': 'thumbs-up',
  'questionmark.circle.fill': 'help-circle', 'bubble.left.and.bubble.right.fill': 'chatbubbles',
  'square.and.arrow.up.on.square': 'share', 'music.note': 'musical-notes',
  'icloud.fill': 'cloud', 'shield.fill': 'shield', laptopcomputer: 'laptop',
  'gift.fill': 'gift', xmark: 'close',
  clock: 'time-outline', mappin: 'location-outline', link: 'link',
  'video.fill': 'videocam',
  'cross.case.fill': 'medkit',
  'figure.run': 'walk',
  'dumbbell.fill': 'barbell',
  'fork.knife': 'restaurant',
  'bag.fill': 'bag-handle',
  'fuelpump.fill': 'speedometer',
  'bolt.fill': 'flash',
  'book.fill': 'book',
  'briefcase.fill': 'briefcase',
  'bus.fill': 'bus',
  'wifi': 'wifi',
  'drop.fill': 'water',
  'pawprint.fill': 'paw',
  'ticket.fill': 'ticket',
  'phone.fill': 'call',
  'envelope.fill': 'mail',
  'logo.whatsapp': 'logo-whatsapp',
};

export function AppIcon({ name, size = 20, color }: { name: AppIconName; size?: number; color: ColorValue }) {
  const ion = fallback[name];
  if (process.env.EXPO_OS === 'ios' && ion !== 'logo-whatsapp') {
    return <SymbolView name={name as never} size={size} tintColor={color} type="hierarchical" />;
  }
  return <Ionicons name={ion ?? 'ellipse'} size={size} color={color} />;
}

export function useAppTheme() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

export function Screen({
  children,
  title,
  subtitle,
  right,
  refreshing,
  onRefresh,
  enableRefresh = true,
  withTabBar = true,
  floating,
}: PropsWithChildren<{
  title?: ReactNode;
  subtitle?: string;
  right?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pull-to-refresh (default on for all product screens). */
  enableRefresh?: boolean;
  withTabBar?: boolean;
  floating?: ReactNode;
}>) {
  const theme = useAppTheme();
  const { tabsBottom, stackBottom } = useSafeLayout();
  const { onScroll, useAnimatedScrollView } = useTabBarScrollHandler();
  const appRefresh = useAppRefresh();
  const ScrollComponent = useAnimatedScrollView ? AnimatedScrollView : ScrollView;
  const isRefreshing = enableRefresh
    ? (refreshing ?? appRefresh.refreshing)
    : Boolean(refreshing);
  const handleRefresh = enableRefresh
    ? (onRefresh ?? appRefresh.onRefresh)
    : onRefresh;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollComponent
        contentContainerStyle={[
          styles.screen,
          Platform.OS === 'web' ? { maxWidth: MaxContentWidth, alignSelf: 'center' } : null,
          { paddingBottom: withTabBar ? tabsBottom : stackBottom },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          handleRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          ) : undefined
        }>
        {(title || subtitle || right) && (
          <View style={[styles.header, !title && !subtitle && styles.headerActionsOnly]}>
            {(title || subtitle) ? (
              <View style={styles.headerText}>
                {typeof title === 'string' ? (
                  <Text accessibilityRole="header" style={[styles.title, { color: theme.textSecondary }]}>
                    {title}
                  </Text>
                ) : (
                  title
                )}
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.headerText} />
            )}
            {right}
          </View>
        )}
        {children}
      </ScrollComponent>
      {floating}
    </SafeAreaView>
  );
}

export function Card({ children, style, delay = 0, accessibilityLabel }: PropsWithChildren<{
  style?: ViewStyle | ViewStyle[]; delay?: number; accessibilityLabel?: string;
}>) {
  const theme = useAppTheme();
  return (
    <Animated.View
      entering={Platform.OS === 'web' ? undefined : FadeInDown.delay(delay).duration(450)}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

export function ScalePressable({ children, onPress, style, haptic = true, ...props }: PropsWithChildren<PressableProps & {
  style?: ViewStyle | ViewStyle[]; haptic?: boolean;
}>) {
  const theme = useAppTheme();
  const pressed = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));
  return (
    <AnimatedPressable
      {...props}
      // Web <button> inherits a system text color; pin it so nested Text stays readable.
      style={[style, Platform.OS === 'web' ? { color: theme.text } : null, animatedStyle]}
      onPressIn={(event) => {
        pressed.value = withSpring(0.975, { damping: 18 });
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(1, { damping: 16 });
        props.onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic && usePreferencesStore.getState().hapticsEnabled) {
          void Haptics.selectionAsync();
        }
        onPress?.(event);
      }}>
      {children}
    </AnimatedPressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  badge?: number;
}) {
  const theme = useAppTheme();
  const count = badge && badge > 0 ? (badge > 9 ? '9+' : String(badge)) : null;
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${badge} sin leer` : label}
      onPress={onPress}
      style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AppIcon name={icon} color={theme.text} size={20} />
      {count ? (
        <View style={[styles.badge, { backgroundColor: theme.danger }]}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </ScalePressable>
  );
}

/** Safe back control — never fires unhandled GO_BACK. */
export function BackIconButton({
  fallback = '/(tabs)/inicio',
  icon = 'arrow.left',
}: {
  fallback?: Href;
  icon?: string;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={16}
      onPress={() => safeGoBack(fallback)}
      style={[styles.iconButton, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
      <AppIcon name={icon} color={theme.text} size={20} />
    </Pressable>
  );
}

export function SectionTitle({ children, action, onAction }: PropsWithChildren<{ action?: string; onAction?: () => void }>) {
  const theme = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>
      {action && <Pressable accessibilityRole="button" onPress={onAction}><Text style={[styles.action, { color: theme.primary }]}>{action}</Text></Pressable>}
    </View>
  );
}

export function ProgressBar({ value, color, label }: { value: number; color?: string; label?: string }) {
  const theme = useAppTheme();
  const safeValue = Math.max(0, Math.min(1, value));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(safeValue * 100) }}>
      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSecondary }]}>
        <View style={[styles.progressFill, { width: `${safeValue * 100}%`, backgroundColor: color ?? theme.primary }]} />
      </View>
    </View>
  );
}

export function Pill({ children, tone = 'blue' }: PropsWithChildren<{ tone?: 'blue' | 'green' | 'orange' | 'neutral' }>) {
  const theme = useAppTheme();
  const colors = {
    blue: [theme.primarySoft, theme.primary],
    green: [theme.successSoft, theme.success],
    orange: [theme.surfaceSecondary, theme.warning],
    neutral: [theme.surfaceSecondary, theme.muted],
  };
  return <View style={[styles.pill, { backgroundColor: colors[tone][0] }]}><Text style={[styles.pillText, { color: colors[tone][1] }]}>{children}</Text></View>;
}

export function PrimaryButton({ children, onPress, icon }: PropsWithChildren<{ onPress?: () => void; icon?: string }>) {
  const theme = useAppTheme();
  return (
    <ScalePressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
      <View style={styles.primaryButtonContent}>
        {icon ? <AppIcon name={icon} size={18} color="#FFFFFF" /> : null}
        <Text style={styles.primaryButtonText}>{children}</Text>
      </View>
    </ScalePressable>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 16 },
  amount: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screen: { width: '100%', paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 12,
  },
  headerActionsOnly: {
    alignItems: 'center',
    paddingBottom: 4,
  },

  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '400', letterSpacing: 0 },
  card: {
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg,
    shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2,
  },
  iconButton: { width: 44, height: 44, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', lineHeight: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.35 },
  action: { fontSize: 14, fontWeight: '600' },
  progressTrack: { height: 8, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 8 },
  pill: {
    alignSelf: 'center',
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
});
