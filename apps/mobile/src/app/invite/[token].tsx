import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppIcon,
  Card,
  PrimaryButton,
  Screen,
  useAppTheme,
} from '@/components/ui';
import { authHref } from '@/lib/auth-entry';
import { localStorage } from '@/services/persistence';
import { useAuthStore } from '@/store/auth';
import { useRecaudosStore } from '@/store/recaudos';

export default function RecaudoInviteScreen() {
  const theme = useAppTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const authenticated = useAuthStore((state) => state.authenticated);
  const acceptInvite = useRecaudosStore((state) => state.acceptInvite);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const continueFlow = async () => {
    if (!token || loading) return;
    if (!authenticated) {
      await localStorage.set('pending-recaudo-invite', token);
      router.replace(authHref('login'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const recaudo = await acceptInvite(token);
      await localStorage.remove('pending-recaudo-invite');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/recaudos');
      router.push(`/(tabs)/recaudo/${recaudo.id}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aceptar la invitación.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Invitación a recaudo" subtitle="TecnoWallet">
      <Card style={styles.card}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name="person.2.fill" color={theme.primary} size={34} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>
          Te invitaron a ahorrar en grupo
        </Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          {authenticated
            ? 'Acepta para ver la meta, configurar tu frecuencia y registrar tus aportes.'
            : 'Inicia sesión o crea tu cuenta con este mismo correo para aceptar.'}
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}
        <PrimaryButton onPress={loading ? undefined : continueFlow}>
          {loading ? 'Aceptando…' : authenticated ? 'Aceptar invitación' : 'Continuar'}
        </PrimaryButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 14, paddingVertical: 28 },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  error: { fontSize: 13, textAlign: 'center' },
});
