import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { useLedgerStore } from '@/store/ledger';
import {
  isPlusRequiredError,
  plusReasonFromError,
  paywallPlanFromError,
  hasPaidPlan,
  usePlusStore,
} from '@/store/plus';

export default function LedgersScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const ledgers = useLedgerStore((state) => state.ledgers);
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const setActiveLedger = useLedgerStore((state) => state.setActiveLedger);
  const createLedger = useLedgerStore((state) => state.createLedger);
  const deleteLedger = useLedgerStore((state) => state.deleteLedger);
  const inviteMember = useLedgerStore((state) => state.inviteMember);
  const removeMember = useLedgerStore((state) => state.removeMember);
  const renameLedger = useLedgerStore((state) => state.renameLedger);
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
    if (!hasPaidPlan(plusAccess)) {
      openPaywall('SHARING_REQUIRED');
      return;
    }
    try {
      const result = await inviteMember(selected.id, inviteEmail, inviteName);
      const emailed = inviteEmail.trim();
      setInviteEmail('');
      setInviteName('');
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
      subtitle="Crea, cambia y comparte tus libros"
      right={
        <Pressable
          onPress={() => safeGoBack('/(tabs)/mas')}
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
                  safeGoBack('/(tabs)/mas');
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
