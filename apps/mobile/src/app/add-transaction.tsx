import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppDateField } from '@/components/app-date-field';
import { focusScrollToEnd, FormScrollView } from '@/components/form-scroll-view';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { getActiveMoneyCurrency, money } from '@/data/demo';
import { toDateKey } from '@/data/calendar';
import { displayLedgerName, displayStoredName, useAppCopy } from '@/i18n/app-copy';
import { isLiquidAccount } from '@/lib/accounts';
import {
  defaultNeedWant,
  type NeedWant,
} from '@/lib/need-want';
import { useLanguageStore } from '@/store/language';
import { useAuthStore } from '@/store/auth';
import { useFinanceStore } from '@/store/finance';
import { useActiveLedger } from '@/store/ledger';
import { usePeriodStore } from '@/store/period';
import { usePaidLedgerGuard } from '@/hooks/use-paid-access-guard';

function defaultTransactionDateKey(
  isCurrentMonth: boolean,
  year: number,
  month: number,
) {
  if (isCurrentMonth) return toDateKey(new Date());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(new Date().getDate(), daysInMonth);
  return toDateKey(new Date(year, month, day));
}

function initialTransactionType(raw: string | string[] | undefined): 'expense' | 'income' {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = (value || '').trim().toLowerCase();
  if (
    normalized === 'income' ||
    normalized === 'ingreso' ||
    normalized === 'ingresos'
  ) {
    return 'income';
  }
  return 'expense';
}

