import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  listCollaborationInvites,
  rejectAccessRequest,
  revokeCollaborationInvite,
  type CollaborationAccessRequest,
  type CollaborationResourceInvite,
} from '@/services/collaboration-api';
import { isSelfOwner } from '@/lib/collaboration-roles';
import { fetchWorkspaceShareCode } from '@/services/ledgers-api';
import {
  useAccessRequestsStore,
  workspaceAccessRequests,
} from '@/store/access-requests';
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

const ledgerIcons = [
  { name: 'house.fill', label: 'Hogar' },
  { name: 'briefcase.fill', label: 'Trabajo' },
  { name: 'wallet.pass.fill', label: 'Billetera' },
  { name: 'heart.fill', label: 'Familia' },
  { name: 'person.2.fill', label: 'Pareja' },
  { name: 'airplane', label: 'Viajes' },
  { name: 'building.columns.fill', label: 'Negocio' },
  { name: 'star.fill', label: 'Favorito' },
  { name: 'leaf.fill', label: 'Ahorro' },
  { name: 'gift.fill', label: 'Regalos' },
  { name: 'car.fill', label: 'Auto' },
  { name: 'sparkles', label: 'Otro' },
] as const;

const ledgerPalette = [
  '#F5C518',
  '#0878F9',
  '#12B76A',
  '#F79009',
  '#7F56D9',
  '#06AED4',
  '#F04438',
  '#EE46BC',
];

export default function LedgersScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const shareMode = params.tab === 'share';
  const ledgers = useLedgerStore((state) => state.ledgers);
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const setActiveLedger = useLedgerStore((state) => state.setActiveLedger);
  const deleteLedger = useLedgerStore((state) => state.deleteLedger);
  const inviteMember = useLedgerStore((state) => state.inviteMember);
  const removeMember = useLedgerStore((state) => state.removeMember);
  const updateLedger = useLedgerStore((state) => state.updateLedger);
  const hydrateLedgers = useLedgerStore((state) => state.hydrate);
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);

  const shareGateDone = useRef(false);
  useEffect(() => {
    if (!shareMode) {
      shareGateDone.current = false;
      return;
    }
    if (shareGateDone.current) return;
    const focused =
      ledgers.find((item) => item.id === (params.focus || activeLedgerId)) ?? ledgers[0];
    if (!focused) return;
    shareGateDone.current = true;
    if (!isSelfOwner(focused.members)) {
      Alert.alert(
        'Solo el organizador',
        'En un libro compartido solo el organizador puede invitar a más personas.',
      );
      safeGoBack('/(tabs)/inicio');
      return;
    }
    if (!hasPaidPlan(plusAccess)) {
      openPaywall('SHARING_REQUIRED');
      safeGoBack('/(tabs)/inicio');
    }
  }, [shareMode, plusAccess, openPaywall, ledgers, params.focus, activeLedgerId]);

  const initialId = params.focus && ledgers.some((item) => item.id === params.focus)
    ? params.focus
    : activeLedgerId;
  const [selectedId, setSelectedId] = useState(initialId);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#F5C518');
  const [icon, setIcon] = useState('house.fill');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invites, setInvites] = useState<CollaborationResourceInvite[]>([]);
  const inbox = useAccessRequestsStore((state) => state.requests);
  const refreshInbox = useAccessRequestsStore((state) => state.refresh);
  const [shareCode, setShareCode] = useState('');
  const [shareCodeLoading, setShareCodeLoading] = useState(false);

  const selected = useMemo(
    () => ledgers.find((item) => item.id === selectedId) ?? ledgers[0],
    [ledgers, selectedId],
  );
  const accessRequests = useMemo(
    () => workspaceAccessRequests(inbox, selected?.id),
    [inbox, selected?.id],
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

  const loadAccessRequests = useCallback(async () => {
    await refreshInbox();
  }, [refreshInbox]);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setColor(selected.color || '#F5C518');
    setIcon(selected.icon || 'house.fill');
  }, [selected?.id, selected?.name, selected?.color, selected?.icon]);

  useEffect(() => {
    if (params.focus && ledgers.some((item) => item.id === params.focus)) {
      setSelectedId(params.focus);
    }
  }, [params.focus, ledgers]);

  useEffect(() => {
    void loadInvites(selected?.id);
    void loadAccessRequests();
  }, [selected?.id, loadInvites, loadAccessRequests]);

  useFocusEffect(
    useCallback(() => {
      void loadAccessRequests();
    }, [loadAccessRequests]),
  );

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
    if (!isSelfOwner(selected?.members)) {
      Alert.alert(
        'Solo el organizador',
        'En un libro compartido solo el organizador puede invitar a más personas.',
      );
      return;
    }
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
      await Promise.all([hydrateLedgers(), loadAccessRequests(), loadInvites(selected.id)]);
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
      await loadAccessRequests();
    } catch (error) {
      Alert.alert(
        'No se pudo rechazar',
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

  if (shareMode && !hasPaidPlan(plusAccess)) {
    return null;
  }

  const visibleIcons = ledgerIcons.some((item) => item.name === icon)
    ? ledgerIcons
    : [{ name: icon, label: 'Actual' }, ...ledgerIcons];
  const visibleColors = ledgerPalette.includes(color) ? ledgerPalette : [color, ...ledgerPalette];

  const settingsCard = selected ? (
    <Card style={styles.block}>
      <View style={uiStyles.between}>
        <Text style={[styles.section, { color: theme.text }]}>Ajustes del libro</Text>
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
      <Text style={[styles.label, { color: theme.muted }]}>Icono</Text>
      <View style={styles.icons}>
        {visibleIcons.map((item) => {
          const selectedIcon = icon === item.name;
          return (
            <Pressable
              key={item.name}
              accessibilityLabel={item.label}
              onPress={() => setIcon(item.name)}
              style={[
                styles.iconOption,
                {
                  backgroundColor: selectedIcon ? `${color}22` : theme.surfaceSecondary,
                  borderColor: selectedIcon ? color : theme.border,
                },
              ]}>
              <AppIcon name={item.name} color={selectedIcon ? color : theme.muted} size={20} />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.label, { color: theme.muted }]}>Color</Text>
      <View style={styles.colors}>
        {visibleColors.map((item) => (
          <Pressable
            key={item}
            onPress={() => setColor(item)}
            style={[
              styles.swatch,
              { backgroundColor: item },
              color === item && { borderColor: theme.text, borderWidth: 2 },
            ]}
          />
        ))}
      </View>
      <PrimaryButton
        onPress={async () => {
          try {
            await updateLedger(selected.id, { name, color, icon });
            Alert.alert('Listo', 'Se guardaron los ajustes del libro.');
          } catch (error) {
            Alert.alert(
              'No se pudo guardar',
              error instanceof Error ? error.message : 'Inténtalo de nuevo.',
            );
          }
        }}>
        Guardar
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
  ) : null;

  return (
    <Screen
      title="Libros"
      subtitle={
        shareMode
          ? 'Comparte este libro con otras personas'
          : 'Cambia y comparte tus libros'
      }
      right={
        <Pressable
          onPress={() => safeGoBack(shareMode ? '/(tabs)/inicio' : '/(tabs)/mas')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      {shareMode ? null : settingsCard}

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
                {member.id === 'me' ? (
                  <Pill tone="green">Tú</Pill>
                ) : member.role !== 'owner' ? (
                  <Pressable onPress={() => void onRemoveMember(member.id, member.name)}>
                    <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 13 }}>Quitar</Text>
                  </Pressable>
                ) : null}
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

          {shareMode ? settingsCard : null}
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
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
