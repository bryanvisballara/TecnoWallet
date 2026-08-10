import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppIcon, PrimaryButton, Screen, useAppTheme } from '@/components/ui';
import {
  acceptCollaborationInvite,
  lookupCollaborationInvite,
  storePendingCollaborationInvite,
  type CollaborationInvitePreview,
} from '@/services/collaboration-api';
import { useAuthStore } from '@/store/auth';
import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';

export default function CollaborationInviteRoute() {
  const theme = useAppTheme();
  const authenticated = useAuthStore((state) => state.authenticated);
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const [preview, setPreview] = useState<CollaborationInvitePreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Este enlace de invitación no es válido.');
      setLoading(false);
      return;
    }
    void lookupCollaborationInvite(token)
      .then(setPreview)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'La invitación venció o ya fue utilizada.',
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!token) return;
    setAccepting(true);
    setError('');
    try {
      if (!authenticated) {
        await storePendingCollaborationInvite(token);
        router.replace('/auth');
        return;
      }
      const result = await acceptCollaborationInvite(token);
      await useLedgerStore.getState().hydrate();
      await useCalendarStore.getState().hydrate();
      router.replace(result.resourceType === 'calendar' ? '/(tabs)/calendars' : '/');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No pudimos aceptar la invitación.',
      );
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Screen title="Invitación" subtitle="Colaboración segura">
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <AppIcon
            name={preview?.resourceType === 'calendar' ? 'calendar' : 'book.fill'}
            color={theme.primary}
            size={34}
          />
        </View>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {preview ? (
          <>
            <Text style={[styles.title, { color: theme.text }]}>
              {preview.sponsorName} te invitó a {preview.resourceName}
            </Text>
            <Text style={[styles.body, { color: theme.muted }]}>
              Acceso como {preview.role === 'viewer' ? 'solo lectura' : 'editor'} ·{' '}
              {preview.emailHint}
            </Text>
            <PrimaryButton
              onPress={() => void accept()}
            >
              {accepting
                ? 'Aceptando…'
                : authenticated
                  ? 'Aceptar invitación'
                  : 'Ingresar para aceptar'}
            </PrimaryButton>
          </>
        ) : null}
        {error ? (
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
        ) : null}
        <Text style={[styles.body, { color: theme.muted, marginTop: 8 }]}>
          Debes iniciar sesión con el mismo correo de la invitación. Si Google
          solo muestra otra cuenta, elige “Usar otra cuenta”.
        </Text>
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
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    maxWidth: 440,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  body: { maxWidth: 440, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  error: { textAlign: 'center', fontSize: 13 },
});