export default function AddTransactionScreen() {
  usePaidLedgerGuard();
  const theme = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    accountId?: string;
    envelopeId?: string;
  }>();
  const envelopeIdParam = Array.isArray(params.envelopeId)
    ? params.envelopeId[0]
    : params.envelopeId;
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEditing = Boolean(editId?.trim());
  const locale = useLanguageStore((state) => state.locale);
  const copy = useAppCopy();
  const profile = useAuthStore((state) => state.profile);
  const { accounts, envelopes, ledger } = useActiveLedger();
  const transactions = useFinanceStore((state) => state.transactions);
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);
  const voidTransaction = useFinanceStore((state) => state.voidTransaction);
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const isCurrentMonth = usePeriodStore((state) => state.isCurrentMonth);
  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const existing = useMemo(
    () =>
      isEditing
        ? transactions.find((item) => item.id === editId?.trim())
        : undefined,
    [editId, isEditing, transactions],
  );
  const [type, setType] = useState<'expense' | 'income'>(() => {
    if (existing) return existing.amount >= 0 ? 'income' : 'expense';
    return initialTransactionType(params.type);
  });
  useEffect(() => {
    if (isEditing) return;
    setType(initialTransactionType(params.type));
  }, [isEditing, params.type]);
  const [amount, setAmount] = useState(() =>
    existing ? String(Math.abs(existing.amount)) : '',
  );
  const [title, setTitle] = useState(() => existing?.title ?? '');
  const [envelopeId, setEnvelopeId] = useState(
    () => existing?.envelopeId ?? envelopeIdParam?.trim() ?? '',
  );
  const [accountId, setAccountId] = useState(() => {
    if (existing) {
      const match = liquidAccounts.find((item) => item.name === existing.account);
      if (match) return match.id;
    }
    const fromParam = Array.isArray(params.accountId) ? params.accountId[0] : params.accountId;
    if (fromParam && liquidAccounts.some((item) => item.id === fromParam)) return fromParam;
    return liquidAccounts[0]?.id ?? '';
  });
  const [dateKey, setDateKey] = useState(() => {
    if (existing?.occurredAt) {
      const iso = existing.occurredAt.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
    return defaultTransactionDateKey(isCurrentMonth, year, month);
  });
  const [needWant, setNeedWant] = useState<NeedWant | undefined>(() => {
    if (existing && existing.amount < 0) return existing.needWant;
    if (existing) return undefined;
    if (initialTransactionType(params.type) === 'expense') {
      return defaultNeedWant(ledger);
    }
    return undefined;
  });
  const [note, setNote] = useState(() => existing?.note ?? '');
  const [tags, setTags] = useState(() => (existing?.tags ?? []).join(', '));
  const [recurring, setRecurring] = useState(() => Boolean(existing?.recurring));
  const [receipt, setReceipt] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [hydratedEdit, setHydratedEdit] = useState(!isEditing);

  useEffect(() => {
    if (!isEditing) return;
    if (existing) {
      if (hydratedEdit) return;
      setType(existing.amount >= 0 ? 'income' : 'expense');
      setAmount(String(Math.abs(existing.amount)));
      setTitle(existing.title);
      const matchEnv =
        envelopes.find((item) => item.id === existing.envelopeId) ??
        envelopes.find((item) => item.name === existing.category);
      setEnvelopeId(matchEnv?.id ?? existing.envelopeId ?? '');
      const match = liquidAccounts.find((item) => item.name === existing.account);
      if (match) setAccountId(match.id);
      if (existing.occurredAt) {
        const iso = existing.occurredAt.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) setDateKey(iso);
      }
      setNeedWant(existing.amount < 0 ? existing.needWant : undefined);
      setNote(existing.note ?? '');
      setTags((existing.tags ?? []).join(', '));
      setRecurring(Boolean(existing.recurring));
      setHydratedEdit(true);
      return;
    }
    const timer = setTimeout(() => setHydratedEdit(true), 500);
    return () => clearTimeout(timer);
  }, [existing, envelopes, hydratedEdit, isEditing, liquidAccounts]);

  const notifyUser = (title: string, message: string) => {
    setFormError(message);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const envelopeOptions = useMemo(
    () =>
      envelopes.filter((item) =>
        type === 'income' ? item.kind === 'income' : item.kind === 'expense' || item.kind === 'savings',
      ),
    [envelopes, type],
  );
  const selectedEnvelope = useMemo(
    () => envelopeOptions.find((item) => item.id === envelopeId) ?? envelopeOptions[0],
    [envelopeOptions, envelopeId],
  );
  const selectedAccount = useMemo(
    () => liquidAccounts.find((item) => item.id === accountId) ?? liquidAccounts[0],
    [liquidAccounts, accountId],
  );

  useEffect(() => {
    if (!liquidAccounts.length) {
      setAccountId('');
      return;
    }
    if (!liquidAccounts.some((item) => item.id === accountId)) {
      setAccountId(liquidAccounts[0].id);
    }
  }, [liquidAccounts, accountId]);

  useEffect(() => {
    if (!envelopeOptions.length) {
      setEnvelopeId('');
      return;
    }
    if (envelopeOptions.some((item) => item.id === envelopeId)) return;
    const fromParam = envelopeIdParam?.trim();
    if (fromParam && envelopeOptions.some((item) => item.id === fromParam)) {
      setEnvelopeId(fromParam);
      return;
    }
    setEnvelopeId(envelopeOptions[0].id);
  }, [envelopeOptions, envelopeId, envelopeIdParam]);

  const ledgerLabel = displayLedgerName(ledger?.name ?? copy.ledger.fallback, locale);
  const accountLabel = type === 'income' ? copy.tx.accountIn : copy.tx.accountOut;

  const pickReceipt = async (camera = false) => {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (!result.canceled) setReceipt(result.assets[0]?.uri);
  };

  const submit = async () => {
    if (saving) return;
    setFormError('');
    const parsed = Number(amount.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      notifyUser(copy.tx.missingDataTitle, copy.tx.missingDataBody);
      return;
    }
    if (!selectedEnvelope) {
      notifyUser(
        copy.tx.missingEnvelopeTitle,
        copy.tx.missingEnvelopeBody(
          type === 'income' ? copy.tx.kindIncome : copy.tx.kindExpense,
          displayLedgerName(ledger?.name ?? copy.ledger.fallback, locale),
        ),
      );
      return;
    }
    if (!selectedAccount) {
      notifyUser(
        copy.tx.missingAccountTitle,
        copy.tx.missingAccountBody(displayLedgerName(ledger?.name ?? '', locale)),
      );
      return;
    }
    if (type === 'expense' && !needWant) {
      notifyUser(copy.tx.needWantTitle, copy.tx.needWantBody);
      return;
    }
    setSaving(true);
    try {
      const occurredAt = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
        ? dateKey
        : defaultTransactionDateKey(isCurrentMonth, year, month);
      const payload = {
        title: title.trim(),
        category: selectedEnvelope.name,
        envelopeId: selectedEnvelope.id,
        account: selectedAccount.name,
        amount: type === 'income' ? parsed : -parsed,
        needWant: type === 'expense' ? needWant : undefined,
        note: note.trim() || undefined,
        tags: [
          ...tags
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          ...(receipt ? ['recibo', 'ocr-pendiente'] : []),
        ],
        recurring,
        date: occurredAt,
        createdBy:
          ledger?.type === 'shared' ? profile?.name || undefined : undefined,
      };
      if (isEditing && editId?.trim()) {
        await updateTransaction(editId.trim(), payload);
      } else {
        await addTransaction(payload);
      }
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics unavailable on some web browsers.
      }
      safeGoBack('/(tabs)/movimientos');
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : copy.tx.saveFailedBody;
      notifyUser(copy.tx.saveFailedTitle, message);
    } finally {
      setSaving(false);
    }
  };

  const confirmVoid = () => {
    if (!isEditing || !editId?.trim() || saving) return;
    const run = async () => {
      setSaving(true);
      setFormError('');
      try {
        await voidTransaction(editId.trim());
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // ignore
        }
        safeGoBack('/(tabs)/movimientos');
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : copy.tx.voidFailedBody;
        notifyUser(copy.tx.voidFailedTitle, message);
      } finally {
        setSaving(false);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(copy.tx.voidConfirmBody)) {
        void run();
      }
      return;
    }
    Alert.alert(copy.tx.voidConfirmTitle, copy.tx.voidConfirmBody, [
      { text: copy.common.cancel, style: 'cancel' },
      { text: copy.tx.voidAction, style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <SheetScreen fallback="/(tabs)/movimientos">
      <View style={styles.flex}>
        <View style={styles.header}><Pressable onPress={() => safeGoBack('/(tabs)/movimientos')}><Text style={[styles.cancel, { color: theme.primary }]}>{copy.common.cancel}</Text></Pressable><Text style={[styles.headerTitle, { color: theme.text }]}>{isEditing ? copy.tx.editTitle(ledgerLabel) : copy.tx.newTitle(ledgerLabel)}</Text><View style={styles.headerSpacer} /></View>
        {isEditing && !existing && hydratedEdit ? (
          <View style={styles.content}>
            <Text style={[styles.formError, { color: theme.danger }]}>
              {copy.tx.gone}
            </Text>
            <PrimaryButton onPress={() => safeGoBack('/(tabs)/movimientos')}>
              {copy.common.back}
            </PrimaryButton>
          </View>
        ) : (
        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          {isEditing ? (
            <Text style={[styles.hint, { color: theme.muted, marginBottom: -6 }]}>
              {copy.tx.editHint}
            </Text>
          ) : null}
          <View style={[styles.segmented, { backgroundColor: theme.surfaceSecondary }]}>
            {([['expense', copy.tx.expense], ['income', copy.tx.income]] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => {
                  setType(value);
                  if (value === 'expense' && !isEditing) {
                    setNeedWant((current) => current ?? defaultNeedWant(ledger));
                  }
                }}
                style={[styles.segment, type === value && { backgroundColor: theme.surface }]}>
                <Text style={[styles.segmentText, { color: type === value ? theme.text : theme.muted }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.amountBlock}><Text style={[styles.currency, { color: theme.muted }]}>{(ledger?.baseCurrency || getActiveMoneyCurrency() || 'USD').toUpperCase()}</Text><TextInput value={amount} onChangeText={(value) => { setAmount(value); if (formError) setFormError(''); }} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.border} style={[styles.amountInput, { color: type === 'income' ? theme.success : theme.text }]} accessibilityLabel={copy.tx.amountA11y} /></View>
          <Field label={copy.tx.concept}><TextInput value={title} onChangeText={(value) => { setTitle(value); if (formError) setFormError(''); }} placeholder={copy.tx.conceptPlaceholder} placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></Field>
          <Field
            label={
              type === 'income'
                ? copy.tx.envelopeIncome
                : copy.tx.envelopeExpense
            }>
            {envelopeOptions.length ? (
              <View style={styles.chips}>
                {envelopeOptions.map((item) => {
                  const selected = selectedEnvelope?.id === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setEnvelopeId(item.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? item.color : theme.surface,
                          borderColor: selected ? item.color : theme.border,
                        },
                      ]}>
                      <AppIcon name={item.icon} color={selected ? '#FFFFFF' : item.color} size={20} />
                      <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.muted }]}>
                        {item.kind === 'savings'
                          ? `${displayStoredName(item.name, locale)} · ${copy.tx.savings}`
                          : displayStoredName(item.name, locale)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/add-envelope', params: { kind: type } })
                }
                style={[styles.emptyAccounts, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                <Text style={[styles.accountName, { color: theme.text }]}>
                  {copy.tx.noEnvelopes(
                    type === 'income' ? copy.tx.kindIncome : copy.tx.kindExpense,
                  )}
                </Text>
                <Text style={[styles.accountMeta, { color: theme.muted }]}>
                  {copy.tx.tapToCreateIn(ledgerLabel)}
                </Text>
              </Pressable>
            )}
          </Field>
          {type === 'expense' ? (
            <Field label={copy.tx.expenseType}>
              <View style={styles.chips}>
                {(
                  [
                    { key: 'need' as const, label: copy.tx.need, icon: 'cart.fill' },
                    { key: 'want' as const, label: copy.tx.want, icon: 'heart.fill' },
                  ] as const
                ).map((item) => {
                  const selected = needWant === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected }}
                      onPress={() => setNeedWant(item.key)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? theme.primarySoft : theme.surface,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}>
                      <AppIcon
                        name={item.icon}
                        color={selected ? theme.primary : theme.muted}
                        size={18}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          { color: selected ? theme.primary : theme.muted },
                        ]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: needWant === 'na' }}
                onPress={() =>
                  setNeedWant((current) => (current === 'na' ? undefined : 'na'))
                }
                style={[
                  styles.naRow,
                  {
                    backgroundColor:
                      needWant === 'na' ? theme.primarySoft : theme.surface,
                    borderColor: needWant === 'na' ? theme.primary : theme.border,
                  },
                ]}>
                <AppIcon
                  name={needWant === 'na' ? 'checkmark.circle.fill' : 'circle'}
                  color={needWant === 'na' ? theme.primary : theme.muted}
                  size={22}
                />
                <View style={styles.flex}>
                  <Text style={[styles.accountName, { color: theme.text }]}>
                    {copy.tx.na}
                  </Text>
                  <Text style={[styles.accountMeta, { color: theme.muted }]}>
                    {copy.tx.naHint}
                  </Text>
                </View>
              </Pressable>
            </Field>
          ) : null}
          <Field label={accountLabel}>
            {liquidAccounts.length ? (
              <View style={styles.accountList}>
                {liquidAccounts.map((item) => {
                  const selected = selectedAccount?.id === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={copy.tx.selectAccountA11y(
                        displayStoredName(item.name, locale),
                      )}
                      onPress={() => setAccountId(item.id)}
                      style={[
                        styles.accountOption,
                        {
                          backgroundColor: selected ? theme.primarySoft : theme.surface,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}>
                      <View style={[styles.accountIcon, { backgroundColor: `${item.color}1A` }]}>
                        <AppIcon name={item.icon} color={item.color} size={18} />
                      </View>
                      <View style={styles.accountCopy}>
                        <Text style={[styles.accountName, { color: theme.text }]}>
                          {displayStoredName(item.name, locale)}
                        </Text>
                        <Text style={[styles.accountMeta, { color: theme.muted }]}>
                          {displayStoredName(item.kind, locale)} · {money(item.balance, true)}
                        </Text>
                      </View>
                      {selected ? <AppIcon name="checkmark" color={theme.primary} size={18} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Pressable
                onPress={() => router.push('/(tabs)/mis-cuentas')}
                style={[styles.emptyAccounts, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                <Text style={[styles.accountName, { color: theme.text }]}>
                  {copy.tx.noLiquid}
                </Text>
                <Text style={[styles.accountMeta, { color: theme.muted }]}>
                  {copy.tx.noLiquidHint(ledgerLabel)}
                </Text>
              </Pressable>
            )}
          </Field>
          <Field label={copy.tx.date}>
            <View style={styles.dateBlock}>
              <AppDateField
                value={dateKey}
                onChange={setDateKey}
                placeholder={copy.tx.pickDate}
              />
              <View style={styles.dateChips}>
                {(
                  [
                    {
                      key: toDateKey(new Date()),
                      label: copy.tx.today,
                    },
                    {
                      key: (() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        return toDateKey(d);
                      })(),
                      label: copy.tx.yesterday,
                    },
                  ] as const
                ).map((chip) => {
                  const selected = dateKey === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => setDateKey(chip.key)}
                      style={[
                        styles.dateChip,
                        {
                          backgroundColor: selected
                            ? theme.primarySoft
                            : theme.surfaceSecondary,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}>
                      <Text
                        style={{
                          color: selected ? theme.primary : theme.muted,
                          fontWeight: '700',
                          fontSize: 12,
                        }}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Field>
          <Field label={copy.tx.note}>
            <TextInput
              value={note}
              onChangeText={(value) => {
                setNote(value);
                if (formError) setFormError('');
              }}
              onFocus={focusScrollToEnd(scrollRef, 120)}
              multiline
              placeholder={copy.common.optional}
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                styles.note,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            />
          </Field>
          <Field label={copy.tx.tags}>
            <TextInput
              value={tags}
              onChangeText={(value) => {
                setTags(value);
                if (formError) setFormError('');
              }}
              onFocus={focusScrollToEnd(scrollRef, 120)}
              placeholder={copy.tx.tagsPlaceholder}
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            />
          </Field>
          <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.flex}><Text style={[styles.fieldLabel, { color: theme.text }]}>{copy.tx.recurring}</Text><Text style={[styles.hint, { color: theme.muted }]}>{copy.tx.recurringHint}</Text></View><Switch value={recurring} onValueChange={setRecurring} trackColor={{ true: theme.primary }} /></View>
          <Field label={copy.tx.receipt}><View style={styles.receiptRow}><ScalePressable style={[styles.receiptButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => void pickReceipt(true)}><AppIcon name="camera" color={theme.primary} /><Text style={[styles.receiptText, { color: theme.text }]}>{copy.tx.takePhoto}</Text></ScalePressable><ScalePressable style={[styles.receiptButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => void pickReceipt()}><AppIcon name="photo.fill" color={theme.primary} /><Text style={[styles.receiptText, { color: theme.text }]}>{receipt ? copy.tx.attached : copy.tx.pickPhoto}</Text></ScalePressable></View></Field>
          {formError ? (
            <Text style={[styles.formError, { color: theme.danger }]}>{formError}</Text>
          ) : null}
          <PrimaryButton
            icon="checkmark"
            onPress={saving ? undefined : () => void submit()}>
            {saving
              ? copy.common.loading
              : isEditing
                ? copy.tx.saveChanges
                : copy.tx.saveMovement}
          </PrimaryButton>
          {isEditing ? (
            <Pressable
              disabled={saving}
              onPress={confirmVoid}
              style={[styles.voidButton, { borderColor: theme.danger }]}>
              <Text style={[styles.voidText, { color: theme.danger }]}>
                {copy.tx.voidMovement}
              </Text>
            </Pressable>
          ) : null}
          <Text style={[styles.offline, { color: theme.muted }]}>{copy.tx.offline}</Text>
        </FormScrollView>
        )}
      </View>
    </SheetScreen>
  );
}

function Field({ label, children, style }: PropsWithChildren<{ label: string; style?: object }>) {
  const theme = useAppTheme();
  return <View style={[styles.field, style]}><Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  cancel: { fontSize: 15, fontWeight: '600' }, headerTitle: { fontSize: 17, fontWeight: '700' }, headerSpacer: { width: 62 },
  content: { padding: 18, paddingBottom: 60, gap: 18, width: '100%' },
  segmented: { padding: 4, borderRadius: 14, flexDirection: 'row' }, segment: { flex: 1, minHeight: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.06, shadowRadius: 5 },
  segmentText: { fontSize: 12, fontWeight: '600' }, amountBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  currency: { fontSize: 12, fontWeight: '700', letterSpacing: 1 }, amountInput: { fontSize: 52, fontWeight: '700', minWidth: 200, textAlign: 'center', letterSpacing: -1.5 },
  field: { gap: 8 }, fieldLabel: { fontSize: 13, fontWeight: '600' }, input: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, paddingHorizontal: 14, fontSize: 15 },
  note: { minHeight: 84, paddingTop: 13, textAlignVertical: 'top' },
  chips: { gap: 10, flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: { fontSize: 15, fontWeight: '700' },
  naRow: {
    minHeight: 62,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountList: { gap: 8 },
  accountOption: {
    minHeight: 62,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, gap: 2, minWidth: 0 },
  accountName: { fontSize: 14, fontWeight: '700' },
  accountMeta: { fontSize: 11 },
  emptyAccounts: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  switchRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  hint: { fontSize: 11, marginTop: 3 },
  dateBlock: { gap: 8 },
  dateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  receiptRow: { flexDirection: 'row', gap: 10 }, receiptButton: { flex: 1, minHeight: 72, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 6 },
  receiptText: { fontSize: 12, fontWeight: '600' },
  formError: { fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  voidButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voidText: { fontSize: 14, fontWeight: '700' },
  offline: { textAlign: 'center', fontSize: 11 },
});
