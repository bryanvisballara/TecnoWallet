import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { useFinanceStore } from '@/store/finance';
import { useActiveLedger } from '@/store/ledger';

const categories = ['Alimentación', 'Hogar', 'Transporte', 'Ocio', 'Salud', 'Ingresos'];

export default function AddTransactionScreen() {
  const theme = useAppTheme();
  const profile = useAuthStore((state) => state.profile);
  const { accounts, ledger } = useActiveLedger();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Alimentación');
  const [account, setAccount] = useState(accounts[0]?.name ?? 'Efectivo');
  const [date, setDate] = useState('Hoy');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [receipt, setReceipt] = useState<string>();
  const [saving, setSaving] = useState(false);

  const pickReceipt = async (camera = false) => {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (!result.canceled) setReceipt(result.assets[0]?.uri);
  };

  const submit = async () => {
    const parsed = Number(amount.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Faltan datos', 'Agrega un concepto y un importe válido.');
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        title: title.trim(),
        category,
        account,
        amount: type === 'income' ? parsed : -parsed,
        note,
        tags: [...tags.split(',').map((item) => item.trim()).filter(Boolean), ...(receipt ? ['recibo', 'ocr-pendiente'] : [])],
        recurring,
        date,
        createdBy: ledger.type === 'shared' ? profile.name : undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('No se pudo guardar', 'El movimiento se restauró. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={[styles.cancel, { color: theme.primary }]}>Cancelar</Text></Pressable><Text style={[styles.headerTitle, { color: theme.text }]}>Nuevo · {ledger.name}</Text><View style={styles.headerSpacer} /></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.segmented, { backgroundColor: theme.surfaceSecondary }]}>
            {[['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']].map(([value, label]) => (
              <Pressable key={value} onPress={() => setType(value as typeof type)} style={[styles.segment, type === value && { backgroundColor: theme.surface }]}>
                <Text style={[styles.segmentText, { color: type === value ? theme.text : theme.muted }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.amountBlock}><Text style={[styles.currency, { color: theme.muted }]}>USD</Text><TextInput value={amount} onChangeText={setAmount} autoFocus keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.border} style={[styles.amountInput, { color: type === 'income' ? theme.success : theme.text }]} accessibilityLabel="Importe" /></View>
          <Field label="Concepto"><TextInput value={title} onChangeText={setTitle} placeholder="¿En qué fue?" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></Field>
          <Field label="Categoría"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, { backgroundColor: category === item ? theme.primary : theme.surface, borderColor: category === item ? theme.primary : theme.border }]}><Text style={[styles.chipText, { color: category === item ? '#FFFFFF' : theme.muted }]}>{item}</Text></Pressable>)}</ScrollView></Field>
          <View style={styles.twoColumns}><Field label="Cuenta" style={styles.flex}><TextInput value={account} onChangeText={setAccount} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></Field><Field label="Fecha" style={styles.flex}><TextInput value={date} onChangeText={setDate} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></Field></View>
          <Field label="Nota"><TextInput value={note} onChangeText={setNote} multiline placeholder="Opcional" placeholderTextColor={theme.muted} style={[styles.input, styles.note, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></Field>
          <Field label="Etiquetas"><TextInput value={tags} onChangeText={setTags} placeholder="hogar, compartido…" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} /></Field>
          <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.flex}><Text style={[styles.fieldLabel, { color: theme.text }]}>Movimiento recurrente</Text><Text style={[styles.hint, { color: theme.muted }]}>Repetir y recibir recordatorios</Text></View><Switch value={recurring} onValueChange={setRecurring} trackColor={{ true: theme.primary }} /></View>
          <Field label="Recibo"><View style={styles.receiptRow}><ScalePressable style={[styles.receiptButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => void pickReceipt(true)}><AppIcon name="camera" color={theme.primary} /><Text style={[styles.receiptText, { color: theme.text }]}>Tomar foto</Text></ScalePressable><ScalePressable style={[styles.receiptButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => void pickReceipt()}><AppIcon name="photo.fill" color={theme.primary} /><Text style={[styles.receiptText, { color: theme.text }]}>{receipt ? 'Adjuntado ✓' : 'Elegir foto'}</Text></ScalePressable></View></Field>
          <PrimaryButton icon="checkmark" onPress={saving ? undefined : submit}>{saving ? 'Guardando…' : 'Guardar movimiento'}</PrimaryButton>
          <Text style={[styles.offline, { color: theme.muted }]}>Sin conexión se guardará y sincronizará después.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, style }: PropsWithChildren<{ label: string; style?: object }>) {
  const theme = useAppTheme();
  return <View style={[styles.field, style]}><Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, flex: { flex: 1 }, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  cancel: { fontSize: 15, fontWeight: '600' }, headerTitle: { fontSize: 17, fontWeight: '700' }, headerSpacer: { width: 62 },
  content: { padding: 18, paddingBottom: 60, gap: 18, maxWidth: 620, width: '100%', alignSelf: 'center' },
  segmented: { padding: 4, borderRadius: 14, flexDirection: 'row' }, segment: { flex: 1, minHeight: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.06, shadowRadius: 5 },
  segmentText: { fontSize: 12, fontWeight: '600' }, amountBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  currency: { fontSize: 12, fontWeight: '700', letterSpacing: 1 }, amountInput: { fontSize: 52, fontWeight: '700', minWidth: 200, textAlign: 'center', letterSpacing: -1.5 },
  field: { gap: 8 }, fieldLabel: { fontSize: 13, fontWeight: '600' }, input: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, paddingHorizontal: 14, fontSize: 15 },
  note: { minHeight: 84, paddingTop: 13, textAlignVertical: 'top' }, chips: { gap: 8 }, chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: '600' }, twoColumns: { flexDirection: 'row', gap: 10 },
  switchRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  hint: { fontSize: 11, marginTop: 3 }, receiptRow: { flexDirection: 'row', gap: 10 }, receiptButton: { flex: 1, minHeight: 72, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 6 },
  receiptText: { fontSize: 12, fontWeight: '600' }, offline: { textAlign: 'center', fontSize: 11 },
});
