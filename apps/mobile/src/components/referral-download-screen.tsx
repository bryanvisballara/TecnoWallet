import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, PrimaryButton, Screen, useAppTheme } from '@/components/ui';
import { clearReferralAffiliateCode, REFERRAL_APP_STORE_URL } from '@/lib/referral-auth';
import { useLanguageStore } from '@/store/language';

const copy = {
  es: {
    subtitle: 'Referido',
    title: '¡Cuenta lista!',
    body: 'Tu recomendación quedó registrada. Descarga TecnoWallet en tu iPhone e inicia sesión con el mismo correo.',
    download: 'Descargar en App Store',
    web: 'Continuar en la web',
  },
  en: {
    subtitle: 'Referral',
    title: 'Account ready!',
    body: 'Your referral is saved. Download TecnoWallet on your iPhone and sign in with the same email.',
    download: 'Download on the App Store',
    web: 'Continue on the web',
  },
} as const;

export function ReferralDownloadScreen({ referrerLabel }: { referrerLabel?: string | null }) {
  const theme = useAppTheme();
  const locale = useLanguageStore((state) => state.locale);
  const text = locale === 'es' ? copy.es : copy.en;

  const openStore = () => {
    void Linking.openURL(REFERRAL_APP_STORE_URL);
  };

  const continueWeb = () => {
    void clearReferralAffiliateCode().finally(() => {
      router.replace('/(tabs)/inicio');
    });
  };

  return (
    <Screen title="TecnoWallet" subtitle={text.subtitle}>
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name="checkmark.circle.fill" color={theme.primary} size={40} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{text.title}</Text>
        {referrerLabel ? (
          <Text style={[styles.referrer, { color: theme.primary }]}>
            {locale === 'es' ? `Te recomienda: ${referrerLabel}` : `Recommended by: ${referrerLabel}`}
          </Text>
        ) : null}
        <Text style={[styles.body, { color: theme.muted }]}>{text.body}</Text>
        <PrimaryButton onPress={openStore}>{text.download}</PrimaryButton>
        <Pressable accessibilityRole="button" onPress={continueWeb} style={styles.webLink}>
          <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 15 }}>{text.web}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 16,
    padding: 28,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  referrer: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    maxWidth: 420,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  webLink: {
    paddingVertical: 10,
  },
});
