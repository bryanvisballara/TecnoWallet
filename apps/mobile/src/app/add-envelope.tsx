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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import {
  isPlusRequiredError,
  plusReasonFromError,
  paywallPlanFromError,
  usePlusStore,
} from '@/store/plus';

const incomeColors = [
  '#12B76A',
  '#0878F9',
  '#06AED4',
  '#7F56D9',
  '#EE46BC',
  '#F79009',
  '#F04438',
  '#F5C518',
  '#0E9384',
  '#6172F3',
  '#9E77ED',
  '#344054',
];
const expenseColors = [
  '#F79009',
  '#0878F9',
  '#F04438',
  '#7F56D9',
  '#EE46BC',
  '#12B76A',
  '#06AED4',
  '#F5C518',
  '#0E9384',
  '#6172F3',
  '#B93815',
  '#344054',
];

const envelopeIcons = [
  { name: 'house.fill', label: 'Casa' },
  { name: 'car.fill', label: 'Carro' },
  { name: 'fuelpump.fill', label: 'Gasolina' },
  { name: 'fork.knife', label: 'Comida' },
  { name: 'cart.fill', label: 'Compras' },
  { name: 'bag.fill', label: 'Tienda' },
  { name: 'cross.case.fill', label: 'Salud' },
  { name: 'figure.run', label: 'Deporte' },
  { name: 'gamecontroller.fill', label: 'Ocio' },
  { name: 'ticket.fill', label: 'Entradas' },
  { name: 'person.2.fill', label: 'Familia' },
  { name: 'heart.fill', label: 'Pareja' },
  { name: 'bolt.fill', label: 'Servicios' },
  { name: 'wifi', label: 'Internet' },
  { name: 'drop.fill', label: 'Agua' },
  { name: 'phone.fill', label: 'Móvil' },
  { name: 'book.fill', label: 'Estudios' },
  { name: 'briefcase.fill', label: 'Trabajo' },
  { name: 'bus.fill', label: 'Transporte' },
  { name: 'airplane', label: 'Viajes' },
  { name: 'pawprint.fill', label: 'Mascotas' },
  { name: 'gift.fill', label: 'Regalos' },
  { name: 'banknote.fill', label: 'Efectivo' },
  { name: 'creditcard.fill', label: 'Tarjeta' },
] as const;

