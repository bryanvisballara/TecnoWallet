import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import { isLiquidAccount, isWealthDebt } from '@/lib/accounts';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';

const liquidKinds = ['Cuenta corriente', 'Cuenta de ahorro', 'Efectivo'] as const;

const assetKinds = ['Sin cuenta', 'Inversión'] as const;

const debtKinds = [
  'Tarjeta de crédito',
  'Préstamo personal',
  'Hipoteca',
  'Otro pasivo',
] as const;

const allKinds = [...liquidKinds, ...assetKinds, ...debtKinds] as const;

type FormMode = 'liquid' | 'asset' | 'debt';

const accountIcons = [
  { name: 'house.fill', label: 'Casa' },
  { name: 'creditcard.fill', label: 'Tarjeta' },
  { name: 'building.columns.fill', label: 'Banco' },
  { name: 'banknote.fill', label: 'Efectivo' },
  { name: 'wallet.pass.fill', label: 'Billetera' },
] as const;

const palette = ['#0878F9', '#12B76A', '#F79009', '#7F56D9', '#06AED4', '#F04438', '#EE46BC'];

function resolveMode(
  paramsMode: string | undefined,
  editing: { kind: string; balance: number } | undefined,
): FormMode {
  if (editing) {
    if (isWealthDebt(editing)) return 'debt';
    if (isLiquidAccount(editing.kind)) return 'liquid';
    return 'asset';
  }
  if (paramsMode === 'debt') return 'debt';
  if (paramsMode === 'asset') return 'asset';
  return 'liquid';
}

function resolveKind(value: string | undefined, mode: FormMode): (typeof allKinds)[number] {
  if (value && (allKinds as readonly string[]).includes(value)) {
    return value as (typeof allKinds)[number];
  }
  if (mode === 'debt') return 'Tarjeta de crédito';
  if (mode === 'asset') return 'Sin cuenta';
  return 'Cuenta corriente';
}

