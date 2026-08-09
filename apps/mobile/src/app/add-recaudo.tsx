import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import {
  amountPlaceholder,
  amountToMinorUnits,
  currencies,
  currencyLabel,
  monthlyAmountPlaceholder,
} from '@/lib/currencies';
import {
  useRecaudosStore,
  type RecaudoCategory,
} from '@/store/recaudos';

const categories: { value: RecaudoCategory; label: string; icon: string }[] = [
  { value: 'travel', label: 'Viaje', icon: 'airplane' },
  { value: 'gift', label: 'Regalo', icon: 'gift.fill' },
  { value: 'event', label: 'Evento', icon: 'ticket.fill' },
  { value: 'purchase', label: 'Compra', icon: 'cart.fill' },
  { value: 'other', label: 'Otro', icon: 'sparkles' },
];

type FieldKey = 'title' | 'target' | 'monthly' | 'deadline';
type FieldErrors = Partial<Record<FieldKey, boolean>>;

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function FieldLabel({
  children,
  error,
  color,
  danger,
}: {
  children: string;
  error?: boolean;
  color: string;
  danger: string;
}) {
  return (
    <Text style={[styles.label, { color: error ? danger : color }]}>{children}</Text>
  );
}

function ErrorText({ children, color }: { children: string; color: string }) {
  return <Text style={[styles.error, { color }]}>{children}</Text>;
}

function AmountInput({
  value,
  onChangeText,
  placeholder,
  currency,
  muted,
  text,
  surfaceSecondary,
  errorStyle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  currency: string;
  muted: string;
  text: string;
  surfaceSecondary: string;
  errorStyle: { borderColor: string; borderWidth: number };
}) {
  return (
    <View
      style={[
        styles.amountInput,
        { backgroundColor: surfaceSecondary },
        errorStyle,
      ]}>
      <Text style={[styles.currency, { color: muted }]}>{currency}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={muted}
        style={[styles.amountTextInput, { color: text }]}
      />
    </View>
  );
}

