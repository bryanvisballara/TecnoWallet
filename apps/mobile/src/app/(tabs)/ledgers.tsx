import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
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

import { CollaborationInvitesList } from '@/components/collaboration-invites-list';
import { AppIcon, Card, Pill, PrimaryButton, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import {
  acceptAccessRequest,
  listAccessRequests,
  listCollaborationInvites,
  rejectAccessRequest,
  revokeCollaborationInvite,
  type CollaborationAccessRequest,
  type CollaborationResourceInvite,
} from '@/services/collaboration-api';
import { fetchWorkspaceShareCode } from '@/services/ledgers-api';
import { useLedgerStore } from '@/store/ledger';
import {
  isPlusRequiredError,
  plusReasonFromError,
  paywallPlanFromError,
  hasPaidPlan,
  usePlusStore,
} from '@/store/plus';

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

export default function LedgersScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const shareMode = params.tab === 'share';
  const ledgers = useLedgerStore((state) => state.ledgers);
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const setActiveLedger = useLedgerStore((state) => state.setActiveLedger);
  const createLedger = useLedgerStore((state) => state.createLedger);
  const deleteLedger = useLedgerStore((state) => state.deleteLedger);
  const inviteMember = useLedgerStore((state) => state.inviteMember);
  const removeMember = useLedgerStore((state) => state.removeMember);
  const renameLedger = useLedgerStore((state) => state.renameLedger);
  const hydrateLedgers = useLedgerStore((state) => state.hydrate);
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);

  const initialId = params.focus && ledgers.some((item) => item.id === params.focus)
    ? params.focus
    : activeLedgerId;
  const [selectedId, setSelectedId] = useState(initialId);
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [newLedgerName, setNewLedgerName] = useState('');
  const [invites, setInvites] = useState<CollaborationResourceInvite[]>([]);
  const [accessRequests, setAccessRequests] = useState<CollaborationAccessRequest[]>([]);
  const [shareCode, setShareCode] = useState('');
  const [shareCodeLoading, setShareCodeLoading] = useState(false);

  const selected = useMemo(
    () => ledgers.find((item) => item.id === selectedId) ?? ledgers[0],
    [ledgers, selectedId],
  );

  const loadInvites = useCallback(async (resourceId?: string) => {
    if (!resourceId) {
      setInvites([]);
      return;
    }
    try {
      const rows = await listCollaborationInvites({
        resourceType: 'workspace',
        resourceId,
      });
      setInvites(rows);
    } catch {
      setInvites([]);
    }
  }, []);

  const loadAccessRequests = useCallback(async (resourceId?: string) => {
    if (!resourceId) {
      setAccessRequests([]);
      return;
    }
    try {
      const rows = await listAccessRequests(resourceId);
      setAccessRequests(rows);
    } catch {
      setAccessRequests([]);
    }
  }, []);

  useEffect(() => {
    if (selected) setName(selected.name);
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    if (params.focus && ledgers.some((item) => item.id === params.focus)) {
      setSelectedId(params.focus);
    }
  }, [params.focus, ledgers]);

  useEffect(() => {
    void loadInvites(selected?.id);
    void loadAccessRequests(selected?.id);
  }, [selected?.id, loadInvites, loadAccessRequests]);

  useEffect(() => {
    let cancelled = false;
    const ledgerId = selected?.id;
    if (!ledgerId) {
      setShareCode('');
      return;
    }
    const cached = selected.shareCode?.trim().toUpperCase() || '';
    if (cached) {
      setShareCode(cached);
      return;
    }
    setShareCodeLoading(true);
    void fetchWorkspaceShareCode(ledgerId)
      .then((code) => {
        if (!cancelled) setShareCode(code);
      })
      .catch(() => {
        if (!cancelled) setShareCode('');
      })
      .finally(() => {
        if (!cancelled) setShareCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.shareCode]);

  const onInvite = async () => {
    if (!hasPaidPlan(plusAccess)) {
      openPaywall('SHARING_REQUIRED');
      return;
    }
    try {
      const result = await inviteMember(selected.id, inviteEmail, inviteName);
      const emailed = inviteEmail.trim();
      setInviteEmail('');
      setInviteName('');
      await loadInvites(selected.id);
      if (result.pendingSignup) {
        Alert.alert(
          'Correo enviado',
          result.delivered === false
            ? `${emailed} aún no tiene cuenta. Cuando se registre en TecnoWallet, invítala de nuevo al libro.`
            : `Enviamos un correo a ${emailed} para que cree su cuenta. Cuando se registre, invítala de nuevo para agregarla al libro.`,
        );
        return;
      }
      Alert.alert(
        'Invitación lista',
        `Agregamos a ${emailed} al libro y le enviamos un correo con acceso.`,
      );
    } catch (error) {
      if (isPlusRequiredError(error)) {
        openPaywall(plusReasonFromError(error), {
          plan: paywallPlanFromError(error),
        });
        return;
      }
      Alert.alert('No se pudo invitar', error instanceof Error ? error.message : 'Revisa el correo.');
    }
  };

  const onCancelInvite = async (invite: CollaborationResourceInvite) => {
    try {
      await revokeCollaborationInvite(invite.id);
      await loadInvites(selected.id);
    } catch (error) {
      Alert.alert(
        'No se pudo cancelar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    }
  };

  const onRemoveMember = async (memberId: string, memberName: string) => {
    try {
      await removeMember(selected.id, memberId);
      await loadInvites(selected.id);
    } catch (error) {
      Alert.alert(
        `No se pudo quitar a ${memberName}`,
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    }
  };

  const onAcceptRequest = async (request: CollaborationAccessRequest) => {
    try {
      await acceptAccessRequest(request.id);
      await Promise.all([hydrateLedgers(), loadAccessRequests(selected.id), loadInvites(selected.id)]);
      setSelectedId(selected.id);
    } catch (error) {
      if (isPlusRequiredError(error)) {
        openPaywall(plusReasonFromError(error), {
          plan: paywallPlanFromError(error),
        });
        return;
      }
      Alert.alert(
        'No se pudo aceptar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    }
  };

  const onRejectRequest = async (request: CollaborationAccessRequest) => {
    try {
      await rejectAccessRequest(request.id);
      await loadAccessRequests(selected.id);
    } catch (error) {
      Alert.alert(
        'No se pudo rechazar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    }
  };

  const onCreate = async () => {
    if (!newLedgerName.trim()) return;
    if (!hasPaidPlan(plusAccess) && ledgers.length >= 1) {
      openPaywall('BOOK_LIMIT');
      return;
    }
    try {
      const id = await createLedger(newLedgerName.trim());
      setNewLedgerName('');
      setSelectedId(id);
    } catch (error) {
      if (isPlusRequiredError(error)) {
        openPaywall(plusReasonFromError(error), {
          plan: paywallPlanFromError(error),
        });
        return;
      }
      Alert.alert(
        'No se pudo crear el libro',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    }
  };

  const onDelete = () => {
    if (ledgers.length <= 1) {
      Alert.alert('No puedes borrar este libro', 'Debes conservar al menos un libro.');
      return;
    }

    const remove = async () => {
      try {
        const nextActiveId = await deleteLedger(selected.id);
        setSelectedId(nextActiveId);
      } catch (error) {
        Alert.alert(
          'No se pudo borrar',
          error instanceof Error ? error.message : 'Inténtalo nuevamente.',
        );
      }
    };

    const message = `Se borrarán permanentemente todos los movimientos, cuentas y sobres de "${selected.name}".`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${message}\n\n¿Deseas continuar?`)) void remove();
      return;
    }
    Alert.alert('¿Borrar este libro?', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar libro', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  return (
    <Screen
      title="Libros"
      subtitle={
        shareMode
          ? 'Comparte este libro con otras personas'
          : 'Crea, cambia y comparte tus libros'
      }
      right={
        <Pressable
          onPress={() => safeGoBack(shareMode ? '/(tabs)/inicio' : '/(tabs)/mas')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={styles.listCard}>
        {ledgers.map((ledger, index) => {
          const active = ledger.id === selectedId;
          return (
            <ScalePressable
              key={ledger.id}
              onPress={() => setSelectedId(ledger.id)}
              style={[
                styles.ledgerRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                active && { backgroundColor: theme.primarySoft },
              ]}>
              <View style={[styles.ledgerIcon, { backgroundColor: `${ledger.color}22` }]}>
                <AppIcon name={ledger.icon} color={ledger.color} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.ledgerName, { color: theme.text }]}>{ledger.name}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  {ledger.members.length} miembro{ledger.members.length === 1 ? '' : 's'}
                  {ledger.id === activeLedgerId ? ' · Activo' : ''}
                </Text>
              </View>
              {ledger.id === activeLedgerId ? <Pill tone="green">En uso</Pill> : null}
            </ScalePressable>
          );
        })}
      </Card>

      {!shareMode ? (
        <Card style={styles.block}>
          <Text style={[styles.section, { color: theme.text }]}>Nuevo libro</Text>
          <TextInput
            value={newLedgerName}
            onChangeText={setNewLedgerName}
            placeholder="Ej. Viaje, Negocio, Pareja"
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
          />
          <PrimaryButton onPress={() => void onCreate()}>Crear libro</PrimaryButton>
        </Card>
      ) : null}

      {selected ? (
        <>
          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Personas con acceso</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Cada libro puede compartirse con personas distintas. Al cambiar de libro, cambian cuentas, sobres y movimientos.
            </Text>
            {selected.members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: theme.primarySoft }]}>
                  <AppIcon name="person.crop.circle" color={theme.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                  <Text style={[styles.small, { color: theme.muted }]}>
                    {member.email} · {member.role}
                  </Text>
                </View>
                {member.id !== 'me' ? (
                  <Pressable onPress={() => void onRemoveMember(member.id, member.name)}>
                    <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 13 }}>Quitar</Text>
                  </Pressable>
                ) : (
                  <Pill tone="green">Tú</Pill>
                )}
              </View>
            ))}

            <Text style={[styles.label, { color: theme.muted }]}>Invitar por correo</Text>
            <TextInput
              value={inviteName}
              onChangeText={setInviteName}
              placeholder="Nombre (opcional)"
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
            />
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="correo@ejemplo.com"
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
            />
            <PrimaryButton onPress={() => void onInvite()}>Compartir libro</PrimaryButton>
            <CollaborationInvitesList
              invites={invites}
              emptyLabel="Cuando invites a alguien, verás aquí si está pendiente o aceptó."
              onCancelPending={(invite) => void onCancelInvite(invite)}
            />

            <Text style={[styles.label, { color: theme.muted, marginTop: 4 }]}>ID del libro</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Comparte este código para que pidan unirse desde “Unirse con ID”.
            </Text>
            <View style={[styles.codeBox, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
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
                if (ok) Alert.alert('Listo', `ID del libro: ${shareCode}`);
              }}>
              Copiar / compartir ID
            </PrimaryButton>
          </Card>

          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Solicitudes</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Personas que pidieron unirse con el ID del libro.
            </Text>
            {accessRequests.length === 0 ? (
              <Text style={[styles.small, { color: theme.muted }]}>No hay solicitudes pendientes.</Text>
            ) : (
              accessRequests.map((request) => (
                <View key={request.id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, { backgroundColor: theme.primarySoft }]}>
                    <AppIcon name="person.badge.plus" color={theme.primary} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.memberName, { color: theme.text }]}>{request.name}</Text>
                    <Text style={[styles.small, { color: theme.muted }]}>{request.email}</Text>
                  </View>
                  <Pressable onPress={() => void onRejectRequest(request)} style={{ marginRight: 8 }}>
                    <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 13 }}>Rechazar</Text>
                  </Pressable>
                  <Pressable onPress={() => void onAcceptRequest(request)}>
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>Aceptar</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Card>

          <Card style={styles.block}>
            <View style={uiStyles.between}>
              <Text style={[styles.section, { color: theme.text }]}>Ajustes de {selected.name}</Text>
              <Pill tone={selected.type === 'shared' ? 'blue' : 'neutral'}>
                {selected.type === 'shared' ? 'Compartido' : 'Personal'}
              </Pill>
            </View>
            <Text style={[styles.label, { color: theme.muted }]}>Nombre</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
            />
            <PrimaryButton
              onPress={async () => {
                await renameLedger(selected.id, name);
                Alert.alert('Nombre actualizado');
              }}>
              Guardar nombre
            </PrimaryButton>
            {selected.id !== activeLedgerId ? (
              <PrimaryButton
                onPress={async () => {
                  await setActiveLedger(selected.id);
                  safeGoBack(shareMode ? '/(tabs)/inicio' : '/(tabs)/mas');
                }}>
                Usar este libro
              </PrimaryButton>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Borrar libro ${selected.name}`}
              onPress={onDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                {
                  borderColor: theme.danger,
                  backgroundColor: pressed ? `${theme.danger}16` : 'transparent',
                },
              ]}>
              <AppIcon name="trash" color={theme.danger} size={18} />
              <Text style={[styles.deleteLabel, { color: theme.danger }]}>Borrar libro</Text>
            </Pressable>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  listCard: { paddingVertical: 4 },
  ledgerRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  ledgerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  ledgerName: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 11 },
  block: { gap: 12 },
  section: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  codeBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  codeText: { fontSize: 22, fontWeight: '800', letterSpacing: 1.4 },
  deleteButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteLabel: { fontSize: 15, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  memberAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontSize: 14, fontWeight: '700' },
});
