import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LanguagePicker } from '@/components/language-picker';
import { Card, PrimaryButton, useAppTheme } from '@/components/ui';
import { authCopy } from '@/i18n/languages';
import { ApiError } from '@/services/api';
import { PENDING_COLLABORATION_INVITE_KEY } from '@/services/collaboration-api';
import { localStorage } from '@/services/persistence';
import { storeManualAffiliateCode } from '@/services/branch';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';

/**
 * Google rejects mismatched redirect URIs with Error 400: invalid_request.
 * - Web: page origin (https://tecnowallet.app or localhost).
 * - iOS + iOS OAuth client: reversed client id …:/oauthredirect.
 * - iOS + Web client only: tecnowallet://oauthredirect (enable custom URI
 *   scheme on that Web client in Google Cloud Console).
 */
function googleRedirectUri() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return makeRedirectUri({ preferLocalhost: true });
  }
  if (GOOGLE_IOS_CLIENT_ID.endsWith('.apps.googleusercontent.com')) {
    const prefix = GOOGLE_IOS_CLIENT_ID.replace(
      /\.apps\.googleusercontent\.com$/,
      '',
    );
    return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
  }
  return makeRedirectUri({
    scheme: 'tecnowallet',
    path: 'oauthredirect',
  });
}

const GOOGLE_REDIRECT_URI = googleRedirectUri();

function GoogleMark() {
  return (
    <View pointerEvents="none">
      <Svg width={18} height={18} viewBox="0 0 48 48">
        <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
        <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
        <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l.1.1 6.2 5.2C39.2 36.3 44 31 44 24c0-1.3-.1-2.5-.4-3.5z" />
      </Svg>
    </View>
  );
}

