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
import { isLiquidAccount } from '@/lib/accounts';
import { useLanguageStore } from '@/store/language';
import { useAuthStore } from '@/store/auth';
import { useFinanceStore } from '@/store/finance';
import { useActiveLedger } from '@/store/ledger';
import { usePeriodStore } from '@/store/period';

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
  const theme = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEditing = Boolean(editId?.trim());
  const locale = useLanguageStore((state) => state.locale);
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
  const [envelopeId, setEnvelopeId] = useState(() => existing?.envelopeId ?? '');
  const [accountId, setAccountId] = useState(() => {
    if (existing) {
      const match = liquidAccounts.find((item) => item.name === existing.account);
      if (match) return match.id;
    }
    return liquidAccounts[0]?.id ?? '';
  });
  const [dateKey, setDateKey] = useState(() => {
    if (existing?.occurredAt) {
      const iso = existing.occurredAt.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
    return defaultTransactionDateKey(isCurrentMonth, year, month);
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
    if (!envelopeOptions.some((item) => item.id === envelopeId)) {
      setEnvelopeId(envelopeOptions[0].id);
    }
  }, [envelopeOptions, envelopeId]);

  const accountLabel =
    type === 'income' ? '¿A qué cuenta ingresó?' : '¿De qué cuenta salió?';

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
      notifyUser('Faltan datos', 'Agrega un concepto y un importe válido.');
      return;
    }
    if (!selectedEnvelope) {
      notifyUser(
        'Falta un sobre',
        `Crea un sobre de ${type === 'income' ? 'ingresos' : 'gastos'} en ${ledger?.name ?? 'este libro'} para clasificar este movimiento.`,
      );
      return;
    }
    if (!selectedAccount) {
      notifyUser(
        'Falta una cuenta',
        `Crea una cuenta en el libro ${ledger?.name ?? ''} para registrar este movimiento.`,
      );
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
        account: selectedAccount.name,
        amount: type === 'income' ? parsed : -parsed,
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
          : 'No se pudo guardar el movimiento. Inténtalo de nuevo.';
      notifyUser('No se pudo guardar', message);
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
            : 'No se pudo anular el movimiento.';
        notifyUser('No se pudo anular', message);
      } finally {
        setSaving(false);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('¿Anular este movimiento? Se quitará del libro.')) {
        void run();
      }
      return;
    }
    Alert.alert('Anular movimiento', 'Se quitará del libro. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Anular', style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <SheetScreen fallback="/(tabs)/movimientos">
      <View style={styles.flex}>
        <View style={styles.header}><Pressable onPress={() => safeGoBack('/(tabs)/movimientos')}><Text style={[styles.cancel, { color: theme.primary }]}>Cancelar</Text></Pressable><Text style={[styles.headerTitle, { color: theme.text }]}>{isEditing ? 'Editar' : 'Nuevo'} · {ledger.name}</Text><View style={styles.headerSpacer} /></View>
        {isEditing && !existing && hydratedEdit ? (
          <View style={styles.content}>
            <Text style={[styles.formError, { color: theme.danger }]}>
              Este movimiento ya no está disponible (puede haberse anulado).
            </Text>
            <PrimaryButton onPress={() => safeGoBack('/(tabs)/movimientos')}>
              Volver
            </PrimaryButton>
          </View>
        ) : (
        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          {isEditing ? (
            <Text style={[styles.hint, { color: theme.muted, marginBottom: -6 }]}>
              Al guardar se corrige el movimiento original en el libro.
            </Text>
          ) : null}
          <View style={[styles.segmented, { backgroundColor: theme.surfaceSecondary }]}>
            {([['expense', 'Gasto'], ['income', 'Ingreso']] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => setType(value)} style={[styles.segment, type === value && { backgroundColor: theme.surface }]}>
                <Text style={[styles.segmentText, { color: type === value ? theme.text : theme.muted }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.amountBlock}><Text style={[styles.currency, { color: theme.muted }]}>{(ledger?.baseCurrency || getActiveMoneyCurrency() || 'COP').toUpperCase()}</Text><TextInput value={amount} onChangeText={(value) => { setAmount(value); if (formError) setFormError(''); }} onFocus={focusScrollToEnd(scrollRef, 120)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.border} style={[styles.amountInput, { color: type === 'income' ? theme.success : theme.text }]} accessibilityLabel="Importe" /></View>
          <Field label="Concepto"><TextInput value={title} onChangeText={(value) => { setTitle(value); if (formError) setFormError(''); }} onFocus={focusScrollToEnd(scrollRef)} placeholder="¿En qué fue?" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></Field>
          <Field
            label={
              type === 'income'
                ? 'Sobre de ingresos'
                : 'Sobre de gastos o ahorros'
            }>
            {envelopeOptions.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
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
                      <AppIcon name={item.icon} color={selected ? '#FFFFFF' : item.color} size={14} />
                      <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.muted }]}>
                        {item.kind === 'savings' ? `${item.name} · ahorro` : item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/add-envelope', params: { kind: type } })
                }
                style={[styles.emptyAccounts, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                <Text style={[styles.accountName, { color: theme.text }]}>
                  No hay sobres de {type === 'income' ? 'ingresos' : 'gastos'}
                </Text>
                <Text style={[styles.accountMeta, { color: theme.muted }]}>
                  Toca para crear uno en {ledger.name}.
                </Text>
              </Pressable>
            )}
          </Field>
          <Field label={accountLabel}>
            {liquidAccounts.length ? (
              <View style={styles.accountList}>
                {liquidAccounts.map((item) => {
                  const selected = selectedAccount?.id === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Seleccionar cuenta ${item.name}`}
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
                        <Text style={[styles.accountName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.accountMeta, { color: theme.muted }]}>
                          {item.kind} · {money(item.balance, true)}
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
                  Este libro aún no tiene cuentas líquidas
                </Text>
                <Text style={[styles.accountMeta, { color: theme.muted }]}>
                  Crea una cuenta (corriente, ahorro o efectivo) en {ledger.name}. Los bienes y
                  deudas no sirven para movimientos.
                </Text>
              </Pressable>
            )}
          </Field>
          <Field label="Fecha">
            <View style={styles.dateBlock}>
              <AppDateField
                value={dateKey}
                onChange={setDateKey}
                placeholder={locale === 'es' ? 'Elegir fecha' : 'Pick a date'}
              />
              <View style={styles.dateChips}>
                {(
                  [
                    {
                      key: toDateKey(new Date()),
                      label: locale === 'es' ? 'Hoy' : 'Today',
                    },
                    {
                      key: (() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        return toDateKey(d);
                      })(),
                      label: locale === 'es' ? 'Ayer' : 'Yesterday',
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
          <Field label="Nota">
            <TextInput
              value={note}
              onChangeText={(value) => {
                setNote(value);
                if (formError) setFormError('');
              }}
              onFocus={focusScrollToEnd(scrollRef, 120)}
              multiline
              placeholder="Opcional"
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                styles.note,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            />
          </Field>
          <Field label="Etiquetas">
            <TextInput
              value={tags}
              onChangeText={(value) => {
                setTags(value);
                if (formError) setFormError('');
              }}
              onFocus={focusScrollToEnd(scrollRef, 120)}
              placeholder="Opcional · hogar, compartido…"
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            />
          </Field>
          <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.flex}><Text style={[styles.fieldLabel, { color: theme.text }]}>Movimiento recurrente</Text><Text style={[styles.hint, { color: theme.muted }]}>Repetir y recibir recordatorios</Text></View><Switch value={recurring} onValueChange={setRecurring} trackColor={{ true: theme.primary }} /></View>
          <Field label="Recibo"><View style={styles.receiptRow}><ScalePressable style={[styles.receiptButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => void pickReceipt(true)}><AppIcon name="camera" color={theme.primary} /><Text style={[styles.receiptText, { color: theme.text }]}>Tomar foto</Text></ScalePressable><ScalePressable style={[styles.receiptButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => void pickReceipt()}><AppIcon name="photo.fill" color={theme.primary} /><Text style={[styles.receiptText, { color: theme.text }]}>{receipt ? 'Adjuntado ✓' : 'Elegir foto'}</Text></ScalePressable></View></Field>
          {formError ? (
            <Text style={[styles.formError, { color: theme.danger }]}>{formError}</Text>
          ) : null}
          <PrimaryButton
            icon="checkmark"
            onPress={saving ? undefined : () => void submit()}>
            {saving
              ? 'Guardando…'
              : isEditing
                ? 'Guardar cambios'
                : 'Guardar movimiento'}
          </PrimaryButton>
          {isEditing ? (
            <Pressable
              disabled={saving}
              onPress={confirmVoid}
              style={[styles.voidButton, { borderColor: theme.danger }]}>
              <Text style={[styles.voidText, { color: theme.danger }]}>
                Anular movimiento
              </Text>
            </Pressable>
          ) : null}
          <Text style={[styles.offline, { color: theme.muted }]}>Sin conexión se guardará y sincronizará después.</Text>
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
  chips: { gap: 8, alignItems: 'center' },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
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