export default function AddEnvelopeScreen() {
  const theme = useAppTheme();
  const { ledger, envelopes } = useActiveLedger();
  const addEnvelope = useLedgerStore((state) => state.addEnvelope);
  const updateEnvelope = useLedgerStore((state) => state.updateEnvelope);
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const editing = envelopes.find((item) => item.id === params.id);
  const kind =
    editing?.kind ??
    (params.kind === 'income' ? 'income' : params.kind === 'savings' ? 'savings' : 'expense');
  const palette = kind === 'income' ? incomeColors : expenseColors;
  const defaultIcon =
    kind === 'income' ? 'briefcase.fill' : kind === 'savings' ? 'leaf.fill' : 'cart.fill';
  const isEditing = Boolean(editing);

  const [name, setName] = useState(editing?.name ?? '');
  const [budget, setBudget] = useState(
    editing && editing.budget > 0 ? String(editing.budget) : '',
  );
  const [color, setColor] = useState(editing?.color ?? palette[0]);
  const [icon, setIcon] = useState<string>(editing?.icon ?? defaultIcon);
  const [rollover, setRollover] = useState(editing?.rollover ?? kind !== 'income');
  const [rule, setRule] = useState(
    editing?.rule ??
      (kind === 'income'
        ? 'Ingreso variable'
        : kind === 'savings'
          ? 'Sobre de ahorros · Meta'
          : 'Según necesidad'),
  );
  const [saving, setSaving] = useState(false);
  const parsedBudget = budget.trim() ? Number(budget.replace(',', '.')) : 0;
  const hasBudget = Number.isFinite(parsedBudget) && parsedBudget > 0;

  useEffect(() => {
    if (!isEditing && kind === 'savings') {
      Alert.alert(
        'Solo desde Metas/Ahorros',
        'Los sobres de ahorros se crean al armar una meta en Finanzas → Metas/Ahorros.',
        [{ text: 'Entendido', onPress: () => safeGoBack('/(tabs)/sobres') }],
      );
    }
  }, [isEditing, kind]);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setBudget(editing.budget > 0 ? String(editing.budget) : '');
    setColor(editing.color);
    setIcon(editing.icon);
    setRollover(editing.rollover);
    setRule(editing.rule);
  }, [editing?.id]);

  const title = useMemo(() => {
    if (kind === 'savings') {
      return isEditing ? 'Editar sobre de ahorros' : 'Sobre de ahorros';
    }
    if (isEditing) {
      return kind === 'income' ? 'Editar sobre de ingresos' : 'Editar sobre de gastos';
    }
    return kind === 'income' ? 'Nuevo sobre de ingresos' : 'Nuevo sobre de gastos';
  }, [isEditing, kind]);

  const save = async () => {
    if (!isEditing && kind === 'savings') {
      Alert.alert(
        'Solo desde Metas/Ahorros',
        'Los sobres de ahorros se crean al armar una meta.',
      );
      return;
    }
    const parsed = budget.trim() ? Number(budget.replace(',', '.')) : 0;
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Escribe cómo se llamará el sobre.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert('Monto inválido', 'Indica un presupuesto o meta válido.');
      return;
    }
    if (
      !isEditing &&
      plusAccess === 'free' &&
      (kind === 'income' || kind === 'expense') &&
      envelopes.filter((item) => item.kind === kind).length >= 5
    ) {
      openPaywall('ENVELOPE_LIMIT');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateEnvelope(editing.id, {
          name: name.trim(),
          budget: parsed,
          icon,
          color,
          rollover: parsed > 0 && rollover,
          rule: rule.trim(),
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        safeGoBack('/(tabs)/sobres');
        return;
      }
      const envelope = await addEnvelope({
        name: name.trim(),
        kind,
        budget: parsed,
        icon,
        color,
        rollover: parsed > 0 && rollover,
        rule: rule.trim(),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/(tabs)/envelope/[id]', params: { id: envelope.id } });
    } catch (error) {
      if (isPlusRequiredError(error)) {
        openPaywall(plusReasonFromError(error), {
          plan: paywallPlanFromError(error),
        });
        return;
      }
      Alert.alert(
        isEditing ? 'No se pudo guardar' : 'No se pudo crear',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen fallback="/(tabs)/sobres">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cerrar" onPress={() => safeGoBack('/(tabs)/sobres')} style={styles.close}>
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
          <Text style={[styles.hint, { color: theme.muted }]}>Libro {ledger.name}</Text>

          <Text style={[styles.label, { color: theme.muted }]}>Nombre</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={
              kind === 'income'
                ? 'Ej. Freelance'
                : kind === 'savings'
                  ? 'Ej. Viaje, emergencia'
                  : 'Ej. Alimentación'
            }
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
          />

          <Text style={[styles.label, { color: theme.muted }]}>
            {kind === 'income'
              ? 'Meta esperada (opcional)'
              : kind === 'savings'
                ? 'Monto objetivo (opcional)'
                : 'Presupuesto (opcional)'}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Déjalo vacío si el monto depende de la actividad o no tiene un límite mensual.
          </Text>
          <TextInput
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            placeholder="Sin presupuesto"
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
          />

          <Text style={[styles.label, { color: theme.muted }]}>Icono</Text>
          <View style={styles.icons}>
            {envelopeIcons.map((item) => {
              const selected = icon === item.name;
              return (
                <Pressable
                  key={item.name}
                  accessibilityRole="button"
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

          {hasBudget ? (
            <View style={[styles.switchRow, { borderColor: theme.border }]}>
              <View style={styles.copy}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>Rollover</Text>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  Acumula el sobrante al siguiente mes
                </Text>
              </View>
              <Switch value={rollover} onValueChange={setRollover} />
            </View>
          ) : null}

          <Text style={[styles.label, { color: theme.muted }]}>Regla (opcional)</Text>
          <TextInput
            value={rule}
            onChangeText={setRule}
            placeholder="Cómo se usa este sobre"
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
          />

          <PrimaryButton onPress={() => void save()}>
            {saving
              ? isEditing
                ? 'Guardando…'
                : 'Creando…'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear sobre'}
          </PrimaryButton>
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
    paddingTop: 8,
    paddingBottom: 4,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },
  save: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colors: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 15, fontWeight: '700' },
});
