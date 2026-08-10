import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { focusScrollToEnd, FormScrollView } from '@/components/form-scroll-view';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { formatDayLabel, parseDateKey, toDateKey } from '@/data/calendar';
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

export default function AddTransactionScreen() {
  const theme = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const locale = useLanguageStore((state) => state.locale);
  const profile = useAuthStore((state) => state.profile);
  const { accounts, envelopes, ledger } = useActiveLedger();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const isCurrentMonth = usePeriodStore((state) => state.isCurrentMonth);
  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [envelopeId, setEnvelopeId] = useState('');
  const [accountId, setAccountId] = useState(liquidAccounts[0]?.id ?? '');
  const [dateKey, setDateKey] = useState(() =>
    defaultTransactionDateKey(isCurrentMonth, year, month),
  );
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [receipt, setReceipt] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const dateLabel = useMemo(() => {
    const todayKey = toDateKey(new Date());
    if (dateKey === todayKey) return locale === 'es' ? 'Hoy' : 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateKey === toDateKey(yesterday)) return locale === 'es' ? 'Ayer' : 'Yesterday';
    return formatDayLabel(parseDateKey(dateKey), locale);
  }, [dateKey, locale]);

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
      await addTransaction({
        title: title.trim(),
        category: selectedEnvelope.name,
        account: selectedAccount.name,
        amount: type === 'income' ? parsed : -parsed,
        // Nota y etiquetas son opcionales.
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
      });
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

  return (
    <SheetScreen fallback="/(tabs)/movimientos">
      <View style={styles.flex}>
        <View style={styles.header}><Pressable onPress={() => safeGoBack('/(tabs)/movimientos')}><Text style={[styles.cancel, { color: theme.primary }]}>Cancelar</Text></Pressable><Text style={[styles.headerTitle, { color: theme.text }]}>Nuevo · {ledger.name}</Text><View style={styles.headerSpacer} /></View>
        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <View style={[styles.segmented, { backgroundColor: theme.surfaceSecondary }]}>
            {([['expense', 'Gasto'], ['income', 'Ingreso']] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => setType(value)} style={[styles.segment, type === value && { backgroundColor: theme.surface }]}>
                <Text style={[styles.segmentText, { color: type === value ? theme.text : theme.muted }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.amountBlock}><Text style={[styles.currency, { color: theme.muted }]}>USD</Text><TextInput value={amount} onChangeText={(value) => { setAmount(value); if (formError) setFormError(''); }} onFocus={focusScrollToEnd(scrollRef, 120)} autoFocus keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.border} style={[styles.amountInput, { color: type === 'income' ? theme.success : theme.text }]} accessibilityLabel="Importe" /></View>
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
            {Platform.OS === 'web' ? (
              <View style={styles.dateBlock}>
                <input
                  type="date"
                  value={dateKey}
                  onChange={(event) => setDateKey(event.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 15,
                    padding: '12px 14px',
                    fontSize: 15,
                    color: theme.text,
                    backgroundColor: theme.surface,
                    fontFamily: 'inherit',
                    minHeight: 50,
                  }}
                />
                <Text style={[styles.hint, { color: theme.muted }]}>{dateLabel}</Text>
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
                            backgroundColor: selected ? theme.primarySoft : theme.surfaceSecondary,
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
            ) : (
              <View style={styles.dateBlock}>
                <TextInput
                  value={dateKey}
                  onChangeText={setDateKey}
                  onFocus={focusScrollToEnd(scrollRef, 120)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                />
                <Text style={[styles.hint, { color: theme.muted }]}>{dateLabel}</Text>
              </View>
            )}
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
            {saving ? 'Guardando…' : 'Guardar movimiento'}
          </PrimaryButton>
          <Text style={[styles.offline, { color: theme.muted }]}>Sin conexión se guardará y sincronizará después.</Text>
        </FormScrollView>
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
  content: { padding: 18, paddingBottom: 60, gap: 18, maxWidth: 620, width: '100%', alignSelf: 'center' },
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
  offline: { textAlign: 'center', fontSize: 11 },
});
