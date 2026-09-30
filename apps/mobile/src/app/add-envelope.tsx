import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
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
import { focusScrollToEnd, FormScrollView } from '@/components/form-scroll-view';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { usePaidLedgerGuard } from '@/hooks/use-paid-access-guard';
import { shouldEnforceFreeEnvelopeLimit } from '@/lib/collaboration-roles';
import { guardPaidLedgerAction } from '@/lib/require-paid-access';
import { categoryIcons } from '@/lib/category-icons';
import { displayLedgerName, displayStoredName } from '@/i18n/app-copy';
import { useFormsCopy } from '@/i18n/forms-copy';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
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

export default function AddEnvelopeScreen() {
  usePaidLedgerGuard();
  const theme = useAppTheme();
  const forms = useFormsCopy();
  const locale = useLanguageStore((state) => state.locale);
  const scrollRef = useRef<ScrollView>(null);
  const { ledger, envelopes } = useActiveLedger();
  const addEnvelope = useLedgerStore((state) => state.addEnvelope);
  const updateEnvelope = useLedgerStore((state) => state.updateEnvelope);
  const removeEnvelope = useLedgerStore((state) => state.removeEnvelope);
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
        ? forms.envelope.ruleVariable
        : kind === 'savings'
          ? forms.envelope.ruleSavings
          : forms.envelope.ruleNeed),
  );
  const [saving, setSaving] = useState(false);
  const parsedBudget = budget.trim() ? Number(budget.replace(',', '.')) : 0;
  const hasBudget = Number.isFinite(parsedBudget) && parsedBudget > 0;

  useEffect(() => {
    if (!isEditing && kind === 'savings') {
      Alert.alert(
        forms.envelope.savingsOnlyTitle,
        forms.envelope.savingsOnlyBody,
        [{ text: forms.understood, onPress: () => safeGoBack('/(tabs)/sobres') }],
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
      return isEditing ? forms.envelope.editSavings : forms.envelope.savingsTitle;
    }
    if (isEditing) {
      return kind === 'income' ? forms.envelope.editIncome : forms.envelope.editExpense;
    }
    return kind === 'income' ? forms.envelope.newIncome : forms.envelope.newExpense;
  }, [forms, isEditing, kind]);

  const save = async () => {
    if (!guardPaidLedgerAction('ENVELOPE_LIMIT')) return;
    if (!isEditing && kind === 'savings') {
      Alert.alert(
        forms.envelope.savingsOnlyTitle,
        forms.envelope.savingsOnlyShort,
      );
      return;
    }
    const parsed = budget.trim() ? Number(budget.replace(',', '.')) : 0;
    if (!name.trim()) {
      Alert.alert(forms.missingName, forms.envelope.nameRequired);
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert(forms.invalidAmount, forms.envelope.invalidBudget);
      return;
    }
    // Free 5-envelope limit: personal book owner only. Shared-team / collaborator
    // seats must never open the organizer paywall (it stacks on SheetScreen and freezes).
    if (
      !isEditing &&
      shouldEnforceFreeEnvelopeLimit(ledger) &&
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
        // Collaborators / shared books: explain — do not stack Plus Modal on this sheet.
        if (!shouldEnforceFreeEnvelopeLimit(ledger)) {
          const reason = plusReasonFromError(error);
          Alert.alert(
            reason === 'SHARING_REQUIRED' ? 'Libro sin Plus del organizador' : 'No se pudo crear',
            reason === 'SHARING_REQUIRED'
              ? 'El organizador necesita TecnoWallet Plus activo. Tú no debes pagar por crear sobres en este libro.'
              : 'Pide al organizador que revise el plan del libro. Como colaborador no te corresponde actualizar.',
          );
          return;
        }
        // Dismiss sheet first so the paywall Modal is not stacked (iOS freeze).
        safeGoBack('/(tabs)/sobres');
        setTimeout(() => {
          openPaywall(plusReasonFromError(error), {
            plan: paywallPlanFromError(error),
          });
        }, 280);
        return;
      }
      Alert.alert(
        isEditing ? forms.saveFailed : forms.createFailed,
        error instanceof Error ? error.message : forms.tryAgain,
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert(
      forms.envelope.deleteEnvelope,
      forms.envelope.deleteConfirm(editing.name),
      [
        { text: forms.cancel, style: 'cancel' },
        {
          text: forms.delete,
          style: 'destructive',
          onPress: () => void runDelete(),
        },
      ],
    );
  };

  const runDelete = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await removeEnvelope(editing.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/(tabs)/sobres');
    } catch (error) {
      if (isPlusRequiredError(error)) {
        if (!shouldEnforceFreeEnvelopeLimit(ledger)) {
          Alert.alert(
            'No se pudo eliminar',
            'Pide al organizador que revise el plan del libro. Como colaborador no te corresponde actualizar.',
          );
          return;
        }
        safeGoBack('/(tabs)/sobres');
        setTimeout(() => {
          openPaywall(plusReasonFromError(error), {
            plan: paywallPlanFromError(error),
          });
        }, 280);
        return;
      }
      Alert.alert(
        forms.deleteFailed,
        error instanceof Error ? error.message : forms.tryAgain,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen fallback="/(tabs)/sobres">
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={forms.close} onPress={() => safeGoBack('/(tabs)/sobres')} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            disabled={saving}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
            <Text style={styles.saveText}>{isEditing ? forms.save : forms.create}</Text>
          </ScalePressable>
        </View>

        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {forms.book(displayLedgerName(ledger?.name ?? '—', locale))}
          </Text>

          <Text style={[styles.label, { color: theme.muted }]}>{forms.name}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={
              kind === 'income'
                ? forms.envelope.namePhIncome
                : kind === 'savings'
                  ? forms.envelope.namePhSavings
                  : forms.envelope.namePhExpense
            }
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
          />

          <Text style={[styles.label, { color: theme.muted }]}>
            {kind === 'income'
              ? forms.envelope.expectedOptional
              : kind === 'savings'
                ? forms.envelope.targetOptional
                : forms.envelope.budgetOptional}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {forms.envelope.budgetHint}
          </Text>
          <TextInput
            value={budget}
            onChangeText={setBudget}
            onFocus={focusScrollToEnd(scrollRef, 120)}
            keyboardType="decimal-pad"
            placeholder={forms.envelope.noBudget}
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
          />

          <Text style={[styles.label, { color: theme.muted }]}>{forms.icon}</Text>
          <View style={styles.icons}>
            {categoryIcons.map((item) => {
              const selected = icon === item.name;
              return (
                <Pressable
                  key={item.name}
                  accessibilityRole="button"
                  accessibilityLabel={displayStoredName(item.label, locale)}
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

          <Text style={[styles.label, { color: theme.muted }]}>{forms.color}</Text>
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
                <Text style={[styles.switchTitle, { color: theme.text }]}>{forms.envelope.rollover}</Text>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  {forms.envelope.rolloverHint}
                </Text>
              </View>
              <Switch value={rollover} onValueChange={setRollover} />
            </View>
          ) : null}

          <Text style={[styles.label, { color: theme.muted }]}>{forms.envelope.ruleOptional}</Text>
          <TextInput
            value={rule}
            onChangeText={setRule}
            onFocus={focusScrollToEnd(scrollRef, 120)}
            placeholder={forms.envelope.rulePlaceholder}
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
          />

          <PrimaryButton onPress={() => void save()}>
            {saving
              ? isEditing
                ? forms.envelope.saving
                : forms.envelope.creating
              : isEditing
                ? forms.envelope.saveChanges
                : forms.envelope.createEnvelope}
          </PrimaryButton>

          {isEditing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={forms.envelope.deleteEnvelope}
              disabled={saving}
              onPress={confirmDelete}
              style={[
                styles.deleteBtn,
                { borderColor: theme.danger, opacity: saving ? 0.6 : 1 },
              ]}>
              <AppIcon name="trash" color={theme.danger} size={16} />
              <Text style={[styles.deleteText, { color: theme.danger }]}>{forms.envelope.deleteEnvelope}</Text>
            </Pressable>
          ) : null}
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
  deleteBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: { fontSize: 15, fontWeight: '700' },
});
