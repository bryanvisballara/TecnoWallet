import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import {
  buildBudgetCsv,
  exportFileName,
  exportTimeRanges,
  type ExportTimeRangeId,
} from '@/lib/export-csv';
import { useActiveLedger } from '@/store/ledger';
import { useAuthStore } from '@/store/auth';

export default function ExportScreen() {
  const theme = useAppTheme();
  const profile = useAuthStore((state) => state.profile);
  const { accounts, transactions, ledger } = useActiveLedger();
  const [selectedAccounts, setSelectedAccounts] = useState(() => new Set(accounts.map((item) => item.id)));
  const [range, setRange] = useState<ExportTimeRangeId>('all');
  const [customFrom, setCustomFrom] = useState('2026-01-01');
  const [customTo, setCustomTo] = useState('2026-08-05');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setSelectedAccounts(new Set(accounts.map((item) => item.id)));
  }, [ledger.id, accounts]);

  const canExport = selectedAccounts.size > 0 && !exporting;

  const previewCount = useMemo(() => {
    const csv = buildBudgetCsv({
      accounts,
      transactions,
      accountIds: [...selectedAccounts],
      range,
      customFrom: range === 'custom' ? customFrom : undefined,
      customTo: range === 'custom' ? customTo : undefined,
      ledgerName: ledger.name,
      recorder: profile.name,
    });
    return Math.max(0, csv.split('\n').length - 1);
  }, [accounts, transactions, selectedAccounts, range, customFrom, customTo, ledger.name, profile.name]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadOnWeb = (csv: string, filename: string) => {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  };

  const onExport = async () => {
    if (!canExport) {
      Alert.alert('Selecciona al menos una cuenta', 'Elige qué incluir en el CSV.');
      return;
    }

    setExporting(true);
    try {
      void Haptics.selectionAsync();
      const filename = exportFileName(range);
      const csv = buildBudgetCsv({
        accounts,
        transactions,
        accountIds: [...selectedAccounts],
        range,
        customFrom: range === 'custom' ? customFrom : undefined,
        customTo: range === 'custom' ? customTo : undefined,
        ledgerName: ledger.name,
        recorder: profile.name,
      });

      if (Platform.OS === 'web' && downloadOnWeb(csv, filename)) {
        Alert.alert('Exportación lista', `${previewCount} movimientos en ${filename}`);
        return;
      }

      await Share.share({
        title: filename,
        message: csv,
      });
    } catch {
      Alert.alert('No se pudo exportar', 'Inténtalo de nuevo en un momento.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={() => router.back()}
          style={styles.close}>
          <AppIcon name="xmark" color={theme.text} size={18} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Exportar · {ledger.name}</Text>
        <View style={styles.close} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: theme.text }]}>Cuentas</Text>
        <View style={[styles.card, { borderColor: theme.border }]}>
          {accounts.map((account, index) => {
            const selected = selectedAccounts.has(account.id);
            return (
              <ScalePressable
                key={account.id}
                haptic={false}
                onPress={() => toggleAccount(account.id)}
                style={[
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                ]}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>{account.name}</Text>
                <View
                  style={[
                    styles.check,
                    {
                      backgroundColor: selected ? theme.primary : 'transparent',
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}>
                  {selected ? <AppIcon name="checkmark" color="#FFFFFF" size={14} /> : null}
                </View>
              </ScalePressable>
            );
          })}
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Tiempo</Text>
        <View style={[styles.card, { borderColor: theme.border }]}>
          {exportTimeRanges.map((item, index) => {
            const selected = range === item.id;
            return (
              <ScalePressable
                key={item.id}
                haptic={false}
                onPress={() => setRange(item.id)}
                style={[
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                ]}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>{item.label}</Text>
                <View
                  style={[
                    styles.check,
                    {
                      backgroundColor: selected ? theme.primary : 'transparent',
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}>
                  {selected ? <AppIcon name="checkmark" color="#FFFFFF" size={14} /> : null}
                </View>
              </ScalePressable>
            );
          })}
        </View>

        {range === 'custom' ? (
          <View style={styles.customRow}>
            <View style={styles.customField}>
              <Text style={[styles.customLabel, { color: theme.muted }]}>Desde</Text>
              <TextInput
                value={customFrom}
                onChangeText={setCustomFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
              />
            </View>
            <View style={styles.customField}>
              <Text style={[styles.customLabel, { color: theme.muted }]}>Hasta</Text>
              <TextInput
                value={customTo}
                onChangeText={setCustomTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.muted}
                autoCapitalize="none"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
              />
            </View>
          </View>
        ) : null}

        <Text style={[styles.hint, { color: theme.muted }]}>
          {previewCount} movimiento{previewCount === 1 ? '' : 's'} · CSV compatible con Budget
        </Text>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <ScalePressable
          accessibilityRole="button"
          disabled={!canExport}
          onPress={() => void onExport()}
          style={[
            styles.exportButton,
            { backgroundColor: theme.primary, opacity: canExport ? 1 : 0.5 },
          ]}>
          <Text style={styles.exportText}>{exporting ? 'Exportando…' : 'Exportar'}</Text>
        </ScalePressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  content: { padding: 18, gap: 10, paddingBottom: 28 },
  section: { fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: { flex: 1, fontSize: 16 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customRow: { flexDirection: 'row', gap: 10 },
  customField: { flex: 1, gap: 6 },
  customLabel: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  hint: { fontSize: 12, marginTop: 4 },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exportButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
