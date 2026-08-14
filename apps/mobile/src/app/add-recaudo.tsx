import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppDateField } from '@/components/app-date-field';
import { DigitalRailTerms } from '@/components/digital-rail-terms';
import { focusScrollToEnd, FormScrollView } from '@/components/form-scroll-view';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import {
  amountPlaceholder,
  amountToMinorUnits,
  isZeroDecimalCurrency,
  monthlyAmountPlaceholder,
} from '@/lib/currencies';
import {
  DIGITAL_CURRENCY,
  DIGITAL_CURRENCY_DISPLAY,
  DIGITAL_CURRENCY_STORED,
  DIGITAL_MIN_TARGET_MINOR,
  isDigitalCurrency,
  recaudoDisplayCurrency,
} from '@/lib/recaudo-digital-pricing';
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

type FieldKey = 'title' | 'target' | 'monthly' | 'deadline' | 'payout';
type FieldErrors = Partial<Record<FieldKey, boolean>>;
type PayoutMethod = 'digital' | 'personal';

/** Hidden on purpose: re-enable to bring back off-platform personal accounts. */
const PERSONAL_PAYOUT_VISIBLE = false;

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function minorToInput(minor: number, currency: string) {
  const major = minor / 100;
  if (!Number.isFinite(major) || major <= 0) return '';
  if (isZeroDecimalCurrency(currency)) return String(Math.round(major));
  return major.toFixed(2);
}