export default function AddRecaudoScreen() {
  const theme = useAppTheme();
  const createRecaudo = useRecaudosStore((state) => state.createRecaudo);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RecaudoCategory>('travel');
  const [currency, setCurrency] = useState('USD');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const filteredCurrencies = useMemo(() => {
    const query = currencyQuery.trim().toLowerCase();
    if (!query) return currencies;
    return currencies.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query),
    );
  }, [currencyQuery]);

  const clearError = (key: FieldKey) => {
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const borderFor = (key: FieldKey) => ({
    borderColor: errors[key] ? theme.danger : theme.border,
    borderWidth: errors[key] ? 1.5 : StyleSheet.hairlineWidth,
  });

  const save = async () => {
    const targetMinor = amountToMinorUnits(target, currency);
    const monthlyTargetMinor = amountToMinorUnits(monthly, currency);
    const nextErrors: FieldErrors = {};
    const missing: string[] = [];

    if (!title.trim()) {
      nextErrors.title = true;
      missing.push('nombre');
    }
    if (!Number.isSafeInteger(targetMinor) || targetMinor <= 0) {
      nextErrors.target = true;
      missing.push('objetivo');
    }
    if (!Number.isSafeInteger(monthlyTargetMinor) || monthlyTargetMinor <= 0) {
      nextErrors.monthly = true;
      missing.push('meta mensual');
    }
    if (deadline.trim() && !isValidDate(deadline.trim())) {
      nextErrors.deadline = true;
      missing.push('fecha válida');
    }

    if (missing.length) {
      setErrors(nextErrors);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Revisa los campos',
        `Completa correctamente: ${missing.join(', ')}.`,
      );
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const recaudo = await createRecaudo({
        title: title.trim(),
        category,
        targetMinor,
        monthlyTargetMinor,
        currency,
        deadline: deadline.trim() || undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Cierra la hoja y deja el detalle encima de Recaudos para que "atrás" funcione.
      if (router.canDismiss()) {
        router.dismiss();
      } else {
        router.replace('/(tabs)/recaudos');
      }
      router.push({ pathname: '/recaudo/[id]', params: { id: recaudo.id } });
    } catch (error) {
      Alert.alert(
        'No se pudo crear',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen heightRatio={0.75}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Crear recaudo"
            disabled={saving}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.65 : 1 }]}>
            <Text style={styles.saveText}>{saving ? 'Creando…' : 'Crear'}</Text>
          </ScalePressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>Nuevo recaudo</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Crea un pozo compartido y define cuánto quieren reunir.
          </Text>

          <FieldLabel error={errors.title} color={theme.muted} danger={theme.danger}>
            Nombre
          </FieldLabel>
          <TextInput
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              clearError('title');
            }}
            placeholder="Ej. Viaje de fin de año"
            placeholderTextColor={theme.muted}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.surfaceSecondary },
              borderFor('title'),
            ]}
          />
          {errors.title ? (
            <ErrorText color={theme.danger}>Escribe un nombre</ErrorText>
          ) : null}

          <FieldLabel color={theme.muted} danger={theme.danger}>
            Tipo
          </FieldLabel>
          <View style={styles.categories}>
            {categories.map((item) => {
              const selected = category === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(item.value)}
                  style={[
                    styles.category,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.primarySoft : theme.surfaceSecondary,
                    },
                  ]}>
                  <AppIcon
                    name={item.icon}
                    color={selected ? theme.primary : theme.muted}
                    size={18}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      { color: selected ? theme.primary : theme.text },
                    ]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FieldLabel color={theme.muted} danger={theme.danger}>
            Moneda
          </FieldLabel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Elegir moneda"
            onPress={() => {
              setCurrencyQuery('');
              setCurrencyOpen(true);
            }}
            style={[
              styles.currencyPicker,
              {
                borderColor: theme.border,
                backgroundColor: theme.surfaceSecondary,
              },
            ]}>
            <View style={styles.currencyPickerCopy}>
              <Text style={[styles.currencyCode, { color: theme.text }]}>{currency}</Text>
              <Text style={[styles.currencyName, { color: theme.muted }]}>
                {currencyLabel(currency)}
              </Text>
            </View>
            <AppIcon name="chevron.down" color={theme.muted} size={18} />
          </Pressable>

          <FieldLabel error={errors.target} color={theme.muted} danger={theme.danger}>
            Objetivo
          </FieldLabel>
          <AmountInput
            value={target}
            onChangeText={(value) => {
              setTarget(value);
              clearError('target');
            }}
            placeholder={amountPlaceholder(currency)}
            currency={currency}
            muted={theme.muted}
            text={theme.text}
            surfaceSecondary={theme.surfaceSecondary}
            errorStyle={borderFor('target')}
          />
          {errors.target ? (
            <ErrorText color={theme.danger}>Indica un objetivo mayor a cero</ErrorText>
          ) : null}

          <FieldLabel error={errors.monthly} color={theme.muted} danger={theme.danger}>
            Meta mensual
          </FieldLabel>
          <AmountInput
            value={monthly}
            onChangeText={(value) => {
              setMonthly(value);
              clearError('monthly');
            }}
            placeholder={monthlyAmountPlaceholder(currency)}
            currency={currency}
            muted={theme.muted}
            text={theme.text}
            surfaceSecondary={theme.surfaceSecondary}
            errorStyle={borderFor('monthly')}
          />
          {errors.monthly ? (
            <ErrorText color={theme.danger}>Indica una meta mensual mayor a cero</ErrorText>
          ) : null}

          <FieldLabel error={errors.deadline} color={theme.muted} danger={theme.danger}>
            Fecha objetivo (opcional)
          </FieldLabel>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={deadline}
              onChange={(event) => {
                setDeadline(event.target.value);
                clearError('deadline');
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: `${errors.deadline ? 1.5 : 1}px solid ${
                  errors.deadline ? theme.danger : theme.border
                }`,
                borderRadius: 14,
                padding: '12px 14px',
                fontSize: 15,
                color: theme.text,
                backgroundColor: theme.surfaceSecondary,
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <TextInput
              value={deadline}
              onChangeText={(value) => {
                setDeadline(value);
                clearError('deadline');
              }}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.surfaceSecondary },
                borderFor('deadline'),
              ]}
            />
          )}
          {errors.deadline ? (
            <ErrorText color={theme.danger}>
              Usa una fecha válida en formato AAAA-MM-DD
            </ErrorText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={currencyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCurrencyOpen(false)} />
          <View style={[styles.currencyModal, { backgroundColor: theme.surface }]}>
            <View style={styles.currencyModalHeader}>
              <Text style={[styles.currencyModalTitle, { color: theme.text }]}>
                Elegir moneda
              </Text>
              <Pressable
                accessibilityLabel="Cerrar monedas"
                onPress={() => setCurrencyOpen(false)}
                style={styles.close}>
                <AppIcon name="xmark" color={theme.text} size={20} />
              </Pressable>
            </View>
            <TextInput
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Buscar por código o nombre"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceSecondary,
                  borderColor: theme.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  marginHorizontal: 16,
                },
              ]}
            />
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.currencyList}
              renderItem={({ item }) => {
                const selected = currency === item.code;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setCurrency(item.code);
                      clearError('target');
                      clearError('monthly');
                      setCurrencyOpen(false);
                    }}
                    style={[
                      styles.currencyRow,
                      {
                        backgroundColor: selected
                          ? theme.primarySoft
                          : theme.surface,
                        borderBottomColor: theme.border,
                      },
                    ]}>
                    <View style={styles.currencyPickerCopy}>
                      <Text
                        style={[
                          styles.currencyCode,
                          { color: selected ? theme.primary : theme.text },
                        ]}>
                        {item.code}
                      </Text>
                      <Text style={[styles.currencyName, { color: theme.muted }]}>
                        {item.name}
                      </Text>
                    </View>
                    {selected ? (
                      <AppIcon name="checkmark" color={theme.primary} size={18} />
                    ) : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptyCurrencies, { color: theme.muted }]}>
                  No hay monedas con ese criterio.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { flex: 1 },
  save: {
    minHeight: 38,
    paddingHorizontal: 17,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  content: { paddingHorizontal: 18, paddingBottom: 44, gap: 9 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  error: { fontSize: 11, fontWeight: '600', marginTop: -3 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    minWidth: '30%',
    flexGrow: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryText: { fontSize: 13, fontWeight: '700' },
  currencyPicker: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  currencyPickerCopy: { flex: 1, minWidth: 0, gap: 2 },
  currencyCode: { fontSize: 15, fontWeight: '800' },
  currencyName: { fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  currencyModal: {
    maxHeight: '78%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 18,
    gap: 10,
  },
  currencyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  currencyModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  currencyList: { paddingBottom: 12 },
  currencyRow: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyCurrencies: {
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 13,
  },
  amountInput: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  currency: { fontSize: 12, fontWeight: '800', marginRight: 10 },
  amountTextInput: { flex: 1, paddingVertical: 11, fontSize: 16 },
});
