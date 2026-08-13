import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ui';
import {
  NATIVE_OAUTH_RETURN,
  WEB_ID_TOKEN_STORAGE_KEY,
  parseIdTokenFromUrl,
} from '@/services/google-auth';

/**
 * Google redirects here (HTTPS). We either deep-link back into the native app
 * or hand the id_token to the web /auth screen via sessionStorage.
 */
export default function OauthGoogleCallbackScreen() {
  const theme = useAppTheme();
  const [error, setError] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setError('Callback de Google solo disponible en web.');
      return;
    }

    const idToken = parseIdTokenFromUrl(window.location.href);
    if (!idToken) {
      const params = new URLSearchParams(window.location.search);
      const err =
        params.get('error_description') ||
        params.get('error') ||
        'Google no devolvió un token.';
      setError(err);
      return;
    }

    const hashOrQuery = window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, '');
    const returnedState = new URLSearchParams(hashOrQuery).get('state');
    let native = returnedState === 'native';
    try {
      native = native || window.sessionStorage.getItem('tw-google-native') === '1';
      window.sessionStorage.setItem(WEB_ID_TOKEN_STORAGE_KEY, idToken);
      window.sessionStorage.removeItem('tw-google-native');
    } catch {
      // ignore
    }

    if (native) {
      const deepLink = `${NATIVE_OAUTH_RETURN}?id_token=${encodeURIComponent(idToken)}`;
      window.location.replace(deepLink);
      return;
    }

    window.location.replace('/auth.html');
  }, []);

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background }]}>
      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.copy, { color: theme.muted }]}>
            Completando inicio de sesión…
          </Text>
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
  error: { fontSize: 14, textAlign: 'center', maxWidth: 360 },
});
