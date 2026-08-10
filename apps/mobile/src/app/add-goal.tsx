import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useMemo, useState } from 'react';
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
  const locale = useLanguageStore((state) => state.locale);
  const { ledger } = useActiveLedger();
  const addGoal = useGoalsStore((state) => state.addGoal);
  const linkEnvelope = useGoalsStore((state) => state.linkEnvelope);
  const addEnvelope = useLedgerStore((state) => state.addEnvelope);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('month');
  const [targetDate, setTargetDate] = useState(toDateKey(new Date()));
  const [amount, setAmount] = useState('');
  const [color, setColor] = useState(palette[2]);
  const [withSavingsEnvelope, setWithSavingsEnvelope] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

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
    if (withSavingsEnvelope) {
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
      const goal = await addGoal({
        title: title.trim(),
        period,
        targetDate: period === 'date' ? targetDate : undefined,
        targetAmount: parsed,
        color,
      });

      if (withSavingsEnvelope && parsed !== undefined) {
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

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/(tabs)/metas');
    } catch {
      Alert.alert('No se pudo crear', 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen fallback="/(tabs)/metas">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cerrar" onPress={() => safeGoBack('/(tabs)/metas')} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            disabled={saving}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
            <Text style={styles.saveText}>Crear</Text>
          </ScalePressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>Nueva meta</Text>
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
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={targetDate}
                  min={toDateKey(new Date())}
                  onChange={(event) => {
                    setTargetDate(event.target.value);
                    clearError('date');
                  }}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: `${errors.date ? 1.5 : 1}px solid ${errors.date ? theme.danger : theme.border}`,
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
                  value={targetDate}
                  onChangeText={(value) => {
                    setTargetDate(value);
                    clearError('date');
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.surfaceSecondary,
                      ...fieldBorder('date'),
                    },
                  ]}
                />
              )}
              {errors.date ? (
                <Text style={[styles.errorText, { color: theme.danger }]}>Elige una fecha válida</Text>
              ) : dateLabel ? (
                <Text style={[styles.datePreview, { color: theme.primary }]}>{dateLabel}</Text>
              ) : null}
            </View>
          ) : null}

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

          <Text style={[styles.label, { color: errors.amount ? theme.danger : theme.muted }]}>
            {withSavingsEnvelope ? 'Meta financiera' : 'Monto objetivo (opcional)'}
          </Text>
          {withSavingsEnvelope ? (
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
            keyboardType="decimal-pad"
            placeholder={withSavingsEnvelope ? 'Ej. 1500' : 'Sin monto'}
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
              {withSavingsEnvelope ? 'Indica un monto mayor a 0' : 'Monto inválido'}
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
  datePreview: { fontSize: 13, fontWeight: '700' },
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
