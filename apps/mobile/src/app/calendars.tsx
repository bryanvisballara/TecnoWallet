import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import {
  useCalendarStore,
  type CalendarMemberRole,
} from '@/store/calendar';

const roleLabels: Record<CalendarMemberRole, string> = {
  owner: 'Propietario',
  editor: 'Puede editar',
  viewer: 'Solo ver',
};

export default function CalendarsScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const calendars = useCalendarStore((state) => state.calendars);
  const activeCalendarId = useCalendarStore((state) => state.activeCalendarId);
  const setActiveCalendar = useCalendarStore((state) => state.setActiveCalendar);
  const createCalendar = useCalendarStore((state) => state.createCalendar);
  const inviteMember = useCalendarStore((state) => state.inviteMember);
  const removeMember = useCalendarStore((state) => state.removeMember);
  const renameCalendar = useCalendarStore((state) => state.renameCalendar);

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

  const selected = useMemo(
    () => calendars.find((item) => item.id === selectedId) ?? calendars[0],
    [calendars, selectedId],
  );

  useEffect(() => {
    if (selected) setName(selected.name);
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    if (params.focus && calendars.some((item) => item.id === params.focus)) {
      setSelectedId(params.focus);
    }
  }, [params.focus, calendars]);

  const onInvite = async () => {
    try {
      await inviteMember(selected.id, inviteEmail, inviteRole, inviteName);
      setInviteEmail('');
      setInviteName('');
      Alert.alert(
        'Invitación lista',
        inviteRole === 'editor'
          ? `Enviamos un correo a ${inviteEmail}. Podrá ver y editar este calendario.`
          : `Enviamos un correo a ${inviteEmail}. Podrá ver este calendario (sin editar).`,
      );
    } catch (error) {
      Alert.alert(
        'No se pudo invitar',
        error instanceof Error ? error.message : 'Revisa el correo.',
      );
    }
  };

  const onCreate = async () => {
    if (!newCalendarName.trim()) return;
    const id = await createCalendar(newCalendarName.trim());
    setNewCalendarName('');
    setSelectedId(id);
  };

  return (
    <Screen
      title="Calendarios"
      subtitle="Nombra, cambia e invita a ver o editar"
      right={
        <Pressable
          onPress={() => router.back()}
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

      {selected ? (
        <>
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
                  router.back();
                }}>
                Usar este calendario
              </PrimaryButton>
            ) : null}
          </Card>

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
                {member.id !== 'me' ? (
                  <Pressable onPress={() => void removeMember(selected.id, member.id)}>
                    <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 13 }}>
                      Quitar
                    </Text>
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
