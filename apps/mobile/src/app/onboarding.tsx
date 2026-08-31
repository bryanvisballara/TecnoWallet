import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  I18nManager,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type ImageStyle,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguagePicker } from '@/components/language-picker';
import { AppIcon, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { onboardingCopy } from '@/i18n/languages';
import { authHref } from '@/lib/auth-entry';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

const { width } = Dimensions.get('window');
const slideIcons = ['chart.pie.fill', 'sparkles', 'lock.shield.fill'] as const;

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const scheme = useColorScheme();
  const [page, setPage] = useState(0);
  const finish = useAuthStore((state) => state.finishOnboarding);
  const locale = useLanguageStore((state) => state.locale);
  const copy = onboardingCopy[locale];
  const slides = useMemo(
    () =>
      copy.slides.map((slide, index) => ({
        ...slide,
        icon: slideIcons[index],
      })),
    [copy.slides],
  );
  const isRtl = locale === 'ar';

  const next = async () => {
    if (page < slides.length - 1) setPage(page + 1);
    else {
      await finish();
      router.replace(authHref('register'));
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={[styles.top, isRtl && styles.topRtl]}>
        <Image source={require('../../assets/images/tecnowallet-logo.png')} style={styles.logo as ImageStyle} contentFit="contain" />
        <View style={[styles.actions, isRtl && styles.actionsRtl]}>
          <LanguagePicker label={copy.language} />
          <ScalePressable onPress={async () => { await finish(); router.replace(authHref('register')); }}>
            <Text style={[styles.skip, { color: theme.muted }]}>{copy.skip}</Text>
          </ScalePressable>
        </View>
      </View>
      <FlatList
        data={[slides[page]]}
        key={`${locale}-${page}`}
        horizontal
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(300)} style={styles.slide}>
            <View style={[styles.orb, { backgroundColor: theme.primarySoft }]}>
              <View style={[styles.orbInner, { backgroundColor: scheme === 'dark' ? '#17355D' : '#FFFFFF' }]}>
                <AppIcon name={item.icon} size={72} color={theme.primary} />
              </View>
            </View>
            <Animated.Text
              entering={FadeInUp.delay(80)}
              style={[styles.title, { color: theme.text, writingDirection: isRtl || I18nManager.isRTL ? 'rtl' : 'ltr' }]}>
              {item.title}
            </Animated.Text>
            <Text style={[styles.text, { color: theme.muted, writingDirection: isRtl ? 'rtl' : 'ltr' }]}>{item.text}</Text>
          </Animated.View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor: index === page ? theme.primary : theme.border,
                  width: index === page ? 24 : 7,
                },
              ]}
            />
          ))}
        </View>
        <PrimaryButton onPress={next}>{page === slides.length - 1 ? copy.start : copy.continue}</PrimaryButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  topRtl: { flexDirection: 'row-reverse' },
  logo: { width: 68, height: 48 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionsRtl: { flexDirection: 'row-reverse' },
  skip: { fontSize: 15, fontWeight: '600', padding: 8 },
  slide: { width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 20 },
  orb: { width: 232, height: 232, borderRadius: 116, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  orbInner: {
    width: 168,
    height: 168,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0878F9',
    shadowOpacity: 0.15,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  title: { fontSize: 36, lineHeight: 42, textAlign: 'center', fontWeight: '700', letterSpacing: -1.2 },
  text: { fontSize: 17, lineHeight: 25, textAlign: 'center', maxWidth: 340 },
  footer: { paddingHorizontal: 20, paddingBottom: 18, gap: 24 },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 7, height: 7 },
  dot: { height: 7, borderRadius: 4 },
});
