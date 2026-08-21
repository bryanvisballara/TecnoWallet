import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import { getActiveMoneyCurrency } from '@/data/demo';
import { buildPdfBytes } from '@/lib/export-pdf';
import {
  buildExportReport,
  exportFileName,
  exportTimeRanges,
  formatMoney,
  type ExportFormat,
  type ExportTimeRangeId,
} from '@/lib/export-report';
import { buildXlsxBytes } from '@/lib/export-xlsx';
import { safeGoBack } from '@/lib/navigation';
import { saveExportFile } from '@/lib/save-export';
import { useAuthStore } from '@/store/auth';
import { useActiveLedger } from '@/store/ledger';

function todayKey() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function yearStartKey() {
  return `${new Date().getFullYear()}-01-01`;
}

export default function ExportScreen() {
  const theme = useAppTheme();
  const profile = useAuthStore((state) => state.profile);
  const { accounts, transactions, envelopes, ledger } = useActiveLedger();
  const [selectedAccounts, setSelectedAccounts] = useState(() => new Set(accounts.map((item) => item.id)));
  const [range, setRange] = useState<ExportTimeRangeId>('month');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [customFrom, setCustomFrom] = useState(yearStartKey);
  const [customTo, setCustomTo] = useState(todayKey);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setSelectedAccounts(new Set(accounts.map((item) => item.id)));
  }, [ledger.id, accounts]);

  const report = useMemo(
    () =>
      buildExportReport({
        accounts,
        transactions,
        envelopes,
        accountIds: [...selectedAccounts],
        range,
        customFrom: range === 'custom' ? customFrom : undefined,
        customTo: range === 'custom' ? customTo : undefined,
        ledgerName: ledger.name,
        recorder: profile.name,
        currency: ledger.baseCurrency || getActiveMoneyCurrency(),
      }),
    [accounts, transactions, envelopes, selectedAccounts, range, customFrom, customTo, ledger.name, ledger.baseCurrency, profile.name],
  );

  const canExport = selectedAccounts.size > 0 && !exporting;

  const toggleAccount = (id: string) => {
    setSelectedAccounts((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onGenerate = async () => {
    if (!canExport) {
      Alert.alert('Selecciona al menos una cuenta', 'Elige qué incluir en el archivo.');
      return;
    }
    setExporting(true);
    try {
      void Haptics.selectionAsync();
      const filename = exportFileName(range, format);
      const bytes = format === 'pdf' ? buildPdfBytes(report) : buildXlsxBytes(report);
      await saveExportFile({
        bytes,
        filename,
        mime:
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      Alert.alert(
        'Archivo listo',
        `${report.movements.length} movimiento${report.movements.length === 1 ? '' : 's'} en ${filename}`,
      );
    } catch {
      Alert.alert('No se pudo generar', 'Inténtalo de nuevo en un momento.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SheetScreen heightRatio={0.92} fallback="/(tabs)/mas">
      <View style={styles.body}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => safeGoBack('/(tabs)/mas')}
            style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={18} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Exportar · {ledger.name}</Text>
          <View style={styles.close} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.section, { color: theme.text }]}>Formato</Text>
          <View style={styles.formatRow}>
            {(
              [
                { id: 'xlsx' as const, title: 'Excel', subtitle: 'Hoja .xlsx', icon: 'tablecells.fill' },
                { id: 'pdf' as const, title: 'PDF', subtitle: 'Informe visual', icon: 'doc.richtext.fill' },
              ] as const
            ).map((item) => {
              const selected = format === item.id;
              return (
                <ScalePressable
                  key={item.id}
                  haptic={false}
                  onPress={() => setFormat(item.id)}
                  style={[
                    styles.formatCard,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.primarySoft : theme.surface,
                    },
                  ]}>
                  <View style={[styles.formatIcon, { backgroundColor: selected ? theme.primary : theme.surfaceSecondary }]}>
                    <AppIcon name={item.icon} color={selected ? '#FFFFFF' : theme.primary} size={18} />
                  </View>
                  <Text style={[styles.formatTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.formatSub, { color: theme.muted }]}>{item.subtitle}</Text>
                </ScalePressable>
              );
            })}
          </View>

          <ScalePressable
            accessibilityRole="button"
            disabled={!canExport}
            onPress={() => void onGenerate()}
            style={[styles.downloadBtn, { backgroundColor: theme.primary, opacity: canExport ? 1 : 0.5 }]}>
            <AppIcon name="square.and.arrow.down" color="#FFFFFF" size={20} />
            <Text style={styles.downloadText}>
              {exporting ? 'Descargando…' : `Descargar ${format === 'pdf' ? 'PDF' : 'Excel'}`}
            </Text>
          </ScalePressable>

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

          <View style={[styles.summary, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Vista previa</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.success }]}>Ingresos</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatMoney(report.incomeTotal, report.currency)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.danger }]}>Gastos</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatMoney(report.expenseTotal, report.currency)}
                </Text>
              </View>
            </View>
            {report.incomeEnvelopes.slice(0, 3).map((item) => (
              <Text key={`in-${item.name}`} style={[styles.hint, { color: theme.muted }]}>
                {item.name}: {formatMoney(item.periodTotal, report.currency)}
              </Text>
            ))}
            {report.expenseEnvelopes.slice(0, 3).map((item) => (
              <Text key={`ex-${item.name}`} style={[styles.hint, { color: theme.muted }]}>
                {item.name}: {formatMoney(item.periodTotal, report.currency)}
              </Text>
            ))}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.success }]}>Activos</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatMoney(report.assetsTotal, report.currency)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.danger }]}>Deudas</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatMoney(report.debtsTotal, report.currency)}
                </Text>
              </View>
            </View>
            <Text style={[styles.hint, { color: theme.text }]}>
              Patrimonio {formatMoney(report.netWorth, report.currency)}
            </Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              {report.movements.length} movimiento{report.movements.length === 1 ? '' : 's'} · {report.assets.length} activo{report.assets.length === 1 ? '' : 's'} · {report.debts.length} deuda{report.debts.length === 1 ? '' : 's'} · {format === 'pdf' ? 'PDF TecnoWallet' : 'Excel .xlsx'}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
          <ScalePressable
            accessibilityRole="button"
            disabled={!canExport}
            onPress={() => void onGenerate()}
            style={[styles.exportButton, { backgroundColor: theme.primary, opacity: canExport ? 1 : 0.5 }]}>
            <AppIcon name="square.and.arrow.down" color="#FFFFFF" size={18} />
            <Text style={styles.exportText}>
              {exporting ? 'Descargando…' : `Descargar ${format === 'pdf' ? 'PDF' : 'Excel'}`}
            </Text>
          </ScalePressable>
        </View>
      </View>
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
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
  content: { padding: 18, gap: 10, paddingBottom: 20 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  formatRow: { flexDirection: 'row', gap: 10 },
  formatCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  formatIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  formatTitle: { fontSize: 16, fontWeight: '800' },
  formatSub: { fontSize: 12, fontWeight: '600' },
  downloadBtn: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  downloadText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
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
  summary: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  summaryTitle: { fontSize: 14, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryItem: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: 12, fontWeight: '700' },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 12, fontWeight: '600' },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exportButton: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  exportText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
