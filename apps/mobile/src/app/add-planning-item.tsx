import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { focusScrollToEnd, FormScrollView } from '@/components/form-scroll-view';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import type { PlanningBucket } from '@/data/ledgers';
import { displayLedgerName } from '@/i18n/app-copy';
import { useFormsCopy } from '@/i18n/forms-copy';
import { usePaidLedgerGuard } from '@/hooks/use-paid-access-guard';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';

const expenseBuckets: Array<{ id: Exclude<PlanningBucket, 'income'>; labelKey: 'bill' | 'subscription' | 'recurring' }> = [
  { id: 'bill', labelKey: 'bill' },
  { id: 'subscription', labelKey: 'subscription' },
  { id: 'recurring', labelKey: 'recurring' },
];

function resolveCashflow(value: string | undefined): 'income' | 'expense' {
  return value === 'income' ? 'income' : 'expense';
}

function resolveBucket(
  cashflow: 'income' | 'expense',
  value: string | undefined,
): PlanningBucket {
  if (cashflow === 'income') return 'income';
  if (value === 'subscription' || value === 'recurring' || value === 'bill') return value;
  return 'bill';
}

export default function AddPlanningItemScreen() {
  usePaidLedgerGuard();
  const theme = useAppTheme();
  const forms = useFormsCopy();
  const locale = useLanguageStore((state) => state.locale);
  const scrollRef = useRef<ScrollView>(null);
  const { ledger, planning } = useActiveLedger();
  const addPlanningItem = useLedgerStore((state) => state.addPlanningItem);
  const updatePlanningItem = useLedgerStore((state) => state.updatePlanningItem);
  const params = useLocalSearchParams<{
    id?: string;
    cashflow?: string;
    bucket?: string;
  }>();
  const existing = useMemo(
    () => (params.id ? planning.find((item) => item.id === params.id) : undefined),
    [params.id, planning],
  );
  const isEditing = Boolean(existing);
  const cashflow = existing
    ? existing.bucket === 'income'
      ? 'income'
      : 'expense'
    : resolveCashflow(params.cashflow);
  const [bucket, setBucket] = useState<PlanningBucket>(() =>
    existing
      ? existing.bucket
      : resolveBucket(cashflow, params.bucket),
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(
    existing ? String(Math.abs(existing.amount)) : '',
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: boolean; amount?: boolean }>({});

  useEffect(() => {
    if (!existing) return;
    setBucket(existing.bucket);
    setName(existing.name);
    setAmount(String(Math.abs(existing.amount)));
  }, [existing?.id]);

  const title = isEditing
    ? cashflow === 'income'
      ? forms.planning.editIncome
      : forms.planning.editExpense
    : cashflow === 'income'
      ? forms.planning.newIncome
      : forms.planning.newExpense;
  const hint = useMemo(
    () =>
      cashflow === 'income' ? forms.planning.hintIncome : forms.planning.hintExpense,
    [cashflow, forms],
  );
  const placeholder =
    cashflow === 'income' ? forms.planning.phIncome : forms.planning.phExpense;

  const clearError = (key: 'name' | 'amount') => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    const nextErrors: { name?: boolean; amount?: boolean } = {};
    const missing: string[] = [];
    if (!name.trim()) {
      nextErrors.name = true;
      missing.push(forms.planning.fieldName);
    }
    const parsed = Number(amount.replace(',', '.'));
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      nextErrors.amount = true;
      missing.push(forms.planning.fieldAmount);
    }
    if (missing.length > 0) {
      setErrors(nextErrors);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        forms.missingFields,
        missing.length === 1
          ? forms.completeOne(missing[0])
          : forms.completeMany(missing.join(', ')),
      );
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        amount: parsed,
        bucket: cashflow === 'income' ? ('income' as const) : bucket,
      };
      if (existing) {
        await updatePlanningItem(existing.id, payload);
      } else {
        await addPlanningItem(payload);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/(tabs)/salud-financiera');
    } catch {
      Alert.alert(forms.saveFailed, forms.tryAgain);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen heightRatio={0.78} fallback="/(tabs)/salud-financiera">
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={forms.close} onPress={() => safeGoBack('/(tabs)/salud-financiera')} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            disabled={saving}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
            <Text style={styles.saveText}>{forms.save}</Text>
          </ScalePressable>
        </View>

        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {forms.book(displayLedgerName(ledger?.name ?? '', locale))} · {hint}
          </Text>

          {cashflow === 'expense' ? (
            <>
              <Text style={[styles.label, { color: theme.muted }]}>{forms.type}</Text>
              <View style={styles.chips}>
                {expenseBuckets.map((item) => {
                  const active = bucket === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onPress={() => setBucket(item.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? theme.primarySoft : theme.surfaceSecondary,
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}>
                      <Text style={[styles.chipText, { color: active ? theme.primary : theme.text }]}>
                        {forms.planning[item.labelKey]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { color: errors.name ? theme.danger : theme.muted }]}>
            {forms.name}
          </Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              clearError('name');
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.muted}
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.surfaceSecondary,
                borderColor: errors.name ? theme.danger : theme.border,
                borderWidth: errors.name ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
          />

          <Text style={[styles.label, { color: errors.amount ? theme.danger : theme.muted }]}>
            {forms.planning.monthlyAmount}
          </Text>
          <TextInput
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              clearError('amount');
            }}
            onFocus={focusScrollToEnd(scrollRef, 120)}
            placeholder="0"
            placeholderTextColor={theme.muted}
            keyboardType="decimal-pad"
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.surfaceSecondary,
                borderColor: errors.amount ? theme.danger : theme.border,
                borderWidth: errors.amount ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
          />
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
    paddingTop: 10,
    paddingBottom: 4,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { flex: 1 },
  save: {
    minWidth: 88,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
});
