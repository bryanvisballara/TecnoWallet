import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useAppTheme } from '@/components/ui';
import {
  APP_WEB_ORIGIN,
  GOOGLE_WEB_CLIENT_ID,
  buildGoogleAuthorizeUrl,
  createOauthNonce,
  googleCallbackUrl,
} from '@/services/google-auth';

/**
 * Hosted on tecnowallet.app — starts Google OAuth with an HTTPS redirect_uri.
 * Native apps open this URL inside an auth session; Google never sees tecnowallet://.
 */
export default function OauthGoogleStartScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ nonce?: string; native?: string }>();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!GOOGLE_WEB_CLIENT_ID) {
        setError('Google Sign-In no está configurado.');
        return;
      }
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        setError('Abre este enlace en el navegador o desde la app.');
        return;
      }

      const nonce =
        (typeof params.nonce === 'string' && params.nonce.trim()) ||
        (await createOauthNonce());
      const native =
        params.native === '1' ||
        new URLSearchParams(window.location.search).get('native') === '1';

      try {
        window.sessionStorage.setItem('tw-google-nonce', nonce);
        window.sessionStorage.setItem('tw-google-native', native ? '1' : '0');
      } catch {
        // sessionStorage may be blocked; continue anyway.
      }

      const authorize = buildGoogleAuthorizeUrl({
        clientId: GOOGLE_WEB_CLIENT_ID,
        redirectUri: googleCallbackUrl(),
        nonce,
        state: native ? 'native' : 'web',
      });
      if (!cancelled) window.location.replace(authorize);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.native, params.nonce]);

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background }]}>
      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.copy, { color: theme.muted }]}>
            Conectando con Google…
          </Text>
          <Text style={[styles.small, { color: theme.muted }]}>{APP_WEB_ORIGIN}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  copy: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 12 },
  error: { fontSize: 14, textAlign: 'center', maxWidth: 360 },
});