export default function AuthScreen() {
  const theme = useAppTheme();
  const locale = useLanguageStore((state) => state.locale);
  const copy = authCopy[locale];
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const resendVerification = useAuthStore((state) => state.resendVerification);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleRequest, , promptGoogle] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID || undefined,
    redirectUri: GOOGLE_REDIRECT_URI,
    // Always show the account picker so invitees can pick the invited Gmail.
    extraParams: { prompt: 'select_account' },
  });

  const goHome = async () => {
    const collaborationToken = await localStorage.get<string | null>(
      PENDING_COLLABORATION_INVITE_KEY,
      null,
    );
    if (collaborationToken) {
      router.replace({
        pathname: '/colaborar',
        params: { token: collaborationToken },
      });
      return;
    }
    const inviteToken = await localStorage.get<string | null>(
      'pending-recaudo-invite',
      null,
    );
    if (inviteToken) {
      router.replace({ pathname: '/invite/[token]', params: { token: inviteToken } });
      return;
    }
    router.replace('/(tabs)/inicio');
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        await signIn(email, password);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await goHome();
        return;
      }
      if (referralCode.trim()) {
        await storeManualAffiliateCode(referralCode);
      }
      const result = await signUp(name, email, password);
      setEmail(result.email);
      setCode(result.devCode ?? '');
      setMode('verify');
      setInfo(
        result.devCode
          ? `${copy.codeSent} (dev: ${result.devCode})`
          : copy.codeSent,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.genericError);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await verifyEmail(email, code);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await goHome();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.genericError);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const submitResend = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await resendVerification(email);
      if (result.devCode) setCode(result.devCode);
      setInfo(
        result.devCode
          ? `${copy.codeSent} (dev: ${result.devCode})`
          : copy.codeSent,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.genericError);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const result = await requestPasswordReset(email);
      setInfo(
        result.devResetLink
          ? `${copy.forgotSent}\n(dev: ${result.devResetLink})`
          : copy.forgotSent,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.genericError);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

    const submitGoogle = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      setError(
        'Google Sign-In no está configurado (falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).',
      );
      return;
    }
    if (!googleRequest) {
      setError('Google todavía se está preparando. Inténtalo en un segundo.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await promptGoogle();
      if (result.type === 'dismiss' || result.type === 'cancel') {
        return;
      }
      if (result.type !== 'success') {
        throw new Error('No se completó el inicio con Google.');
      }
      const idToken =
        result.params.id_token ??
        (result as { authentication?: { idToken?: string } }).authentication
          ?.idToken;
      if (!idToken) {
        throw new Error('Google no devolvió un ID token.');
      }
      await signInWithGoogle(idToken);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await goHome();
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.message === 'Invalid Google ID token'
            ? 'Google rechazó el inicio de sesión. En iOS el Client ID / redirect debe coincidir con Google Cloud (incluye tecnowallet://oauthredirect o el reversed client id).'
            : cause.message === 'Google Sign-In is not configured'
              ? 'El servidor no tiene GOOGLE_CLIENT_ID_WEB. Configúralo en Render y redespliega.'
              : cause.message
          : cause instanceof Error
            ? cause.message
            : copy.genericError;
      setError(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View style={styles.topSpacer} />
          <LanguagePicker label={copy.language} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Image
            source={require('../../assets/images/tecnowallet-brand.png')}
            style={styles.logo as ImageStyle}
            contentFit="contain"
            accessibilityLabel="TecnoWallet"
          />
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.text }]}>
              {mode === 'register'
                ? copy.registerTitle
                : mode === 'verify'
                  ? copy.verifyTitle
                  : mode === 'forgot'
                    ? copy.forgotTitle
                    : copy.welcomeTitle}
            </Text>
          </View>

          <Card style={styles.form}>
            {mode === 'verify' ? (
              <>
                <Text style={[styles.verifyHint, { color: theme.muted }]}>
                  {copy.verifyHint.replace('{email}', email.trim().toLowerCase())}
                </Text>
                <Text style={[styles.label, { color: theme.text }]}>{copy.verifyCode}</Text>
                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={theme.muted}
                  style={[styles.input, styles.codeInput, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                />
                {info ? <Text style={[styles.info, { color: theme.primary }]}>{info}</Text> : null}
                {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
                <PrimaryButton onPress={loading ? undefined : () => void submitVerify()}>
                  {loading ? copy.verifying : copy.verifyAction}
                </PrimaryButton>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => void submitResend()}
                >
                  <Text style={[styles.forgot, { color: theme.primary }]}>
                    {loading ? copy.resending : copy.resendCode}
                  </Text>
                </Pressable>
              </>
            ) : mode === 'forgot' ? (
              <>
                <Text style={[styles.label, { color: theme.text }]}>{copy.email}</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder={copy.emailPlaceholder}
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                />
                <Text style={[styles.hint, { color: theme.muted }]}>{copy.forgotHint}</Text>
                {info ? <Text style={[styles.info, { color: theme.primary }]}>{info}</Text> : null}
                {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
                <PrimaryButton onPress={loading ? undefined : () => void submitForgot()}>
                  {loading ? copy.forgotSending : copy.forgotAction}
                </PrimaryButton>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setError('');
                    setInfo('');
                    setMode('login');
                  }}>
                  <Text style={[styles.forgot, { color: theme.primary }]}>{copy.forgotBack}</Text>
                </Pressable>
              </>
            ) : (
              <>
                {mode === 'register' ? (
                  <>
                    <Text style={[styles.label, { color: theme.text }]}>{copy.name}</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      autoComplete="name"
                      placeholder={copy.namePlaceholder}
                      placeholderTextColor={theme.muted}
                      style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                    />
                    <Text style={[styles.label, { color: theme.text }]}>
                      Código de recomendación (opcional)
                    </Text>
                    <TextInput
                      value={referralCode}
                      onChangeText={(value) => setReferralCode(value.toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="Ej. TECNO10"
                      placeholderTextColor={theme.muted}
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.surfaceSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                    />
                  </>
                ) : null}
                <Text style={[styles.label, { color: theme.text }]}>{copy.email}</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder={copy.emailPlaceholder}
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                />
                <Text style={[styles.label, { color: theme.text }]}>{copy.password}</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={mode === 'login' ? 'password' : 'new-password'}
                  placeholder={copy.passwordPlaceholder}
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                />
                {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
                <PrimaryButton onPress={loading ? undefined : () => void submit()}>
                  {loading
                    ? mode === 'login'
                      ? copy.signingIn
                      : copy.creating
                    : mode === 'login'
                      ? copy.signIn
                      : copy.signUp}
                </PrimaryButton>
                {mode === 'login' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setError('');
                      setInfo('');
                      setMode('forgot');
                    }}>
                    <Text style={[styles.forgot, { color: theme.primary }]}>{copy.forgot}</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </Card>

          {mode !== 'verify' && mode !== 'forgot' ? (
            <>
              <View style={styles.demo}>
                <View style={[styles.line, { backgroundColor: theme.border }]} />
                <Text style={[styles.or, { color: theme.muted }]}>{copy.or}</Text>
                <View style={[styles.line, { backgroundColor: theme.border }]} />
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={loading || !googleRequest}
                style={[styles.socialButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={() => void submitGoogle()}>
                <GoogleMark />
                <Text style={[styles.socialText, { color: theme.text }]}>{copy.google}</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            style={styles.switchMode}
            onPress={() => {
              setError('');
              setInfo('');
              setCode('');
              setMode((current) =>
                current === 'login' ? 'register' : 'login',
              );
            }}>
            <Text style={[styles.switchText, { color: theme.muted }]}>
              {mode === 'login' ? copy.noAccount : copy.hasAccount}{' '}
              <Text style={{ color: theme.primary, fontWeight: '700' }}>
                {mode === 'login' ? copy.registerLink : copy.signInLink}
              </Text>
            </Text>
          </Pressable>

          <Text style={[styles.legal, { color: theme.muted }]}>{copy.legal}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    height: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  topSpacer: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
    justifyContent: 'center',
    gap: 16,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  logo: { width: '100%', maxWidth: 320, height: 110, alignSelf: 'center' },
  heading: { alignItems: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' },
  form: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 13 },
  info: { fontSize: 13, lineHeight: 18 },
  verifyHint: { fontSize: 14, lineHeight: 20 },
  codeInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  forgot: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingTop: 3 },
  hint: { fontSize: 13, lineHeight: 19 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: 13 },
  socialButton: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  socialText: { fontSize: 15, fontWeight: '600' },
  switchMode: { alignItems: 'center', paddingVertical: 4 },
  switchText: { fontSize: 14, textAlign: 'center' },
  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 20 },
});
