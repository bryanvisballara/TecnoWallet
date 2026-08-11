import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppDateField } from '@/components/app-date-field';
import { focusScrollToEnd, FormScrollView } from '@/components/form-scroll-view';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import { formatDayLabel, parseDateKey, toDateKey } from '@/data/calendar';
import {
  goalPeriodLabels,
  isValidGoalDateKey,
  useGoalsStore,
  type GoalPeriod,
} from '@/store/goals';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';

const periods: GoalPeriod[] = ['week', 'month', 'year', 'date'];
const palette = ['#0878F9', '#12B76A', '#F79009', '#7F56D9', '#06AED4', '#EE46BC'];

type FieldKey = 'title' | 'date' | 'amount';

type FieldErrors = Partial<Record<FieldKey, boolean>>;

export default function AddGoalScreen() {
  const theme = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const locale = useLanguageStore((state) => state.locale);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = typeof params.id === 'string' ? params.id : '';
  const editing = Boolean(editId);
  const { ledger } = useActiveLedger();
  const goals = useGoalsStore((state) => state.goals);
  const addGoal = useGoalsStore((state) => state.addGoal);
  const updateGoal = useGoalsStore((state) => state.updateGoal);
  const linkEnvelope = useGoalsStore((state) => state.linkEnvelope);
  const addEnvelope = useLedgerStore((state) => state.addEnvelope);
  const existing = useMemo(
    () => (editId ? goals.find((item) => item.id === editId) : undefined),
    [editId, goals],
  );

  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('month');
  const [targetDate, setTargetDate] = useState(toDateKey(new Date()));
  const [amount, setAmount] = useState('');
  const [color, setColor] = useState(palette[2]);
  const [withSavingsEnvelope, setWithSavingsEnvelope] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [hydratedEdit, setHydratedEdit] = useState(!editing);

  useEffect(() => {
    if (!editing) {
      setHydratedEdit(true);
      return;
    }
    if (!existing) return;
    setTitle(existing.title);
    setPeriod(existing.period);
    setTargetDate(existing.targetDate || toDateKey(new Date()));
    setAmount(
      existing.targetAmount !== undefined ? String(existing.targetAmount) : '',
    );
    setColor(existing.color || palette[2]);
    setWithSavingsEnvelope(Boolean(existing.envelopeId));
    setHydratedEdit(true);
  }, [editing, existing]);

  const dateLabel = useMemo(() => {
    if (!isValidGoalDateKey(targetDate)) return null;
    return formatDayLabel(parseDateKey(targetDate), locale);
  }, [targetDate, locale]);

  const clearError = (key: FieldKey) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const fieldBorder = (key: FieldKey) =>
    errors[key]
      ? { borderColor: theme.danger, borderWidth: 1.5 }
      : { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth };

  const save = async () => {
    const nextErrors: FieldErrors = {};
    const missing: string[] = [];

    if (!title.trim()) {
      nextErrors.title = true;
      missing.push('nombre de la meta');
    }

    if (period === 'date' && !isValidGoalDateKey(targetDate)) {
      nextErrors.date = true;
      missing.push('fecha objetivo');
    }

    const parsed = amount.trim() ? Number(amount.replace(',', '.')) : undefined;
    const wantsEnvelope = withSavingsEnvelope && !existing?.envelopeId;
    if (wantsEnvelope) {
      if (parsed === undefined || !Number.isFinite(parsed) || parsed <= 0) {
        nextErrors.amount = true;
        missing.push('meta financiera');
      }
    } else if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0)) {
      nextErrors.amount = true;
      missing.push('monto válido');
    }

    if (missing.length > 0) {
      setErrors(nextErrors);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Campos incompletos',
        missing.length === 1
          ? `Debes completar: ${missing[0]}.`
          : `Debes completar los campos faltantes: ${missing.join(', ')}.`,
      );
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      if (editing && editId) {
        await updateGoal(editId, {
          title: title.trim(),
          period,
          targetDate: period === 'date' ? targetDate : undefined,
          targetAmount: parsed,
          color,
        });
      } else {
        const goal = await addGoal({
          title: title.trim(),
          period,
          targetDate: period === 'date' ? targetDate : undefined,
          targetAmount: parsed,
          color,
        });

        if (wantsEnvelope && parsed !== undefined) {
          const ruleLabel =
            period === 'date' && dateLabel
              ? `Ahorro · ${dateLabel}`
              : `Ahorro · ${goalPeriodLabels[period]}`;
          const envelope = await addEnvelope({
            name: title.trim(),
            kind: 'savings',
            budget: parsed,
            icon: 'leaf.fill',
            color,
            rollover: true,
            rule: ruleLabel,
            goalId: goal.id,
          });
          await linkEnvelope(goal.id, envelope.id);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/(tabs)/metas');
    } catch {
      Alert.alert(
        editing ? 'No se pudo guardar' : 'No se pudo crear',
        'Inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (editing && hydratedEdit && !existing) {
    return (
      <SheetScreen fallback="/(tabs)/metas">
        <View style={[styles.flex, styles.missing]}>
          <Text style={[styles.title, { color: theme.text }]}>Meta no encontrada</Text>
          <ScalePressable
            onPress={() => safeGoBack('/(tabs)/metas')}
            style={[styles.save, { backgroundColor: theme.primary }]}>
            <Text style={styles.saveText}>Volver</Text>
          </ScalePressable>
        </View>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen fallback="/(tabs)/metas">
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cerrar" onPress={() => safeGoBack('/(tabs)/metas')} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            disabled={saving || (editing && !hydratedEdit)}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
            <Text style={styles.saveText}>{editing ? 'Guardar' : 'Crear'}</Text>
          </ScalePressable>
        </View>

        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            {editing ? 'Editar meta' : 'Nueva meta'}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>Libro {ledger.name}</Text>

          <Text style={[styles.label, { color: errors.title ? theme.danger : theme.muted }]}>
            ¿Qué quieres lograr?
          </Text>
          <TextInput
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              clearError('title');
            }}
            onFocus={focusScrollToEnd(scrollRef)}
            placeholder="Ej. Viaje a Cartagena"
            placeholderTextColor={theme.muted}
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.surfaceSecondary,
                ...fieldBorder('title'),
              },
            ]}
          />
          {errors.title ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>Completa este campo</Text>
          ) : null}

          <Text style={[styles.label, { color: theme.muted }]}>Plazo</Text>
          <View style={styles.periods}>
            {periods.map((item) => {
              const selected = period === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setPeriod(item);
                    if (item !== 'date') clearError('date');
                  }}
                  style={[
                    styles.periodChip,
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
                    {goalPeriodLabels[item]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {period === 'date' ? (
            <View style={styles.dateBlock}>
              <Text style={[styles.fieldHint, { color: errors.date ? theme.danger : theme.muted }]}>
                Fecha objetivo · p. ej. el día del viaje
              </Text>
              <AppDateField
                value={targetDate}
                minimumDate={editing ? undefined : new Date()}
                error={Boolean(errors.date)}
                placeholder="Toca para elegir en el calendario"
                onChange={(next) => {
                  setTargetDate(next);
                  clearError('date');
                }}
              />
              {errors.date ? (
                <Text style={[styles.errorText, { color: theme.danger }]}>Elige una fecha válida</Text>
              ) : null}
            </View>
          ) : null}

          {existing?.envelopeId ? (
            <View
              style={[
                styles.switchRow,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>Sobre vinculado</Text>
                <Text style={[styles.switchHint, { color: theme.muted }]}>
                  Esta meta ya tiene un sobre de ahorros. Puedes gestionarlo en Sobres.
                </Text>
              </View>
              <AppIcon name="leaf.fill" color={theme.success} size={20} />
            </View>
          ) : (
            <View
              style={[
                styles.switchRow,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}>
              <View style={styles.switchCopy}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>Sobre de ahorros</Text>
                <Text style={[styles.switchHint, { color: theme.muted }]}>
                  Se verá en Sobres. Solo se puede crear desde aquí.
                </Text>
              </View>
              <Switch
                value={withSavingsEnvelope}
                onValueChange={(value) => {
                  setWithSavingsEnvelope(value);
                  if (!value) clearError('amount');
                }}
                trackColor={{ true: theme.primary }}
              />
            </View>
          )}

          <Text style={[styles.label, { color: errors.amount ? theme.danger : theme.muted }]}>
            {withSavingsEnvelope && !existing?.envelopeId
              ? 'Meta financiera'
              : 'Monto objetivo (opcional)'}
          </Text>
          {withSavingsEnvelope && !existing?.envelopeId ? (
            <Text style={[styles.fieldHint, { color: errors.amount ? theme.danger : theme.muted }]}>
              Obligatoria para el sobre de ahorros.
            </Text>
          ) : null}
          <TextInput
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              clearError('amount');
            }}
            onFocus={focusScrollToEnd(scrollRef, 120)}
            keyboardType="decimal-pad"
            placeholder={
              withSavingsEnvelope && !existing?.envelopeId ? 'Ej. 1500' : 'Sin monto'
            }
            placeholderTextColor={theme.muted}
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.surfaceSecondary,
                ...fieldBorder('amount'),
              },
            ]}
          />
          {errors.amount ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {withSavingsEnvelope && !existing?.envelopeId
                ? 'Indica un monto mayor a 0'
                : 'Monto inválido'}
            </Text>
          ) : null}

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
        </FormScrollView>
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { padding: 24, gap: 16, justifyContent: 'center' },
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
  hint: { fontSize: 13, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  fieldHint: { fontSize: 12, lineHeight: 16, marginTop: -4 },
  errorText: { fontSize: 12, fontWeight: '600', marginTop: -4 },
  input: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    minWidth: '22%',
    flexGrow: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dateBlock: { gap: 8 },
  switchRow: {
    marginTop: 10,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchCopy: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 14, fontWeight: '700' },
  switchHint: { fontSize: 12, lineHeight: 16 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
