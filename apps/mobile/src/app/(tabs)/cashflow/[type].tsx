import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, Pill, PrimaryButton, ProgressBar, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { openCashflowDetalle } from '@/lib/cashflow-filter';
import { filterTransactionsByMonth } from '@/lib/dates';
import { needWantLabel, parseNeedWant } from '@/lib/need-want';
import { safeGoBack } from '@/lib/navigation';
import { useActiveLedger } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { usePeriodStore } from '@/store/period';

type CashflowType = 'ingresos' | 'gastos';

export default function CashflowDetailScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const {
    type: raw = 'gastos',
    category: categoryParam,
    needWant: needWantParam,
  } = useLocalSearchParams<{
    type: string;
    category?: string;
    needWant?: string;
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
  const initialCategory = (Array.isArray(categoryParam) ? categoryParam[0] : categoryParam)?.trim();
  const initialNeedWant = parseNeedWant(
    Array.isArray(needWantParam) ? needWantParam[0] : needWantParam,
  );

  useEffect(() => {
    const needWant = initialNeedWant === 'need' || initialNeedWant === 'want' ? initialNeedWant : undefined;
    if (!initialCategory && !needWant) return;
    router.replace(
      openCashflowDetalle({
        type,
        category: initialCategory || undefined,
        needWant,
      }),
    );
  }, [initialCategory, initialNeedWant, type]);

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

  const accent = type === 'ingresos' ? theme.success : theme.danger;
  const soft = type === 'ingresos' ? theme.successSoft : '#FDECEC';

  const openDetalle = (params?: { category?: string; needWant?: 'need' | 'want' }) => {
    router.push(openCashflowDetalle({ type, ...params }));
  };

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

      <ScalePressable
        haptic={false}
        accessibilityRole="button"
        accessibilityLabel={copy.cashflow.nMovements(monthItems.length)}
        onPress={() => openDetalle()}>
        <Card style={[styles.hero, { backgroundColor: accent }]}>
          <Text style={styles.heroLabel}>{meta.heroLabel}</Text>
          <Text
            style={styles.heroValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}>
            {money(total)}
          </Text>
          <View style={styles.heroMeta}>
            <Pill tone={meta.tone}>{copy.cashflow.nMovements(monthItems.length)}</Pill>
            <Text style={styles.heroHint}>{monthLabel}</Text>
          </View>
        </Card>
      </ScalePressable>

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
            ).map((item) => (
              <ScalePressable
                key={item.key}
                haptic={false}
                accessibilityRole="button"
                accessibilityLabel={item.a11y}
                onPress={() => openDetalle({ needWant: item.key })}
                style={[
                  styles.needWantChip,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}>
                <AppIcon
                  name={item.key === 'need' ? 'cart.fill' : 'heart.fill'}
                  color={theme.muted}
                  size={16}
                />
                <Text style={[styles.needWantChipText, { color: theme.muted }]}>{item.label}</Text>
                <AppIcon name="chevron.right" color={theme.muted} size={14} />
              </ScalePressable>
            ))}
          </View>
        ) : null}
        {categories.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{meta.empty}</Text>
        ) : (
          categories.map((category) => {
            const ratio = total > 0 ? category.amount / total : 0;
            return (
              <ScalePressable
                key={category.name}
                haptic={false}
                accessibilityRole="button"
                accessibilityLabel={copy.cashflow.viewCategoryA11y(category.name)}
                onPress={() => openDetalle({ category: category.name })}
                style={styles.categoryRow}>
                <View style={[styles.categoryIcon, { backgroundColor: soft }]}>
                  <AppIcon name={category.icon} color={accent} />
                </View>
                <View style={styles.categoryCopy}>
                  <View style={uiStyles.between}>
                    <Text style={[styles.categoryName, { color: theme.text }]}>{category.name}</Text>
                    <View style={styles.categoryAmountRow}>
                      <Text style={[styles.categoryAmount, { color: theme.text }]}>
                        {money(category.amount)}
                      </Text>
                      <AppIcon name="chevron.right" color={theme.muted} size={14} />
                    </View>
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
  categoryAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
});
