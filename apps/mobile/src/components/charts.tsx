import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { money, type Transaction } from '@/data/demo';
import { parseTransactionMoment } from '@/lib/export-csv';
import { AppIcon, useAppTheme } from './ui';

export function DonutChart({ value = 0, size = 132, label = 'Disponible', amount = 0 }: {
  value?: number; size?: number; label?: string; amount?: number;
}) {
  const theme = useAppTheme();
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${Math.round(safeValue * 100)} por ciento`}
      style={[styles.donutWrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <G transform="rotate(-90 60 60)">
          <Circle cx="60" cy="60" r={radius} fill="none" stroke={theme.surfaceSecondary} strokeWidth="12" />
          <Circle
            cx="60" cy="60" r={radius} fill="none" stroke={theme.primary} strokeWidth="12"
            strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - safeValue)}
          />
        </G>
      </Svg>
      <View style={styles.donutLabel} pointerEvents="none">
        <Text style={[styles.donutAmount, { color: theme.text }]}>{money(amount, true)}</Text>
        <Text style={[styles.donutCaption, { color: theme.muted }]}>{label}</Text>
      </View>
    </View>
  );
}

export type DaySpend = {
  key: string;
  label: string;
  fullLabel: string;
  amount: number;
  expenses: Array<{ id: string; title: string; category: string; amount: number; icon: string }>;
};

const DAY_META = [
  { key: 'L', label: 'L', fullLabel: 'Lunes', jsDay: 1 },
  { key: 'M', label: 'M', fullLabel: 'Martes', jsDay: 2 },
  { key: 'X', label: 'X', fullLabel: 'Miércoles', jsDay: 3 },
  { key: 'J', label: 'J', fullLabel: 'Jueves', jsDay: 4 },
  { key: 'V', label: 'V', fullLabel: 'Viernes', jsDay: 5 },
  { key: 'S', label: 'S', fullLabel: 'Sábado', jsDay: 6 },
  { key: 'D', label: 'D', fullLabel: 'Domingo', jsDay: 0 },
] as const;

const DEMO_TODAY = new Date(2026, 7, 5, 12, 0, 0);

function startOfWeekMonday(today: Date) {
  const day = new Date(today);
  const js = day.getDay();
  const offset = js === 0 ? -6 : 1 - js;
  day.setDate(day.getDate() + offset);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function buildWeeklySpend(transactions: Transaction[], today = DEMO_TODAY): DaySpend[] {
  const weekStart = startOfWeekMonday(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const buckets = DAY_META.map((meta) => ({
    ...meta,
    amount: 0,
    expenses: [] as DaySpend['expenses'],
  }));

  transactions.forEach((tx) => {
    if (tx.amount >= 0) return;
    const { at } = parseTransactionMoment(tx, today);
    if (at < weekStart || at >= weekEnd) return;
    const bucket = buckets.find((item) => item.jsDay === at.getDay());
    if (!bucket) return;
    const spent = Math.abs(tx.amount);
    bucket.amount += spent;
    bucket.expenses.push({
      id: tx.id,
      title: tx.title,
      category: tx.category,
      amount: tx.amount,
      icon: tx.icon,
    });
  });

  return buckets.map(({ jsDay: _jsDay, ...day }) => ({
    ...day,
    expenses: day.expenses.sort((a, b) => a.amount - b.amount),
  }));
}

export function WeeklyBars({
  transactions = [],
  resetKey,
}: {
  transactions?: Transaction[];
  resetKey?: string;
}) {
  const theme = useAppTheme();
  const weekDays = useMemo(() => buildWeeklySpend(transactions), [transactions]);
  const weekTotal = useMemo(() => weekDays.reduce((sum, day) => sum + day.amount, 0), [weekDays]);
  const todayKey = (DAY_META.find((item) => item.jsDay === DEMO_TODAY.getDay())?.key ?? 'L') as DaySpend['key'];
  const [selectedKey, setSelectedKey] = useState<DaySpend['key']>(todayKey);

  useEffect(() => {
    setSelectedKey(todayKey);
  }, [resetKey, todayKey]);

  const maxAmount = useMemo(() => Math.max(...weekDays.map((day) => day.amount), 1), [weekDays]);
  const selected = weekDays.find((day) => day.key === selectedKey) ?? weekDays[0];

  return (
    <View style={styles.chart}>
      <View
        accessible
        accessibilityLabel="Gastos de esta semana. Toca una barra para ver el detalle."
        style={styles.barsRow}>
        {weekDays.map((day) => {
          const active = day.key === selectedKey;
          const height = day.amount <= 0 ? 8 : Math.max(18, Math.round((day.amount / maxAmount) * 90));
          return (
            <Pressable
              key={day.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${day.fullLabel}, ${money(day.amount)}`}
              onPress={() => setSelectedKey(day.key)}
              style={styles.barHit}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: active ? theme.primary : theme.primarySoft,
                      opacity: day.amount <= 0 ? 0.35 : 1,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.day, { color: active ? theme.primary : theme.muted, fontWeight: active ? '800' : '600' }]}>
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.dayPanel, { backgroundColor: theme.surfaceSecondary }]}>
        <View style={styles.dayHeader}>
          <View>
            <Text style={[styles.dayTitle, { color: theme.text }]}>{selected.fullLabel}</Text>
            <Text style={[styles.daySubtitle, { color: theme.muted }]}>
              {selected.expenses.length === 0
                ? 'Sin gastos este día'
                : `${selected.expenses.length} gasto${selected.expenses.length === 1 ? '' : 's'} · ${money(selected.amount)}`}
            </Text>
          </View>
          <Text style={[styles.dayTotal, { color: selected.amount > 0 ? theme.danger : theme.muted }]}>
            {money(selected.amount)}
          </Text>
        </View>

        {selected.expenses.length === 0 ? (
          <Text style={[styles.emptyDay, { color: theme.muted }]}>
            {weekTotal === 0
              ? 'Este libro aún no tiene gastos esta semana.'
              : 'No hay movimientos en este día.'}
          </Text>
        ) : (
          selected.expenses.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.expenseRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}>
              <View style={[styles.expenseIcon, { backgroundColor: theme.surface }]}>
                <AppIcon name={item.icon} color={theme.primary} size={16} />
              </View>
              <View style={styles.expenseCopy}>
                <Text style={[styles.expenseTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.expenseCategory, { color: theme.muted }]}>{item.category}</Text>
              </View>
              <Text style={[styles.expenseAmount, { color: theme.text }]}>{money(item.amount)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: { alignItems: 'center', justifyContent: 'center' },
  donutLabel: { position: 'absolute', alignItems: 'center' },
  donutAmount: { fontSize: 19, fontWeight: '700', letterSpacing: -0.5 },
  donutCaption: { fontSize: 10, marginTop: 1 },
  chart: { width: '100%', gap: 14 },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 118,
    paddingHorizontal: 2,
  },
  barHit: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    height: 96,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 22,
    borderRadius: 11,
    maxWidth: '70%',
  },
  day: { width: 28, textAlign: 'center', fontSize: 11 },
  dayPanel: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingBottom: 8,
  },
  dayTitle: { fontSize: 15, fontWeight: '700' },
  daySubtitle: { fontSize: 11, marginTop: 2 },
  dayTotal: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  emptyDay: { fontSize: 13, lineHeight: 18, paddingBottom: 12 },
  expenseRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseCopy: { flex: 1, gap: 2 },
  expenseTitle: { fontSize: 13, fontWeight: '600' },
  expenseCategory: { fontSize: 11 },
  expenseAmount: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