function deadlineInput(value?: string) {
  if (!value) return '';
  return value.slice(0, 10);
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
  onFocus,
  placeholder,
  currency,
  muted,
  text,
  surfaceSecondary,
  errorStyle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
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
        onFocus={onFocus}
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
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ id?: string }>();
  const createRecaudo = useRecaudosStore((state) => state.createRecaudo);
  const updateRecaudo = useRecaudosStore((state) => state.updateRecaudo);
  const recaudos = useRecaudosStore((state) => state.recaudos);
  const existing = recaudos.find((item) => item.id === params.id);
  const isEditing = Boolean(existing);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<RecaudoCategory>(existing?.category ?? 'travel');
  const [currency, setCurrency] = useState(
    existing?.currency ?? DIGITAL_CURRENCY,
  );
  const [target, setTarget] = useState(
    existing ? minorToInput(existing.targetMinor, existing.currency) : '',
  );
  const [monthly, setMonthly] = useState(
    existing ? minorToInput(existing.monthlyTargetMinor, existing.currency) : '',
  );
  const [deadline, setDeadline] = useState(deadlineInput(existing?.deadline));
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(
    existing?.payoutMethod === 'personal' && PERSONAL_PAYOUT_VISIBLE
      ? 'personal'
      : 'digital',
  );
  const [payoutDetails, setPayoutDetails] = useState(existing?.payoutAccountDetails ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setCategory(existing.category);
    setCurrency(existing.currency);
    setTarget(minorToInput(existing.targetMinor, existing.currency));
    setMonthly(minorToInput(existing.monthlyTargetMinor, existing.currency));
    setDeadline(deadlineInput(existing.deadline));
    setPayoutMethod(
      existing.payoutMethod === 'personal' && PERSONAL_PAYOUT_VISIBLE
        ? 'personal'
        : 'digital',
    );
    setPayoutDetails(existing.payoutAccountDetails ?? '');
  }, [existing?.id]);

  useEffect(() => {
    if (!existing) return;
    if (!existing.isOrganizer) {
      Alert.alert(
        'Solo el organizador',
        'Solo quien organiza el recaudo puede editarlo.',
      );
      safeGoBack(`/(tabs)/recaudo/${existing.id}`);
    }
  }, [existing?.id, existing?.isOrganizer]);

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
    const method: PayoutMethod =
      PERSONAL_PAYOUT_VISIBLE && payoutMethod === 'personal' ? 'personal' : 'digital';
    if (method === 'digital') {
      if (!isDigitalCurrency(currency)) {
        nextErrors.target = true;
        missing.push('recaudo en USDc');
      }
      if (!Number.isSafeInteger(targetMinor) || targetMinor < DIGITAL_MIN_TARGET_MINOR) {
        nextErrors.target = true;
        missing.push('meta de al menos 250 USDc');
      }
    } else if (payoutDetails.trim().length < 8) {
      nextErrors.payout = true;
      missing.push('datos de la cuenta personal');
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
      if (isEditing && existing) {
        if (!existing.isOrganizer) {
          Alert.alert('Solo el organizador', 'Solo quien organiza el recaudo puede editarlo.');
          return;
        }
        await updateRecaudo(existing.id, {
          title: title.trim(),
          category,
          targetMinor,
          monthlyTargetMinor,
          currency: method === 'digital' ? DIGITAL_CURRENCY_STORED : currency,
          deadline: deadline.trim() || undefined,
          payoutMethod: method,
          payoutAccountDetails:
            method === 'personal' ? payoutDetails.trim() : undefined,
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        safeGoBack(`/(tabs)/recaudo/${existing.id}`);
        return;
      }
      const recaudo = await createRecaudo({
        title: title.trim(),
        category,
        targetMinor,
        monthlyTargetMinor,
        currency: method === 'digital' ? DIGITAL_CURRENCY_STORED : currency,
        deadline: deadline.trim() || undefined,
        payoutMethod: method,
        payoutAccountDetails:
          method === 'personal' ? payoutDetails.trim() : undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Cierra la hoja y deja el detalle encima de Recaudos para que "atrás" funcione.
      if (router.canDismiss()) {
        router.dismiss();
      } else {
        router.replace('/(tabs)/recaudos');
      }
      router.push({ pathname: '/(tabs)/recaudo/[id]', params: { id: recaudo.id } });
    } catch (error) {
      Alert.alert(
        isEditing ? 'No se pudo guardar' : 'No se pudo crear',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen heightRatio={0.75} fallback={isEditing && existing ? `/(tabs)/recaudo/${existing.id}` : '/(tabs)/recaudos'}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Cerrar"
            onPress={() =>
              safeGoBack(isEditing && existing ? `/(tabs)/recaudo/${existing.id}` : '/(tabs)/recaudos')
            }
            style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Guardar recaudo' : 'Crear recaudo'}
            disabled={saving}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.65 : 1 }]}>
            <Text style={styles.saveText}>
              {saving ? (isEditing ? 'Guardando…' : 'Creando…') : isEditing ? 'Guardar' : 'Crear'}
            </Text>
          </ScalePressable>
        </View>

        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            {isEditing ? 'Editar recaudo' : 'Nuevo recaudo'}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {isEditing
              ? 'Cambia el nombre, la meta, la fecha o la cuenta donde se guarda el dinero.'
              : 'Crea un recaudo compartido y define cuánto quieren reunir.'}
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
            onFocus={focusScrollToEnd(scrollRef)}
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

          <FieldLabel error={errors.target} color={theme.muted} danger={theme.danger}>
            Objetivo
          </FieldLabel>
          <AmountInput
            value={target}
            onChangeText={(value) => {
              setTarget(value);
              clearError('target');
            }}
            onFocus={focusScrollToEnd(scrollRef, 120)}
            placeholder={amountPlaceholder(currency)}
            currency={recaudoDisplayCurrency(currency)}
            muted={theme.muted}
            text={theme.text}
            surfaceSecondary={theme.surfaceSecondary}
            errorStyle={borderFor('target')}
          />
          {errors.target ? (
            <ErrorText color={theme.danger}>
              {payoutMethod === 'digital'
                ? `La cuenta TecnoWallet pide una meta de al menos 250 ${DIGITAL_CURRENCY_DISPLAY}`
                : 'Indica un objetivo mayor a cero'}
            </ErrorText>
          ) : null}

          <FieldLabel error={errors.monthly} color={theme.muted} danger={theme.danger}>
            Meta mensual (se dividirá entre el número de integrantes)
          </FieldLabel>
          <AmountInput
            value={monthly}
            onChangeText={(value) => {
              setMonthly(value);
              clearError('monthly');
            }}
            onFocus={focusScrollToEnd(scrollRef, 120)}
            placeholder={monthlyAmountPlaceholder(currency)}
            currency={recaudoDisplayCurrency(currency)}
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
          <AppDateField
            value={deadline}
            onChange={(next) => {
              setDeadline(next);
              clearError('deadline');
            }}
            error={errors.deadline}
            placeholder="Elegir fecha"
          />
          {errors.deadline ? (
            <ErrorText color={theme.danger}>Elige una fecha válida</ErrorText>
          ) : null}

          {PERSONAL_PAYOUT_VISIBLE ? (
            <>
              <FieldLabel error={errors.payout} color={theme.muted} danger={theme.danger}>
                Forma de recaudo
              </FieldLabel>
              <Text style={[styles.hint, { color: theme.muted, marginBottom: 0 }]}>
                ¿A dónde quieres guardar el dinero recaudado?
              </Text>
              <View style={styles.payoutRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: payoutMethod === 'digital' }}
                  onPress={() => {
                    setPayoutMethod('digital');
                    setCurrency(DIGITAL_CURRENCY);
                    clearError('payout');
                    clearError('target');
                  }}
                  style={[
                    styles.payoutOption,
                    {
                      borderColor: payoutMethod === 'digital' ? theme.primary : theme.border,
                      backgroundColor:
                        payoutMethod === 'digital' ? theme.primarySoft : theme.surfaceSecondary,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.payoutOptionTitle,
                      { color: payoutMethod === 'digital' ? theme.primary : theme.text },
                    ]}>
                    TecnoWallet
                  </Text>
                  <Text style={[styles.payoutOptionHint, { color: theme.muted }]}>
                    Recaudo en {DIGITAL_CURRENCY_DISPLAY}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: payoutMethod === 'personal' }}
                  onPress={() => {
                    setPayoutMethod('personal');
                    if (isDigitalCurrency(currency)) setCurrency('USD');
                  }}
                  style={[
                    styles.payoutOption,
                    {
                      borderColor: payoutMethod === 'personal' ? theme.primary : theme.border,
                      backgroundColor:
                        payoutMethod === 'personal' ? theme.primarySoft : theme.surfaceSecondary,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.payoutOptionTitle,
                      { color: payoutMethod === 'personal' ? theme.primary : theme.text },
                    ]}>
                    Cuenta personal
                  </Text>
                  <Text style={[styles.payoutOptionHint, { color: theme.muted }]}>
                    Gratis · tu banco
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {payoutMethod === 'digital' ? (
            <DigitalRailTerms />
          ) : PERSONAL_PAYOUT_VISIBLE ? (
            <>
              <TextInput
                value={payoutDetails}
                onChangeText={(value) => {
                  setPayoutDetails(value);
                  clearError('payout');
                }}
                onFocus={focusScrollToEnd(scrollRef, 160)}
                multiline
                textAlignVertical="top"
                placeholder="Ej. Ana Gómez, CC 1.234.567.890, ahorros Bancolombia 01234567890"
                placeholderTextColor={theme.muted}
                style={[
                  styles.input,
                  styles.payoutDetails,
                  { color: theme.text, backgroundColor: theme.surfaceSecondary },
                  borderFor('payout'),
                ]}
              />
              {errors.payout ? (
                <ErrorText color={theme.danger}>
                  Escribe los datos de la cuenta: nombre, documento, tipo y número de cuenta
                </ErrorText>
              ) : null}
            </>
          ) : (
            <DigitalRailTerms />
          )}
        </FormScrollView>
      </View>
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
  amountInput: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  currency: { fontSize: 12, fontWeight: '800', marginRight: 10 },
  amountTextInput: { flex: 1, paddingVertical: 11, fontSize: 16 },
  payoutRow: { flexDirection: 'row', gap: 8 },
  payoutOption: {
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 3,
  },
  payoutOptionTitle: { fontSize: 13, fontWeight: '800' },
  payoutOptionHint: { fontSize: 11, fontWeight: '600' },
  payoutDetails: { minHeight: 96, paddingTop: 12 },
});
