import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, Pill, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { displayLedgerName, useAppCopy, type MovementFilterKey } from '@/i18n/app-copy';
import { useSafeLayout } from '@/hooks/use-safe-layout';
import { filterTransactionsByMonth, monthTotals } from '@/lib/dates';
import { safeGoBack } from '@/lib/navigation';
import { useFinanceStore } from '@/store/finance';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { usePeriodStore } from '@/store/period';

const movementFilterKeys: MovementFilterKey[] = ['all', 'expenses', 'income', 'recurring'];

export default function TransactionsScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { fabBottom } = useSafeLayout();
  const { ledger } = useActiveLedger();
  const refreshLedger = useLedgerStore((state) => state.refreshLedger);
  const transactions = useFinanceStore((state) => state.transactions);
  const pending = useFinanceStore((state) => state.pendingIds);
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const monthLabel = usePeriodStore((state) => state.label);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MovementFilterKey>('all');
  const [calendar, setCalendar] = useState(false);
  const period = useMemo(() => ({ year, month }), [year, month]);
  useFocusEffect(
    useCallback(() => {
      if (ledger?.type === 'shared' && ledger.id) {
        void refreshLedger(ledger.id);
      }
    }, [ledger?.id, ledger?.type, refreshLedger]),
  );
  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, period),
    [transactions, period],
  );
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';

  const totals = useMemo(() => {
    const fromTx = monthTotals(monthTransactions);
    return { ...fromTx, balance: fromTx.income - fromTx.expenses };
  }, [monthTransactions]);

  const visible = useMemo(() => monthTransactions.filter((item) => {
    const textMatch = `${item.title} ${item.category} ${item.account}`.toLowerCase().includes(query.toLowerCase());
    if (!textMatch) return false;
    if (filter === 'expenses') return item.amount < 0;
    if (filter === 'income') return item.amount > 0;
    if (filter === 'recurring') return Boolean(item.recurring);
    return true;
  }), [monthTransactions, query, filter]);

  const isEmptyBook = monthTransactions.length === 0;
  const noFilterResults = !isEmptyBook && visible.length === 0;

  if (!ledger) {
    return <Screen withTabBar title={copy.movements.title} subtitle={copy.common.loading} />;
  }

  return (
    <Screen
      withTabBar
      title={copy.movements.title}
      subtitle={`${monthTransactions.length} en ${monthLabel} · ${ledgerLabel}`}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.common.back}
          onPress={() => safeGoBack('/(tabs)/inicio')}
          style={[styles.headerBtn, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }
      floating={
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="Agregar movimiento"
          onPress={() => router.push('/add-transaction')}
          style={[styles.fab, { backgroundColor: theme.primary, bottom: fabBottom }]}>
          <AppIcon name="plus" color="#FFFFFF" size={28} />
        </ScalePressable>
      }>
      <MonthSwitcher />
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppIcon name="magnifyingglass" color={theme.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={copy.movements.searchPlaceholder}
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.text }]}
            accessibilityLabel="Buscar movimientos"
          />
        </View>
        <ScalePressable accessibilityRole="button" accessibilityLabel="Cambiar vista de calendario" onPress={() => setCalendar(!calendar)} style={[styles.square, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppIcon name="calendar" color={calendar ? theme.primary : theme.text} />
        </ScalePressable>
      </View>
      <View style={styles.filters}>
        {movementFilterKeys.map((key) => {
          const selected = filter === key;
          const label = copy.home.filters[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(key)}
              style={[styles.filter, { backgroundColor: selected ? theme.primary : theme.surface, borderColor: selected ? theme.primary : theme.border }]}>
              <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : theme.muted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {calendar && <CalendarStrip label={monthLabel} hasActivity={!isEmptyBook} />}

      <Card style={[styles.summary, { backgroundColor: theme.primarySoft }]}>
        <View>
          <Text style={[styles.small, { color: theme.muted }]}>{copy.movements.balanceMonth(monthLabel)}</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{money(totals.balance)}</Text>
        </View>
        <View style={styles.summarySides}>
          <Text style={[styles.small, { color: theme.success }]}>+{money(totals.income, true)}</Text>
          <Text style={[styles.small, { color: theme.danger }]}>−{money(totals.expenses, true)}</Text>
        </View>
      </Card>

      <View style={uiStyles.between}>
        <Text style={[styles.section, { color: theme.text }]}>{query || filter !== 'all' ? copy.movements.results : monthLabel}</Text>
        <ScalePressable style={[styles.filterButton, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="line.3.horizontal.decrease" color={theme.primary} size={16} /><Text style={[styles.small, { color: theme.primary }]}>{copy.movements.filter}</Text>
        </ScalePressable>
      </View>

      <Card style={styles.list}>
        {visible.map((item, index) => (
          <ScalePressable
            key={item.id}
            haptic={false}
            onPress={() =>
              router.push({
                pathname: '/add-transaction',
                params: { id: item.id },
              })
            }>
            <View style={[styles.row, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.rowIcon, { backgroundColor: item.amount > 0 ? theme.successSoft : theme.surfaceSecondary }]}>
                <AppIcon name={item.icon} color={item.amount > 0 ? theme.success : theme.primary} />
              </View>
              <View style={styles.rowCopy}>
                <View style={uiStyles.row}><Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>{pending.includes(item.id) && <Pill tone="orange">{copy.movements.pending}</Pill>}</View>
                <Text style={[styles.small, { color: theme.muted }]}>{item.category} · {item.account}</Text>
              </View>
              <View style={styles.amountCopy}><Text style={[styles.amount, { color: item.amount > 0 ? theme.success : theme.text }]}>{item.amount > 0 ? '+' : ''}{money(item.amount)}</Text><Text style={[styles.date, { color: theme.muted }]}>{item.date}</Text></View>
            </View>
          </ScalePressable>
        ))}
        {isEmptyBook ? (
          <View style={styles.empty}>
            <AppIcon name="doc.text.fill" color={theme.muted} size={32} />
            <Text style={[styles.rowTitle, { color: theme.text }]}>{copy.movements.empty}</Text>
            <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
              No hay operaciones en {monthLabel}. Cambia de mes o agrega una con +.
            </Text>
          </View>
        ) : null}
        {noFilterResults ? (
          <View style={styles.empty}>
            <AppIcon name="magnifyingglass" color={theme.muted} size={32} />
            <Text style={[styles.rowTitle, { color: theme.text }]}>{copy.movements.noResults}</Text>
            <Text style={[styles.small, { color: theme.muted }]}>Prueba otra búsqueda o filtro.</Text>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

function CalendarStrip({ label, hasActivity }: { label: string; hasActivity: boolean }) {
  const theme = useAppTheme();
  return (
    <Card>
      <View style={uiStyles.between}><Text style={[styles.section, { color: theme.text }]}>{label}</Text><View style={uiStyles.row}><AppIcon name="arrow.left" color={theme.muted} /><AppIcon name="chevron" color={theme.muted} /></View></View>
      <View style={styles.week}>
        {['L 3', 'M 4', 'X 5', 'J 6', 'V 7', 'S 8', 'D 9'].map((day, index) => (
          <View key={day} style={[styles.day, index === 2 && { backgroundColor: theme.primary }]}>
            <Text style={[styles.dayText, { color: index === 2 ? '#FFFFFF' : theme.muted }]}>{day.replace(' ', '\n')}</Text>
            {hasActivity && index < 5 ? <View style={[styles.dayDot, { backgroundColor: index === 2 ? '#FFFFFF' : theme.primary }]} /> : null}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', gap: 10 }, search: { flex: 1, height: 48, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 },
  searchInput: { flex: 1, fontSize: 15 }, square: { width: 48, height: 48, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8 }, filter: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },
  filterText: { fontSize: 12, fontWeight: '600' }, summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 0 },
  summaryValue: { fontSize: 24, fontWeight: '700', marginTop: 3 }, summarySides: { alignItems: 'flex-end', gap: 6 }, small: { fontSize: 12, lineHeight: 17 },
  section: { fontSize: 18, fontWeight: '700' }, filterButton: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  list: { paddingVertical: 3 }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontWeight: '600', maxWidth: 160 }, amountCopy: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }, date: { fontSize: 10 },
  fab: { position: 'absolute', right: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', shadowColor: '#0878F9', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  empty: { alignItems: 'center', paddingVertical: 34, gap: 7 }, week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  day: { width: 37, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5 }, dayText: { fontSize: 11, lineHeight: 17, textAlign: 'center', fontWeight: '600' },
  dayDot: { width: 4, height: 4, borderRadius: 2 },
});
