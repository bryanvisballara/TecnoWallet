import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, useAppTheme } from '@/components/ui';
import { authCopy } from '@/i18n/languages';
import { authHref } from '@/lib/auth-entry';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

export default function ResetPasswordScreen() {
  const theme = useAppTheme();
  const locale = useLanguageStore((state) => state.locale);
  const copy = authCopy[locale];
  const resetPasswordWithToken = useAuthStore(
    (state) => state.resetPasswordWithToken,
  );
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => {
    const raw = params.token;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return (value ?? '').trim();
  }, [params.token]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!token || token.length < 32) {
      setError(copy.resetInvalid);
      return;
    }
    if (password.length < 8) {
      setError(copy.passwordPlaceholder);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await resetPasswordWithToken(token, password);
      setInfo(copy.resetDone);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.replace(authHref('login')), 1200);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : copy.resetInvalid,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            {copy.resetTitle}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {copy.resetHint}
          </Text>

          {!token ? (
            <Text style={[styles.error, { color: theme.danger }]}>
              {copy.resetInvalid}
            </Text>
          ) : (
            <>
              <Text style={[styles.label, { color: theme.text }]}>
                {copy.resetPassword}
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder={copy.passwordPlaceholder}
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
              <Text style={[styles.label, { color: theme.text }]}>
                {copy.resetConfirm}
              </Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                placeholder={copy.passwordPlaceholder}
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
              {info ? (
                <Text style={[styles.info, { color: theme.primary }]}>{info}</Text>
              ) : null}
              {error ? (
                <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
                  {error}
                </Text>
              ) : null}
              <PrimaryButton onPress={loading ? undefined : () => void submit()}>
                {loading ? copy.resetSaving : copy.resetAction}
              </PrimaryButton>
            </>
          )}

          <Pressable accessibilityRole="button" onPress={() => router.replace(authHref('login'))}>
            <Text style={[styles.link, { color: theme.primary }]}>
              {copy.forgotBack}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 10,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  error: { fontSize: 13 },
  info: { fontSize: 13, fontWeight: '600' },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600', marginTop: 10 },
});
