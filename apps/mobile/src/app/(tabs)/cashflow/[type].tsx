import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, Pill, PrimaryButton, ProgressBar, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money, type Transaction } from '@/data/demo';
import { needWantLabel, parseNeedWant } from '@/lib/need-want';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { filterTransactionsByMonth } from '@/lib/dates';
import { useActiveLedger } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { usePeriodStore } from '@/store/period';

const DONUT_MAX_SLICES = 5;

function categoryName(item: Pick<Transaction, 'category'>) {
  return item.category.trim() || 'Otros';
}

function matchesCategory(
  item: Pick<Transaction, 'category'>,
  selected: string | null,
  rankedNames: string[],
  groupOthers = false,
) {
  if (!selected) return true;
  const name = categoryName(item);
  if (selected !== 'Otros' || !groupOthers) return name === selected;
  const featured = rankedNames.filter((row) => row !== 'Otros').slice(0, DONUT_MAX_SLICES);
  return !featured.includes(name);
}

type CashflowType = 'ingresos' | 'gastos';

export default function CashflowDetailScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const {
    type: raw = 'gastos',
    category: categoryParam,
    needWant: needWantParam,
    other: otherParam,
  } = useLocalSearchParams<{
    type: string;
    category?: string;
    needWant?: string;
    other?: string;
  }>();
  const type: CashflowType = raw === 'ingresos' ? 'ingresos' : 'gastos';
  const isIncome = type === 'ingresos';
  const meta = {
    title: isIncome ? copy.cashflow.income : copy.cashflow.expenses,
    subtitle: isIncome ? copy.cashflow.incomeSubtitle : copy.cashflow.expensesSubtitle,
    heroLabel: isIncome ? copy.cashflow.totalIn : copy.cashflow.totalOut,
    empty: isIncome ? copy.cashflow.emptyIncome : copy.cashflow.emptyExpenses,
    add: isIncome ? copy.cashflow.registerIncome : copy.cashflow.registerExpense,
    tone: (isIncome ? 'green' : 'orange') as 'green' | 'orange',
  };
  const { transactions, ledger } = useActiveLedger();
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const monthLabel = usePeriodStore((state) => state.label);
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';
  const initialCategory = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
  const initialNeedWantRaw = Array.isArray(needWantParam) ? needWantParam[0] : needWantParam;
  const initialNeedWant = parseNeedWant(initialNeedWantRaw);
  const groupOthers =
    (Array.isArray(otherParam) ? otherParam[0] : otherParam) === '1';
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory?.trim() || null,
  );
  const [selectedNeedWant, setSelectedNeedWant] = useState<'need' | 'want' | null>(
    initialNeedWant === 'need' || initialNeedWant === 'want' ? initialNeedWant : null,
  );

  useEffect(() => {
    setSelectedCategory(initialCategory?.trim() || null);
  }, [initialCategory]);

  useEffect(() => {
    setSelectedNeedWant(
      initialNeedWant === 'need' || initialNeedWant === 'want' ? initialNeedWant : null,
    );
  }, [initialNeedWant]);

  const period = useMemo(() => ({ year, month }), [year, month]);
  const monthItems = useMemo(() => {
    return filterTransactionsByMonth(transactions, period).filter((item) =>
      type === 'ingresos' ? item.amount > 0 : item.amount < 0,
    );
  }, [transactions, period, type]);

  const total = useMemo(
    () => monthItems.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [monthItems],
  );

  const categories = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; icon: string }>();
    monthItems.forEach((item) => {
      const name = item.category.trim() || 'Otros';
      const current = map.get(name) ?? { name, amount: 0, icon: item.icon };
      current.amount += Math.abs(item.amount);
      map.set(name, current);
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [monthItems]);

  const rankedNames = useMemo(() => categories.map((item) => item.name), [categories]);
  const visibleItems = useMemo(() => {
    return monthItems.filter((item) => {
      if (selectedNeedWant && item.needWant !== selectedNeedWant) return false;
      return matchesCategory(item, selectedCategory, rankedNames, groupOthers);
    });
  }, [monthItems, selectedCategory, selectedNeedWant, rankedNames, groupOthers]);
  const visibleTotal = useMemo(
    () => visibleItems.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [visibleItems],
  );
  const hasFilter = Boolean(selectedCategory || selectedNeedWant);
  const heroAmount = hasFilter ? visibleTotal : total;
  const heroCount = hasFilter ? visibleItems.length : monthItems.length;
  const heroLabel = [
    selectedCategory,
    selectedNeedWant ? needWantLabel(selectedNeedWant, locale) : null,
  ]
    .filter(Boolean)
    .join(' · ') || meta.heroLabel;
  const listTitle = hasFilter
    ? copy.cashflow.categoryMovements(
        [selectedCategory, selectedNeedWant ? needWantLabel(selectedNeedWant, locale) : null]
          .filter(Boolean)
          .join(' · '),
      )
    : copy.cashflow.movements;
  const emptyLabel =
    monthItems.length === 0 ? meta.empty : hasFilter ? copy.cashflow.emptyFilter : meta.empty;

  const accent = type === 'ingresos' ? theme.success : theme.danger;
  const soft = type === 'ingresos' ? theme.successSoft : '#FDECEC';

  return (
    <Screen
      title={meta.title}
      subtitle={`${meta.subtitle} · ${ledgerLabel}`}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => safeGoBack('/(tabs)/inicio')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <MonthSwitcher />

      <Card style={[styles.hero, { backgroundColor: accent }]}>
        <Text style={styles.heroLabel}>{heroLabel}</Text>
        <Text
          style={styles.heroValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}>
          {money(heroAmount)}
        </Text>
        <View style={styles.heroMeta}>
          <Pill tone={meta.tone}>{copy.cashflow.nMovements(heroCount)}</Pill>
          <Text style={styles.heroHint}>{monthLabel}</Text>
        </View>
      </Card>

      <PrimaryButton
        icon="plus"
        onPress={() =>
          router.push({
            pathname: '/add-transaction',
            params: { type: isIncome ? 'income' : 'expense' },
          })
        }>
        {meta.add}
      </PrimaryButton>

      <Card>
        <Text style={[styles.section, { color: theme.text }]}>{copy.cashflow.byCategory}</Text>
        {!isIncome ? (
          <View style={styles.needWantFilters}>
            {(
              [
                { key: 'need' as const, label: needWantLabel('need', locale), a11y: copy.cashflow.viewNeedA11y },
                { key: 'want' as const, label: needWantLabel('want', locale), a11y: copy.cashflow.viewWantA11y },
              ] as const
            ).map((item) => {
              const selected = selectedNeedWant === item.key;
              return (
                <ScalePressable
                  key={item.key}
                  haptic={false}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.a11y}
                  onPress={() =>
                    setSelectedNeedWant((current) => (current === item.key ? null : item.key))
                  }
                  style={[
                    styles.needWantChip,
                    {
                      backgroundColor: selected ? theme.surfaceSecondary : theme.surface,
                      borderColor: selected ? accent : theme.border,
                    },
                  ]}>
                  <AppIcon
                    name={item.key === 'need' ? 'cart.fill' : 'heart.fill'}
                    color={selected ? accent : theme.muted}
                    size={16}
                  />
                  <Text style={[styles.needWantChipText, { color: selected ? theme.text : theme.muted }]}>
                    {item.label}
                  </Text>
                </ScalePressable>
              );
            })}
          </View>
        ) : null}
        {categories.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{meta.empty}</Text>
        ) : (
          categories.map((category) => {
            const ratio = total > 0 ? category.amount / total : 0;
            const selected = selectedCategory === category.name;
            return (
              <ScalePressable
                key={category.name}
                haptic={false}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={copy.cashflow.viewCategoryA11y(category.name)}
                onPress={() =>
                  setSelectedCategory((current) =>
                    current === category.name ? null : category.name,
                  )
                }
                style={[
                  styles.categoryRow,
                  selected && { backgroundColor: theme.surfaceSecondary, borderRadius: 14 },
                ]}>
                <View style={[styles.categoryIcon, { backgroundColor: soft }]}>
                  <AppIcon name={category.icon} color={accent} />
                </View>
                <View style={styles.categoryCopy}>
                  <View style={uiStyles.between}>
                    <Text style={[styles.categoryName, { color: theme.text }]}>{category.name}</Text>
                    <Text style={[styles.categoryAmount, { color: theme.text }]}>
                      {money(category.amount)}
                    </Text>
                  </View>
                  <ProgressBar
                    value={ratio}
                    color={accent}
                    label={`${category.name} ${Math.round(ratio * 100)}%`}
                  />
                  <Text style={[styles.categoryShare, { color: theme.muted }]}>
                    {Math.round(ratio * 100)}
                    {copy.cashflow.pctOfTotal}
                  </Text>
                </View>
              </ScalePressable>
            );
          })
        )}
      </Card>

      <Text style={[styles.section, { color: theme.text }]}>{listTitle}</Text>
      <Card style={styles.listCard}>
        {visibleItems.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{emptyLabel}</Text>
        ) : (
          visibleItems.map((item, index) => (
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
              <Text style={[styles.rowAmount, { color: type === 'ingresos' ? theme.success : theme.text }]}>
                {type === 'ingresos' ? '+' : ''}
                {money(item.amount)}
              </Text>
            </ScalePressable>
          ))
        )}
      </Card>

      <ScalePressable onPress={() => router.push('/(tabs)/movimientos')}>
        <Text style={[styles.link, { color: theme.primary }]}>{copy.cashflow.viewAll}</Text>
      </ScalePressable>
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
  section: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  empty: { fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  categoryRow: { flexDirection: 'row', gap: 12, marginTop: 14, padding: 8, marginHorizontal: -8 },
  categoryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  categoryCopy: { flex: 1, gap: 6 },
  categoryName: { fontSize: 14, fontWeight: '600' },
  categoryAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  categoryShare: { fontSize: 11 },
  needWantFilters: { flexDirection: 'row', gap: 8, marginTop: 12 },
  needWantChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  needWantChipText: { fontSize: 13, fontWeight: '700' },
  listCard: { paddingVertical: 4 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 11, lineHeight: 15 },
  rowAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
});
