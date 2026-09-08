import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, Pill, ScalePressable, Screen, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { matchesCashflowCategory } from '@/lib/cashflow-filter';
import { filterTransactionsByMonth } from '@/lib/dates';
import { needWantLabel, parseNeedWant } from '@/lib/need-want';
import { safeGoBack } from '@/lib/navigation';
import { useActiveLedger } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { usePeriodStore } from '@/store/period';

export default function CashflowMovementsScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const {
    type: raw = 'gastos',
    category: categoryParam,
    needWant: needWantParam,
  } = useLocalSearchParams<{
    type?: string;
    category?: string;
    needWant?: string;
  }>();
  const type = raw === 'ingresos' ? 'ingresos' : 'gastos';
  const isIncome = type === 'ingresos';
  const category = (Array.isArray(categoryParam) ? categoryParam[0] : categoryParam)?.trim() || null;
  const needWantRaw = Array.isArray(needWantParam) ? needWantParam[0] : needWantParam;
  const parsedNeedWant = parseNeedWant(needWantRaw);
  const needWant = parsedNeedWant === 'need' || parsedNeedWant === 'want' ? parsedNeedWant : null;

  const { transactions, ledger } = useActiveLedger();
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const monthLabel = usePeriodStore((state) => state.label);
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';
  const period = useMemo(() => ({ year, month }), [year, month]);

  const monthItems = useMemo(
    () =>
      filterTransactionsByMonth(transactions, period).filter((item) =>
        isIncome ? item.amount > 0 : item.amount < 0,
      ),
    [transactions, period, isIncome],
  );
  const items = useMemo(
    () =>
      monthItems.filter((item) => {
        if (needWant && item.needWant !== needWant) return false;
        return matchesCashflowCategory(item, category);
      }),
    [monthItems, needWant, category],
  );
  const total = useMemo(
    () => items.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [items],
  );

  const title = [category, needWant ? needWantLabel(needWant, locale) : null]
    .filter(Boolean)
    .join(' · ') || (isIncome ? copy.cashflow.income : copy.cashflow.expenses);
  const empty =
    monthItems.length === 0
      ? isIncome
        ? copy.cashflow.emptyIncome
        : copy.cashflow.emptyExpenses
      : copy.cashflow.emptyFilter;
  const accent = isIncome ? theme.success : theme.danger;
  const soft = isIncome ? theme.successSoft : '#FDECEC';
  const backHref = {
    pathname: '/(tabs)/cashflow/[type]' as const,
    params: { type },
  };

  return (
    <Screen
      title={title}
      subtitle={`${copy.cashflow.categoryMovements(title)} · ${ledgerLabel}`}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => safeGoBack(backHref)}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <MonthSwitcher />

      <Card style={[styles.hero, { backgroundColor: accent }]}>
        <Text style={styles.heroLabel}>{title}</Text>
        <Text
          style={styles.heroValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}>
          {money(total)}
        </Text>
        <View style={styles.heroMeta}>
          <Pill tone={isIncome ? 'green' : 'orange'}>{copy.cashflow.nMovements(items.length)}</Pill>
          <Text style={styles.heroHint}>{monthLabel}</Text>
        </View>
      </Card>

      <Card style={styles.listCard}>
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{empty}</Text>
        ) : (
          items.map((item, index) => (
            <ScalePressable
              key={item.id}
              haptic={false}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${item.title}`}
              onPress={() =>
                router.push({
                  pathname: '/add-transaction',
                  params: { id: item.id },
                })
              }
              style={[
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}>
              <View style={[styles.rowIcon, { backgroundColor: soft }]}>
                <AppIcon name={item.icon} color={accent} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.rowMeta, { color: theme.muted }]}>
                  {item.category} · {item.account}
                  {item.needWant ? ` · ${needWantLabel(item.needWant, locale)}` : ''}
                  {' · '}
                  {item.date}
                </Text>
              </View>
              <Text style={[styles.rowAmount, { color: isIncome ? theme.success : theme.text }]}>
                {isIncome ? '+' : ''}
                {money(item.amount)}
              </Text>
            </ScalePressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: {
    borderWidth: 0,
    gap: 8,
    minHeight: 128,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    justifyContent: 'space-between',
  },
  heroLabel: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroHint: { color: '#FFFFFFCC', fontSize: 12 },
  empty: { fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  listCard: { paddingVertical: 4 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 11, lineHeight: 15 },
  rowAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
