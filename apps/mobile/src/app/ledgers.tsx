import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { useLedgerStore } from '@/store/ledger';

export default function LedgersScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const ledgers = useLedgerStore((state) => state.ledgers);
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const setActiveLedger = useLedgerStore((state) => state.setActiveLedger);
  const createLedger = useLedgerStore((state) => state.createLedger);
  const inviteMember = useLedgerStore((state) => state.inviteMember);
  const removeMember = useLedgerStore((state) => state.removeMember);
  const renameLedger = useLedgerStore((state) => state.renameLedger);

  const initialId = params.focus && ledgers.some((item) => item.id === params.focus)
    ? params.focus
    : activeLedgerId;
  const [selectedId, setSelectedId] = useState(initialId);
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [newLedgerName, setNewLedgerName] = useState('');

  const selected = useMemo(
    () => ledgers.find((item) => item.id === selectedId) ?? ledgers[0],
    [ledgers, selectedId],
  );

  useEffect(() => {
    if (selected) setName(selected.name);
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    if (params.focus && ledgers.some((item) => item.id === params.focus)) {
      setSelectedId(params.focus);
    }
  }, [params.focus, ledgers]);

  const onInvite = async () => {
    try {
      await inviteMember(selected.id, inviteEmail, inviteName);
      setInviteEmail('');
      setInviteName('');
      Alert.alert('Invitación lista', `${inviteEmail} podrá ver y editar este libro.`);
    } catch (error) {
      Alert.alert('No se pudo invitar', error instanceof Error ? error.message : 'Revisa el correo.');
    }
  };

  const onCreate = async () => {
    if (!newLedgerName.trim()) return;
    const id = await createLedger(newLedgerName.trim());
    setNewLedgerName('');
    setSelectedId(id);
  };

  return (
    <Screen
      title="Libros"
      subtitle="Crea, cambia y comparte tus libros"
      right={
        <Pressable
          onPress={() => router.back()}
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

      {selected ? (
        <>
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
                  router.back();
                }}>
                Usar este libro
              </PrimaryButton>
            ) : null}
          </Card>

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
                  <Pressable onPress={() => void removeMember(selected.id, member.id)}>
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
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  memberAvatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontSize: 14, fontWeight: '700' },
});