export default function AddAccountScreen() {
  const theme = useAppTheme();
  const { ledger, accounts } = useActiveLedger();
  const addAccount = useLedgerStore((state) => state.addAccount);
  const updateAccount = useLedgerStore((state) => state.updateAccount);
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const editing = accounts.find((item) => item.id === params.id);
  const isEditing = Boolean(editing);
  const mode = resolveMode(params.mode, editing);

  const kindOptions =
    mode === 'debt' ? debtKinds : mode === 'asset' ? assetKinds : liquidKinds;
  const defaultIcon =
    mode === 'debt' ? 'creditcard.fill' : mode === 'asset' ? 'house.fill' : 'building.columns.fill';
  const defaultColor = mode === 'debt' ? '#7F56D9' : palette[0];

  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<(typeof allKinds)[number]>(
    resolveKind(editing?.kind, mode),
  );
  const [balance, setBalance] = useState(
    editing
      ? String(mode === 'debt' ? Math.abs(editing.balance) : editing.balance)
      : '',
  );
  const [lastFour, setLastFour] = useState(
    editing && editing.lastFour !== '—' ? editing.lastFour : '',
  );
  const [icon, setIcon] = useState<string>(editing?.icon ?? defaultIcon);
  const [color, setColor] = useState(editing?.color ?? defaultColor);
  const [saving, setSaving] = useState(false);
  const isOffAccount = kind === 'Sin cuenta' || mode === 'asset';

  useEffect(() => {
    if (!editing) return;
    const editMode = resolveMode(undefined, editing);
    setName(editing.name);
    setKind(resolveKind(editing.kind, editMode));
    setBalance(String(editMode === 'debt' ? Math.abs(editing.balance) : editing.balance));
    setLastFour(editing.lastFour !== '—' ? editing.lastFour : '');
    setIcon(editing.icon);
    setColor(editing.color);
  }, [editing?.id]);

  const title = useMemo(() => {
    if (isEditing) {
      if (mode === 'debt') return 'Editar deuda';
      if (mode === 'asset') return 'Editar activo';
      return 'Editar cuenta';
    }
    if (mode === 'debt') return 'Nueva deuda';
    if (mode === 'asset') return 'Nuevo activo';
    return 'Nueva cuenta';
  }, [isEditing, mode]);

  const normalizeBalance = (parsed: number) => {
    if (mode === 'debt') return parsed === 0 ? 0 : -Math.abs(parsed);
    if (mode === 'asset') return Math.abs(parsed);
    return parsed;
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert(
        'Falta el nombre',
        mode === 'debt'
          ? 'Escribe el nombre de la deuda.'
          : mode === 'asset'
            ? 'Escribe el nombre del activo.'
            : 'Escribe cómo se llamará la cuenta.',
      );
      return;
    }
    const parsed = balance.trim() ? Number(balance.replace(',', '.')) : 0;
    if (!Number.isFinite(parsed)) {
      Alert.alert('Monto inválido', 'Indica un número válido o déjalo en 0.');
      return;
    }
    const nextBalance = normalizeBalance(parsed);
    const nextLastFour = isOffAccount ? '' : lastFour;
    setSaving(true);
    try {
      if (editing) {
        await updateAccount(editing.id, {
          name: name.trim(),
          kind,
          balance: nextBalance,
          icon,
          color,
          lastFour: nextLastFour,
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        safeGoBack('/(tabs)/mis-cuentas');
        return;
      }
      const account = await addAccount({
        name: name.trim(),
        kind,
        balance: nextBalance,
        icon,
        color,
        lastFour: nextLastFour,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/(tabs)/account/[id]', params: { id: account.id } });
    } catch {
      Alert.alert(
        isEditing ? 'No se pudo guardar' : 'No se pudo crear',
        'Inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen fallback="/(tabs)/mis-cuentas">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cerrar" onPress={() => safeGoBack('/(tabs)/mis-cuentas')} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            disabled={saving}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
            <Text style={styles.saveText}>{isEditing ? 'Guardar' : 'Crear'}</Text>
          </ScalePressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Libro {ledger.name}
            {mode === 'debt'
              ? ' · Va a Salud financiera (deudas)'
              : mode === 'asset'
                ? ' · Va a Salud financiera (bienes)'
                : ' · Suma a tu liquidez'}
          </Text>

          <Text style={[styles.label, { color: theme.muted }]}>Nombre</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={
              mode === 'debt'
                ? 'Ej. Visa, Préstamo carro'
                : mode === 'asset'
                  ? 'Ej. Casa, carro, terreno'
                  : 'Ej. Cuenta nómina, Ahorros'
            }
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

          <Text style={[styles.label, { color: theme.muted }]}>Tipo</Text>
          <View style={styles.kinds}>
            {kindOptions.map((item) => {
              const selected = kind === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setKind(item);
                    if (item === 'Sin cuenta' && !isEditing) {
                      setIcon('house.fill');
                      setLastFour('');
                    }
                  }}
                  style={[
                    styles.kindChip,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.primarySoft : theme.surfaceSecondary,
                    },
                  ]}>
                  <Text
                    style={{
                      color: selected ? theme.primary : theme.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>
            {mode === 'debt'
              ? 'Monto de la deuda'
              : mode === 'asset'
                ? isEditing
                  ? 'Valor'
                  : 'Valor del activo'
                : isEditing
                  ? 'Saldo'
                  : 'Saldo inicial'}
          </Text>
          <TextInput
            value={balance}
            onChangeText={setBalance}
            keyboardType="decimal-pad"
            placeholder="0"
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
          <Text style={[styles.hint, { color: theme.muted }]}>
            {mode === 'debt'
              ? 'Escribe el monto que debes (se registrará como pasivo).'
              : mode === 'asset'
                ? 'Escribe el valor del activo o el saldo disponible.'
                : 'En deudas puedes usar un monto negativo o crearlas desde Salud financiera.'}
          </Text>

          {isOffAccount ? null : (
            <>
              <Text style={[styles.label, { color: theme.muted }]}>
                Últimos 4 dígitos (opcional)
              </Text>
              <TextInput
                value={lastFour}
                onChangeText={setLastFour}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="••••"
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
            </>
          )}

          <Text style={[styles.label, { color: theme.muted }]}>Icono</Text>
          <View style={styles.icons}>
            {accountIcons.map((item) => {
              const selected = icon === item.name;
              return (
                <Pressable
                  key={item.name}
                  accessibilityLabel={item.label}
                  onPress={() => setIcon(item.name)}
                  style={[
                    styles.iconOption,
                    {
                      backgroundColor: selected ? `${color}22` : theme.surfaceSecondary,
                      borderColor: selected ? color : theme.border,
                    },
                  ]}>
                  <AppIcon name={item.name} color={selected ? color : theme.muted} size={20} />
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>Color</Text>
          <View style={styles.colors}>
            {palette.map((item) => (
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },
  save: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  content: { paddingHorizontal: 18, paddingBottom: 40, gap: 10 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 8 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
