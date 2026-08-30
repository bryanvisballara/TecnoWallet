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
import { fetchCalendarShareCode } from '@/services/calendar-api';
import {
  acceptAccessRequest,
  listCollaborationInvites,
  rejectAccessRequest,
  revokeCollaborationInvite,
  type CollaborationAccessRequest,
  type CollaborationResourceInvite,
} from '@/services/collaboration-api';
import { isSelfOwner } from '@/lib/collaboration-roles';
import {
  calendarAccessRequests,
  useAccessRequestsStore,
} from '@/store/access-requests';
import {
  useCalendarStore,
  type CalendarMemberRole,
} from '@/store/calendar';
import {
  hasPaidPlan,
  isPlusRequiredError,
  paywallPlanFromError,
  plusReasonFromError,
  usePlusStore,
} from '@/store/plus';

const roleLabels: Record<CalendarMemberRole, string> = {
  owner: 'Propietario',
  editor: 'Puede editar',
  viewer: 'Solo ver',
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

export default function CalendarsScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const shareMode = params.tab === 'share';
  const calendars = useCalendarStore((state) => state.calendars);
  const activeCalendarId = useCalendarStore((state) => state.activeCalendarId);
  const setActiveCalendar = useCalendarStore((state) => state.setActiveCalendar);
  const createCalendar = useCalendarStore((state) => state.createCalendar);
  const inviteMember = useCalendarStore((state) => state.inviteMember);
  const removeMember = useCalendarStore((state) => state.removeMember);
  const renameCalendar = useCalendarStore((state) => state.renameCalendar);
  const hydrateCalendars = useCalendarStore((state) => state.hydrate);
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
      calendars.find((item) => item.id === (params.focus || activeCalendarId)) ??
      calendars[0];
    if (!focused) return;
    shareGateDone.current = true;
    if (!isSelfOwner(focused.members)) {
      Alert.alert(
        'Solo el organizador',
        'En un calendario compartido solo el organizador puede invitar a más personas.',
      );
      safeGoBack('/(tabs)/calendario');
      return;
    }
    if (!hasPaidPlan(plusAccess)) {
      openPaywall('SHARING_REQUIRED');
      safeGoBack('/(tabs)/calendario');
    }
  }, [shareMode, plusAccess, openPaywall, calendars, params.focus, activeCalendarId]);

  const initialId =
    params.focus && calendars.some((item) => item.id === params.focus)
      ? params.focus
      : activeCalendarId;
  const [selectedId, setSelectedId] = useState(initialId);
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [newCalendarName, setNewCalendarName] = useState('');
  const [invites, setInvites] = useState<CollaborationResourceInvite[]>([]);
  const inbox = useAccessRequestsStore((state) => state.requests);
  const refreshInbox = useAccessRequestsStore((state) => state.refresh);
  const accessRequests = useMemo(() => calendarAccessRequests(inbox), [inbox]);
  const [shareCode, setShareCode] = useState('');
  const [shareCodeLoading, setShareCodeLoading] = useState(false);

  const selected = useMemo(
    () => calendars.find((item) => item.id === selectedId) ?? calendars[0],
    [calendars, selectedId],
  );

  const loadInvites = useCallback(async (resourceId?: string) => {
    if (!resourceId) {
      setInvites([]);
      return;
    }
    try {
      const rows = await listCollaborationInvites({
        resourceType: 'calendar',
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
    if (selected) setName(selected.name);
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    if (params.focus && calendars.some((item) => item.id === params.focus)) {
      setSelectedId(params.focus);
    }
  }, [params.focus, calendars]);

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
    if (params.tab === 'share' || params.focus) {
      void loadAccessRequests();
    }
  }, [params.tab, params.focus, loadAccessRequests]);

  useEffect(() => {
    let cancelled = false;
    const calendarId = selected?.id;
    if (!calendarId) {
      setShareCode('');
      return;
    }
    setShareCodeLoading(true);
    void fetchCalendarShareCode(calendarId)
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
  }, [selected?.id]);

  const onInvite = async () => {
    if (!isSelfOwner(selected?.members)) {
      Alert.alert(
        'Solo el organizador',
        'En un calendario compartido solo el organizador puede invitar a más personas.',
      );
      return;
    }
    if (!hasPaidPlan(plusAccess)) {
      openPaywall('SHARING_REQUIRED');
      return;
    }
    try {
      // Collaborators always get full edit access (invite-only stays owner-gated).
      await inviteMember(selected.id, inviteEmail, 'editor', inviteName);
      setInviteEmail('');
      setInviteName('');
      await loadInvites(selected.id);
      Alert.alert(
        'Invitación lista',
        `Enviamos un correo a ${inviteEmail}. Podrá ver y editar este calendario.`,
      );
    } catch (error) {
      if (isPlusRequiredError(error)) {
        openPaywall(plusReasonFromError(error), {
          plan: paywallPlanFromError(error),
        });
        return;
      }
      Alert.alert(
        'No se pudo invitar',
        error instanceof Error ? error.message : 'Revisa el correo.',
      );
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

  const onAcceptRequest = async (request: CollaborationAccessRequest) => {
    try {
      await acceptAccessRequest(request.id);
      if (request.calendarId) {
        setSelectedId(request.calendarId);
      }
      await Promise.all([
        hydrateCalendars(),
        loadAccessRequests(),
        loadInvites(request.calendarId || selected.id),
      ]);
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

  const onCreate = async () => {
    if (!newCalendarName.trim()) return;
    const id = await createCalendar(newCalendarName.trim());
    setNewCalendarName('');
    setSelectedId(id);
  };

  if (shareMode && !hasPaidPlan(plusAccess)) {
    return null;
  }

  return (
    <Screen
      title="Calendarios"
      subtitle={
        shareMode
          ? 'Comparte este calendario con otras personas'
          : 'Nombra, cambia e invita a ver o editar'
      }
      right={
        <Pressable
          onPress={() => safeGoBack('/(tabs)/calendario')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={styles.listCard}>
        {calendars.map((calendar, index) => {
          const active = calendar.id === selectedId;
          return (
            <ScalePressable
              key={calendar.id}
              onPress={() => setSelectedId(calendar.id)}
              style={[
                styles.calendarRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                },
                active && { backgroundColor: theme.primarySoft },
              ]}>
              <View style={[styles.calendarIcon, { backgroundColor: `${calendar.color}22` }]}>
                <AppIcon name={calendar.icon} color={calendar.color} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.calendarName, { color: theme.text }]}>{calendar.name}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  {calendar.members.length} miembro
                  {calendar.members.length === 1 ? '' : 's'}
                  {calendar.id === activeCalendarId ? ' · Activo' : ''}
                </Text>
              </View>
              {calendar.id === activeCalendarId ? <Pill tone="green">En uso</Pill> : null}
            </ScalePressable>
          );
        })}
      </Card>

      {!shareMode ? (
        <Card style={styles.block}>
          <Text style={[styles.section, { color: theme.text }]}>Nuevo calendario</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Útil si gestionas el tuyo y el de otra persona (por ejemplo, como asistente).
          </Text>
          <TextInput
            value={newCalendarName}
            onChangeText={setNewCalendarName}
            placeholder="Ej. Personal, Calendario de Ana"
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
          <PrimaryButton onPress={() => void onCreate()}>Crear calendario</PrimaryButton>
        </Card>
      ) : null}

      {selected ? (
        <>
          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Personas con acceso</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Invita a ver el calendario o a editar eventos y tareas. Cada calendario tiene su
              propia lista de personas.
            </Text>
            {selected.members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: theme.primarySoft }]}>
                  <AppIcon name="person.crop.circle" color={theme.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                  <Text style={[styles.small, { color: theme.muted }]}>
                    {member.email} · {roleLabels[member.role]}
                  </Text>
                </View>
                {member.id === 'me' ? (
                  <Pill tone="green">Tú</Pill>
                ) : member.role !== 'owner' ? (
                  <Pressable onPress={() => void removeMember(selected.id, member.id)}>
                    <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 13 }}>
                      Quitar
                    </Text>
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
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceSecondary,
                },
              ]}
            />
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="correo@ejemplo.com"
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
            <View style={styles.roleRow}>
              <Pressable
                onPress={() => setInviteRole('editor')}
                style={[
                  styles.roleChip,
                  {
                    borderColor: inviteRole === 'editor' ? theme.primary : theme.border,
                    backgroundColor:
                      inviteRole === 'editor' ? theme.primarySoft : theme.surfaceSecondary,
                  },
                ]}>
                <Text
                  style={{
                    color: inviteRole === 'editor' ? theme.primary : theme.text,
                    fontWeight: '700',
                    fontSize: 13,
                  }}>
                  Puede editar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setInviteRole('viewer')}
                style={[
                  styles.roleChip,
                  {
                    borderColor: inviteRole === 'viewer' ? theme.primary : theme.border,
                    backgroundColor:
                      inviteRole === 'viewer' ? theme.primarySoft : theme.surfaceSecondary,
                  },
                ]}>
                <Text
                  style={{
                    color: inviteRole === 'viewer' ? theme.primary : theme.text,
                    fontWeight: '700',
                    fontSize: 13,
                  }}>
                  Solo ver
                </Text>
              </Pressable>
            </View>
            <PrimaryButton onPress={() => void onInvite()}>Invitar al calendario</PrimaryButton>
            <CollaborationInvitesList
              invites={invites}
              emptyLabel="Cuando invites a alguien, verás aquí si está pendiente o aceptó."
              onCancelPending={(invite) => void onCancelInvite(invite)}
            />

            <Text style={[styles.label, { color: theme.muted, marginTop: 4 }]}>
              ID del calendario
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
                if (ok) Alert.alert('Listo', `ID del calendario: ${shareCode}`);
              }}>
              Copiar / compartir ID
            </PrimaryButton>
          </Card>

          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Solicitudes</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Personas que pidieron unirse con el ID de tus calendarios.
            </Text>
            {accessRequests.length === 0 ? (
              <Text style={[styles.small, { color: theme.muted }]}>
                No hay solicitudes pendientes.
              </Text>
            ) : (
              accessRequests.map((request) => {
                const forOther =
                  Boolean(request.calendarId) && request.calendarId !== selected.id;
                const calendarName =
                  request.calendarName ||
                  calendars.find((item) => item.id === request.calendarId)?.name ||
                  'Calendario';
                return (
                  <View key={request.id} style={styles.memberRow}>
                    <View style={[styles.memberAvatar, { backgroundColor: theme.primarySoft }]}>
                      <AppIcon name="person.badge.plus" color={theme.primary} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.memberName, { color: theme.text }]}>
                        {request.name}
                      </Text>
                      <Text style={[styles.small, { color: theme.muted }]}>
                        {request.email}
                        {forOther ? ` · ${calendarName}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void onRejectRequest(request)}
                      style={{ marginRight: 8 }}>
                      <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 13 }}>
                        Rechazar
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => void onAcceptRequest(request)}>
                      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
                        Aceptar
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </Card>

          <Card style={styles.block}>
            <View style={uiStyles.between}>
              <Text style={[styles.section, { color: theme.text }]}>
                Ajustes de {selected.name}
              </Text>
              <Pill tone={selected.members.length > 1 ? 'blue' : 'neutral'}>
                {selected.members.length > 1 ? 'Compartido' : 'Personal'}
              </Pill>
            </View>
            <Text style={[styles.label, { color: theme.muted }]}>Nombre</Text>
            <TextInput
              value={name}
              onChangeText={setName}
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
              onPress={async () => {
                await renameCalendar(selected.id, name);
                Alert.alert('Nombre actualizado');
              }}>
              Guardar nombre
            </PrimaryButton>
            {selected.id !== activeCalendarId ? (
              <PrimaryButton
                onPress={async () => {
                  await setActiveCalendar(selected.id);
                  safeGoBack('/(tabs)/calendario');
                }}>
                Usar este calendario
              </PrimaryButton>
            ) : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  listCard: { paddingVertical: 4 },
  calendarRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  calendarIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  calendarName: { fontSize: 15, fontWeight: '700' },
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
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: { fontSize: 14, fontWeight: '700' },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
