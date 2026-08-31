import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
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
import Animated, { FadeIn, FadeInLeft, FadeInRight, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LanguagePicker } from '@/components/language-picker';
import { Card, PrimaryButton, useAppTheme } from '@/components/ui';
import { authCopy } from '@/i18n/languages';
import { ApiError } from '@/services/api';
import { PENDING_COLLABORATION_INVITE_KEY } from '@/services/collaboration-api';
import { createAppleNonce } from '@/services/apple-auth';
import {
  GOOGLE_WEB_CLIENT_ID,
  NATIVE_OAUTH_RETURN,
  WEB_ID_TOKEN_STORAGE_KEY,
  createOauthNonce,
  googleStartUrl,
  parseIdTokenFromUrl,
} from '@/services/google-auth';
import { localStorage } from '@/services/persistence';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import type { AuthEntryMode } from '@/lib/auth-entry';

WebBrowser.maybeCompleteAuthSession();

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
  const signInWithApple = useAuthStore((state) => state.signInWithApple);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const requestedMode = (Array.isArray(params.mode) ? params.mode[0] : params.mode)?.trim();
  const initialMode: AuthEntryMode = requestedMode === 'login' ? 'login' : 'register';
  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const enterFrom = useRef<'up' | 'left' | 'right'>('up');

  const goMode = (next: 'login' | 'register' | 'verify' | 'forgot') => {
    if (next === mode) return;
    if (mode === 'register' && next === 'login') enterFrom.current = 'right';
    else if (mode === 'login' && next === 'register') enterFrom.current = 'left';
    else enterFrom.current = 'up';
    setError('');
    setInfo('');
    if (next === 'login' || next === 'register') setCode('');
    setMode(next);
  };

  const paneEntering =
    enterFrom.current === 'right'
      ? FadeInRight.duration(320)
      : enterFrom.current === 'left'
        ? FadeInLeft.duration(320)
        : FadeInUp.duration(380);

  useEffect(() => {
    if (requestedMode === 'login') {
      enterFrom.current = 'right';
      setMode((current) => (current === 'verify' || current === 'forgot' ? current : 'login'));
      return;
    }
    if (requestedMode === 'register') {
      enterFrom.current = 'left';
      setMode((current) => (current === 'verify' || current === 'forgot' ? current : 'register'));
    }
  }, [requestedMode]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let token = parseIdTokenFromUrl(window.location.href) || '';
    if (token) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState({}, '', next || '/auth');
    }
    if (!token) {
      try {
        token = window.sessionStorage.getItem(WEB_ID_TOKEN_STORAGE_KEY) || '';
        if (token) window.sessionStorage.removeItem(WEB_ID_TOKEN_STORAGE_KEY);
      } catch {
        return;
      }
    }
    if (!token) return;
    setLoading(true);
    void signInWithGoogle(token)
      .then(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await goHome();
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : copy.genericError);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on return from Google HTTPS callback
  }, []);

  const submitGoogle = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      setError(
        'Google Sign-In no está configurado (falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).',
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      const nonce = await createOauthNonce();
      const startUrl = googleStartUrl({ nonce });

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(startUrl);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        startUrl,
        NATIVE_OAUTH_RETURN,
      );
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        throw new Error('No se completó el inicio con Google.');
      }
      const idToken = parseIdTokenFromUrl(result.url);
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
            ? 'Google rechazó el token. Revisa GOOGLE_CLIENT_ID_WEB en Render y que https://tecnowallet.app/oauth-google-callback/ esté en redirect URIs.'
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

  const submitApple = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { rawNonce, hashedNonce } = await createAppleNonce();
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple no devolvió un token. Inténtalo de nuevo.');
      }
      await signInWithApple({
        identityToken: credential.identityToken,
        nonce: rawNonce,
        givenName: credential.fullName?.givenName ?? undefined,
        familyName: credential.fullName?.familyName ?? undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await goHome();
    } catch (cause) {
      const code =
        cause && typeof cause === 'object' && 'code' in cause
          ? String((cause as { code?: string }).code)
          : '';
      if (code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      const message =
        cause instanceof ApiError
          ? cause.message === 'Invalid Apple identity token'
            ? 'Apple rechazó el token. Revisa el bundle id y vuelve a intentar.'
            : cause.message === 'Sign in with Apple is not configured'
              ? 'El servidor no tiene Sign in with Apple configurado.'
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
          <Animated.View entering={FadeIn.duration(420)}>
            <Image
              source={require('../../assets/images/tecnowallet-brand.png')}
              style={styles.logo as ImageStyle}
              contentFit="contain"
              accessibilityLabel="TecnoWallet"
            />
          </Animated.View>
          <Animated.View key={mode} entering={paneEntering} style={styles.pane}>
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
                    goMode('login');
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
                      goMode('forgot');
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

              <View style={styles.socialStack}>
                {appleAvailable ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={
                      mode === 'register'
                        ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                        : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    }
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={16}
                    style={styles.appleButton}
                    onPress={() => void submitApple()}
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  style={[styles.socialButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={() => void submitGoogle()}>
                  <GoogleMark />
                  <Text style={[styles.socialText, { color: theme.text }]}>{copy.google}</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {mode !== 'forgot' ? (
            <Pressable
              accessibilityRole="button"
              style={styles.switchMode}
              onPress={() => goMode(mode === 'login' ? 'register' : 'login')}>
              <Text style={[styles.switchText, { color: theme.muted }]}>
                {mode === 'login' ? copy.noAccount : copy.hasAccount}{' '}
                <Text style={{ color: theme.primary, fontWeight: '700' }}>
                  {mode === 'login' ? copy.registerLink : copy.signInLink}
                </Text>
              </Text>
            </Pressable>
          ) : null}
          </Animated.View>

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
  pane: { gap: 16 },
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
  socialStack: { gap: 10 },
  appleButton: { width: '100%', height: 50 },
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
