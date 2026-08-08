import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, ProgressBar, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useFinanceStore } from '@/store/finance';
import { useActiveLedger } from '@/store/ledger';

type CashflowType = 'ingresos' | 'gastos';

const copy: Record<CashflowType, {
  title: string;
  subtitle: string;
  heroLabel: string;
  empty: string;
  add: string;
  tone: 'green' | 'orange';
}> = {
  ingresos: {
    title: 'Ingresos',
    subtitle: 'Entradas de este mes',
    heroLabel: 'Total ingresado',
    empty: 'Aún no hay ingresos registrados.',
    add: 'Registrar ingreso',
    tone: 'green',
  },
  gastos: {
    title: 'Gastos',
    subtitle: 'Salidas de este mes',
    heroLabel: 'Total gastado',
    empty: 'Aún no hay gastos registrados.',
    add: 'Registrar gasto',
    tone: 'orange',
  },
};

export default function CashflowDetailScreen() {
  const theme = useAppTheme();
  const { type: raw = 'gastos' } = useLocalSearchParams<{ type: string }>();
  const type: CashflowType = raw === 'ingresos' ? 'ingresos' : 'gastos';
  const meta = copy[type];
  const { summary, ledger } = useActiveLedger();
  const transactions = useFinanceStore((state) => state.transactions);

  const items = useMemo(
    () => transactions.filter((item) => (type === 'ingresos' ? item.amount > 0 : item.amount < 0)),
    [transactions, type],
  );

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [items],
  );

  const categories = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; icon: string }>();
    items.forEach((item) => {
      const current = map.get(item.category) ?? { name: item.category, amount: 0, icon: item.icon };
      current.amount += Math.abs(item.amount);
      map.set(item.category, current);
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [items]);

  const heroTotal = type === 'ingresos' ? summary.income : summary.expenses;
  const accent = type === 'ingresos' ? theme.success : theme.danger;
  const soft = type === 'ingresos' ? theme.successSoft : '#FDECEC';

  return (
    <Screen
      title={meta.title}
      subtitle={`${meta.subtitle} · ${ledger.name}`}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={[styles.hero, { backgroundColor: accent }]}>
        <Text style={styles.heroLabel}>{meta.heroLabel}</Text>
        <Text style={styles.heroValue}>{money(heroTotal || total)}</Text>
        <View style={styles.heroMeta}>
          <Pill tone={meta.tone}>{items.length} movimientos</Pill>
          <Text style={styles.heroHint}>Agosto 2026</Text>
        </View>
      </Card>

      <Card>
        <Text style={[styles.section, { color: theme.text }]}>Por categoría</Text>
        {categories.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{meta.empty}</Text>
        ) : (
          categories.map((category) => {
            const ratio = total > 0 ? category.amount / total : 0;
            return (
              <View key={category.name} style={styles.categoryRow}>
                <View style={[styles.categoryIcon, { backgroundColor: soft }]}>
                  <AppIcon name={category.icon} color={accent} />
                </View>
                <View style={styles.categoryCopy}>
                  <View style={uiStyles.between}>
                    <Text style={[styles.categoryName, { color: theme.text }]}>{category.name}</Text>
                    <Text style={[styles.categoryAmount, { color: theme.text }]}>{money(category.amount)}</Text>
                  </View>
                  <ProgressBar value={ratio} color={accent} label={`${category.name} ${Math.round(ratio * 100)}%`} />
                  <Text style={[styles.categoryShare, { color: theme.muted }]}>{Math.round(ratio * 100)}% del total</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Text style={[styles.section, { color: theme.text }]}>Movimientos</Text>
      <Card style={styles.listCard}>
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>{meta.empty}</Text>
        ) : (
          items.map((item, index) => (
            <View
              key={item.id}
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
                  {item.category} · {item.account} · {item.date}
                </Text>
              </View>
              <Text style={[styles.rowAmount, { color: type === 'ingresos' ? theme.success : theme.text }]}>
                {type === 'ingresos' ? '+' : ''}{money(item.amount)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <PrimaryButton icon="plus" onPress={() => router.push('/add-transaction')}>
        {meta.add}
      </PrimaryButton>

      <ScalePressable onPress={() => router.push('/(tabs)/movimientos')}>
        <Text style={[styles.link, { color: theme.primary }]}>Ver todos los movimientos</Text>
      </ScalePressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 10 },
  heroLabel: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroHint: { color: '#FFFFFFCC', fontSize: 12 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  empty: { fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  categoryRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  categoryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  categoryCopy: { flex: 1, gap: 6 },
  categoryName: { fontSize: 14, fontWeight: '600' },
  categoryAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  categoryShare: { fontSize: 11 },
  listCard: { paddingVertical: 4 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 11, lineHeight: 15 },
  rowAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
});
