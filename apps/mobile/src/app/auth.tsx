import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
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
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

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
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const enterDemo = useAuthStore((state) => state.enterDemo);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const goHome = () => router.replace('/(tabs)/inicio');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(name, email, password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goHome();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.genericError);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const submitGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goHome();
    } catch {
      setError(copy.genericError);
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
              {mode === 'login' ? copy.welcomeTitle : copy.registerTitle}
            </Text>
          </View>

          <Card style={styles.form}>
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
            <PrimaryButton onPress={loading ? undefined : submit}>
              {loading
                ? mode === 'login'
                  ? copy.signingIn
                  : copy.creating
                : mode === 'login'
                  ? copy.signIn
                  : copy.signUp}
            </PrimaryButton>
            {mode === 'login' ? (
              <Pressable accessibilityRole="button">
                <Text style={[styles.forgot, { color: theme.primary }]}>{copy.forgot}</Text>
              </Pressable>
            ) : null}
          </Card>

          <View style={styles.demo}>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
            <Text style={[styles.or, { color: theme.muted }]}>{copy.or}</Text>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            style={[styles.socialButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={submitGoogle}>
            <GoogleMark />
            <Text style={[styles.socialText, { color: theme.text }]}>{copy.google}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={[styles.demoButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={async () => {
              await enterDemo();
              goHome();
            }}>
            <Text style={[styles.demoText, { color: theme.text }]}>{copy.demo}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={styles.switchMode}
            onPress={() => {
              setError('');
              setMode((current) => (current === 'login' ? 'register' : 'login'));
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
  forgot: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingTop: 3 },
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
  demoButton: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoText: { fontSize: 15, fontWeight: '600' },
  switchMode: { alignItems: 'center', paddingVertical: 4 },
  switchText: { fontSize: 14, textAlign: 'center' },
  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 20 },
});
