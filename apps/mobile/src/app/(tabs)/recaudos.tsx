import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RecaudoHeroCard } from '@/components/recaudo-hero-card';
import {
  AppIcon,
  Card,
  Pill,
  PrimaryButton,
  ScalePressable,
  Screen,
  useAppTheme,
} from '@/components/ui';
import { useSafeLayout } from '@/hooks/use-safe-layout';
import { useAppCopy } from '@/i18n/app-copy';
import { safeGoBack } from '@/lib/navigation';
import {
  useRecaudosStore,
  type Recaudo,
  type RecaudoAccessRequest,
  type RecaudoCategory,
} from '@/store/recaudos';

const categoryIcons: Record<RecaudoCategory, { icon: string; color: string }> = {
  travel: { icon: 'airplane', color: '#0878F9' },
  gift: { icon: 'gift.fill', color: '#EE46BC' },
  event: { icon: 'ticket.fill', color: '#7F56D9' },
  purchase: { icon: 'cart.fill', color: '#F79009' },
  other: { icon: 'sparkles', color: '#0E9F6E' },
};

async function copyText(value: string) {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to Share
  }
  try {
    await Share.share({ message: value });
    return true;
  } catch {
    return false;
  }
}

function RecaudoCard({ recaudo }: { recaudo: Recaudo }) {
  const categoryMeta = categoryIcons[recaudo.category];
  const ratio = recaudo.targetMinor > 0 ? recaudo.collectedMinor / recaudo.targetMinor : 0;
  const percent = Math.min(100, Math.round(ratio * 100));

  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir recaudo ${recaudo.title}`}
      onPress={() =>
        router.push({ pathname: '/(tabs)/recaudo/[id]', params: { id: recaudo.id } })
      }>
      <RecaudoHeroCard
        title={recaudo.title}
        categoryIcon={categoryMeta.icon}
        collectedMinor={recaudo.collectedMinor}
        targetMinor={recaudo.targetMinor}
        percent={percent}
        ratio={ratio}
      />
    </ScalePressable>
  );
}

export default function RecaudosScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const { fabBottom } = useSafeLayout();
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const shareMode = params.tab === 'share';
  const recaudos = useRecaudosStore((state) => state.recaudos);
  const hydrated = useRecaudosStore((state) => state.hydrated);
  const hydrate = useRecaudosStore((state) => state.hydrate);
  const invite = useRecaudosStore((state) => state.invite);
  const fetchShareCode = useRecaudosStore((state) => state.fetchShareCode);
  const requestJoinByCode = useRecaudosStore((state) => state.requestJoinByCode);
  const listAccessRequests = useRecaudosStore((state) => state.listAccessRequests);
  const acceptAccessRequest = useRecaudosStore((state) => state.acceptAccessRequest);
  const rejectAccessRequest = useRecaudosStore((state) => state.rejectAccessRequest);
  const refresh = useRecaudosStore((state) => state.refresh);

  const [selectedId, setSelectedId] = useState(params.focus || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [shareCodeLoading, setShareCodeLoading] = useState(false);
  const [accessRequests, setAccessRequests] = useState<RecaudoAccessRequest[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (params.focus && recaudos.some((item) => item.id === params.focus)) {
      setSelectedId(params.focus);
    }
  }, [params.focus, recaudos]);

  const active = useMemo(
    () => recaudos.filter((item) => item.status !== 'closed'),
    [recaudos],
  );

  const selected = useMemo(
    () => active.find((item) => item.id === selectedId) ?? active[0],
    [active, selectedId],
  );

  const loadAccessRequests = useCallback(
    async (recaudoId?: string) => {
      if (!recaudoId) {
        setAccessRequests([]);
        return;
      }
      try {
        setAccessRequests(await listAccessRequests(recaudoId));
      } catch {
        setAccessRequests([]);
      }
    },
    [listAccessRequests],
  );

  useEffect(() => {
    if (!shareMode || !selected?.id || !selected.isOrganizer) {
      setShareCode('');
      setAccessRequests([]);
      return;
    }
    let cancelled = false;
    const cached = selected.shareCode?.trim().toUpperCase() || '';
    if (cached) {
      setShareCode(cached);
    } else {
      setShareCodeLoading(true);
      void fetchShareCode(selected.id)
        .then((code) => {
          if (!cancelled) setShareCode(code);
        })
        .catch(() => {
          if (!cancelled) setShareCode('');
        })
        .finally(() => {
          if (!cancelled) setShareCodeLoading(false);
        });
    }
    void loadAccessRequests(selected.id);
    return () => {
      cancelled = true;
    };
  }, [
    shareMode,
    selected?.id,
    selected?.isOrganizer,
    selected?.shareCode,
    fetchShareCode,
    loadAccessRequests,
  ]);

  const onInvite = async () => {
    if (!selected?.isOrganizer) {
      Alert.alert(
        'Solo el organizador',
        'Solo quien creó el recaudo puede invitar a más personas.',
      );
      return;
    }
    if (!inviteEmail.trim()) {
      Alert.alert('Falta el correo', 'Escribe el correo de la persona que quieres invitar.');
      return;
    }
    setInviting(true);
    try {
      const result = await invite(selected.id, inviteEmail);
      setInviteEmail('');
      Alert.alert(
        'Invitación enviada',
        result.previewLink
          ? `En modo demo puedes previsualizarla en:\n${result.previewLink}`
          : `Enviamos la invitación por correo a ${inviteEmail.trim().toLowerCase()}.`,
      );
    } catch (error) {
      Alert.alert(
        'No se pudo invitar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setInviting(false);
    }
  };

  const onRequestJoin = async () => {
    setJoinBusy(true);
    try {
      const result = await requestJoinByCode(joinCode);
      setJoinCode('');
      setJoining(false);
      Alert.alert(
        'Solicitud enviada',
        result.title
          ? `Pediste unirte a “${result.title}”. El organizador debe aceptarte.`
          : 'El organizador debe aceptar tu solicitud.',
      );
    } catch (error) {
      Alert.alert(
        'No se pudo solicitar',
        error instanceof Error ? error.message : 'Revisa el ID e inténtalo de nuevo.',
      );
    } finally {
      setJoinBusy(false);
    }
  };

  if (shareMode) {
    if (!selected) {
      return (
        <Screen
          title="Compartir recaudo"
          subtitle="No hay un recaudo seleccionado"
          right={
            <Pressable
              onPress={() => safeGoBack('/(tabs)/recaudos')}
              style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
              <AppIcon name="arrow.left" color={theme.text} />
            </Pressable>
          }
        />
      );
    }

    return (
      <Screen
        title={selected.title}
        subtitle="Invita personas y comparte el ID del recaudo"
        right={
          <Pressable
            onPress={() =>
              router.replace({
                pathname: '/(tabs)/recaudo/[id]',
                params: { id: selected.id },
              })
            }
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
        }>
        {active.length > 1 ? (
          <Card style={styles.listCard}>
            {active.map((recaudo, index) => {
              const activeRow = recaudo.id === selected.id;
              return (
                <ScalePressable
                  key={recaudo.id}
                  onPress={() => setSelectedId(recaudo.id)}
                  style={[
                    styles.ledgerRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.border,
                    },
                    activeRow && { backgroundColor: theme.primarySoft },
                  ]}>
                  <View style={styles.cardCopy}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{recaudo.title}</Text>
                    <Text style={[styles.cardMeta, { color: theme.muted }]}>
                      {copy.collections.participants(recaudo.participants.length)}
                    </Text>
                  </View>
                  {recaudo.isOrganizer ? <Pill tone="blue">Organizas</Pill> : null}
                </ScalePressable>
              );
            })}
          </Card>
        ) : null}

        {selected.isOrganizer ? (
          <>
            <Card style={styles.block}>
              <Text style={[styles.section, { color: theme.text }]}>Invitar por correo</Text>
              <Text style={[styles.hint, { color: theme.muted }]}>
                La invitación se envía mediante TecnoWallet.
              </Text>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="persona@correo.com"
                placeholderTextColor={theme.muted}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceSecondary,
                  },
                ]}
              />
              <PrimaryButton
                icon="paperplane.fill"
                onPress={inviting ? undefined : () => void onInvite()}>
                {inviting ? 'Enviando…' : 'Enviar invitación'}
              </PrimaryButton>

              <Text style={[styles.label, { color: theme.muted, marginTop: 4 }]}>
                ID del recaudo
              </Text>
              <Text style={[styles.hint, { color: theme.muted }]}>
                Comparte este código para que pidan unirse desde “Unirse con ID”.
              </Text>
              <View
                style={[
                  styles.codeBox,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}>
                <Text style={[styles.codeText, { color: theme.text }]}>
                  {shareCodeLoading ? 'Cargando…' : shareCode || '—'}
                </Text>
              </View>
              <PrimaryButton
                onPress={async () => {
                  if (!shareCode) {
                    Alert.alert('ID no disponible', 'Espera un momento e inténtalo de nuevo.');
                    return;
                  }
                  const ok = await copyText(shareCode);
                  if (ok) Alert.alert('Listo', `ID del recaudo: ${shareCode}`);
                }}>
                Copiar / compartir ID
              </PrimaryButton>
            </Card>

            <Card style={styles.block}>
              <Text style={[styles.section, { color: theme.text }]}>Solicitudes</Text>
              <Text style={[styles.hint, { color: theme.muted }]}>
                Personas que pidieron unirse con el ID del recaudo.
              </Text>
              {accessRequests.length === 0 ? (
                <Text style={[styles.small, { color: theme.muted }]}>
                  No hay solicitudes pendientes.
                </Text>
              ) : (
                accessRequests.map((request) => (
                  <View key={request.id} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: theme.primarySoft }]}>
                      <AppIcon name="person.badge.plus" color={theme.primary} />
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={[styles.memberName, { color: theme.text }]}>{request.name}</Text>
                      <Text style={[styles.small, { color: theme.muted }]}>{request.email}</Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        void rejectAccessRequest(request.id).then(() =>
                          loadAccessRequests(selected.id),
                        )
                      }
                      style={{ marginRight: 8 }}>
                      <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 13 }}>
                        Rechazar
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        void acceptAccessRequest(request.id)
                          .then(() => refresh())
                          .then(() => loadAccessRequests(selected.id))
                      }>
                      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
                        Aceptar
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : (
          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Solo el organizador</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              En un recaudo compartido solo quien lo creó puede invitar a más personas.
            </Text>
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      withTabBar
      title={copy.collections.title}
      subtitle={
        active.length
          ? copy.collections.activeCount(active.length)
          : copy.collections.subtitle
      }
      floating={
        <View pointerEvents="box-none" style={[styles.fabHost, { bottom: fabBottom }]}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Crear recaudo"
            onPress={() => router.push('/add-recaudo')}
            style={[styles.fab, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="plus" color={theme.primary} size={26} />
          </ScalePressable>
        </View>
      }>
      {active.length > 0 ? (
        <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
          <Text style={styles.heroLabel}>{copy.collections.sharedPools}</Text>
          <Text style={styles.heroValue}>{copy.collections.activeCount(active.length)}</Text>
          <Text style={styles.heroHint}>{copy.collections.sharedHint}</Text>
        </Card>
      ) : null}

      <Card style={styles.block}>
        <Text style={[styles.section, { color: theme.text }]}>Unirse con ID</Text>
        <Text style={[styles.hint, { color: theme.muted }]}>
          Si te compartieron el ID de un recaudo, solicítalo aquí.
        </Text>
        {joining ? (
          <>
            <TextInput
              autoFocus
              autoCapitalize="characters"
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="TRXXXXXXXX"
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceSecondary,
                },
              ]}
              onSubmitEditing={() => void onRequestJoin()}
            />
            <View style={styles.joinActions}>
              <Pressable onPress={() => setJoining(false)} disabled={joinBusy}>
                <Text style={{ color: theme.muted, fontWeight: '600' }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={() => void onRequestJoin()} disabled={joinBusy}>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>
                  {joinBusy ? 'Enviando…' : 'Solicitar ingreso'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <PrimaryButton icon="person.badge.plus" onPress={() => setJoining(true)}>
            Unirse con ID
          </PrimaryButton>
        )}
      </Card>

      {!hydrated ? (
        <Text style={[styles.empty, { color: theme.muted }]}>{copy.common.loading}</Text>
      ) : active.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="person.2.fill" color={theme.primary} size={28} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>{copy.collections.createFirst}</Text>
          <Text style={[styles.empty, { color: theme.muted }]}>
            {copy.collections.createFirstHint}
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {active.map((recaudo) => (
            <RecaudoCard key={recaudo.id} recaudo={recaudo} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 0, gap: 5 },
  heroLabel: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroHint: { color: '#FFFFFFCC', fontSize: 12 },
  list: { gap: 12 },
  card: { gap: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 12 },
  amounts: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  amountLabel: { fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  target: { alignItems: 'flex-end' },
  targetAmount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 11 },
  fabHost: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
    zIndex: 20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1D3A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  emptyCard: { alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 4 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  empty: { fontSize: 13, lineHeight: 20, textAlign: 'left', alignSelf: 'stretch' },
  block: { gap: 12, marginTop: 4 },
  listCard: { paddingVertical: 4, gap: 0 },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  section: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  codeBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: { fontSize: 14, fontWeight: '700' },
  small: { fontSize: 12 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    alignItems: 'center',
  },
});
