import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppIcon, PrimaryButton, Screen, useAppTheme } from '@/components/ui';
import { recordAffiliateClick } from '@/services/affiliate-api';
import { storeWebAffiliateReferral } from '@/services/branch';

const APP_STORE_URL =
  process.env.EXPO_PUBLIC_APP_STORE_URL ||
  'https://apps.apple.com/app/tecnowallet';

export default function AffiliateReferralRoute() {
  const theme = useAppTheme();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const [error, setError] = useState('');

  const continueReferral = async () => {
    if (!code) return;
    setError('');
    try {
      const affiliate = await recordAffiliateClick({
        code,
        campaign: `creator_${code.toLowerCase()}`,
      });
      await storeWebAffiliateReferral(affiliate.code, affiliate.clickId);
      if (affiliate.branchUrl) {
        await Linking.openURL(affiliate.branchUrl);
        return;
      }
      if (process.env.EXPO_OS === 'web') {
        await Linking.openURL(APP_STORE_URL);
      } else {
        router.replace('/auth');
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Este enlace de recomendación no está disponible.',
      );
    }
  };

  useEffect(() => {
    void continueReferral();
  }, [code]);

  return (
    <Screen title="TecnoWallet" subtitle="Recomendación">
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name="gift.fill" color={theme.primary} size={36} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>
          Te invitaron a tomar el control de tu dinero
        </Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Estamos registrando la recomendación y preparando TecnoWallet para ti.
        </Text>
        {!error ? <ActivityIndicator color={theme.primary} /> : null}
        {error ? (
          <>
            <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
            <PrimaryButton onPress={() => void continueReferral()}>
              Intentar de nuevo
            </PrimaryButton>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    maxWidth: 420,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    maxWidth: 440,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  error: { fontSize: 13, textAlign: 'center' },
});
