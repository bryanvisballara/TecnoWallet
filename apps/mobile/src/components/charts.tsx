import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { money, type Transaction } from '@/data/demo';
import { parseTransactionDate } from '@/lib/dates';
import { useLanguageStore } from '@/store/language';
import { AppIcon, Pill, useAppTheme } from './ui';

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

export type WeeklyMode = 'expenses' | 'income' | 'both';

export type DayActivityItem = {
  id: string;
  title: string;
  category: string;
  amount: number;
  icon: string;
};

export type DaySpend = {
  key: string;
  label: string;
  fullLabel: string;
  amount: number;
  expenses: DayActivityItem[];
  income: number;
  expenseTotal: number;
  incomeItems: DayActivityItem[];
  expenseItems: DayActivityItem[];
};

const DAY_KEYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const DAY_JS = [1, 2, 3, 4, 5, 6, 0] as const;

const WEEKDAY_LABELS_ES = [
  { label: 'L', fullLabel: 'Lunes' },
  { label: 'M', fullLabel: 'Martes' },
  { label: 'X', fullLabel: 'Miércoles' },
  { label: 'J', fullLabel: 'Jueves' },
  { label: 'V', fullLabel: 'Viernes' },
  { label: 'S', fullLabel: 'Sábado' },
  { label: 'D', fullLabel: 'Domingo' },
] as const;

const WEEKDAY_LABELS_EN = [
  { label: 'M', fullLabel: 'Monday' },
  { label: 'T', fullLabel: 'Tuesday' },
  { label: 'W', fullLabel: 'Wednesday' },
  { label: 'T', fullLabel: 'Thursday' },
  { label: 'F', fullLabel: 'Friday' },
  { label: 'S', fullLabel: 'Saturday' },
  { label: 'S', fullLabel: 'Sunday' },
] as const;

function dayMetaForLocale(locale: string = 'es') {
  const labels = locale === 'es' ? WEEKDAY_LABELS_ES : WEEKDAY_LABELS_EN;
  return DAY_JS.map((jsDay, index) => ({
    key: DAY_KEYS[index],
    jsDay,
    label: labels[index].label,
    fullLabel: labels[index].fullLabel,
  }));
}

function startOfWeekMonday(today: Date) {
  const day = new Date(today);
  const js = day.getDay();
  const offset = js === 0 ? -6 : 1 - js;
  day.setDate(day.getDate() + offset);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function buildWeeklySpend(
  transactions: Transaction[],
  today = new Date(),
  locale: string = 'es',
): DaySpend[] {
  const weekStart = startOfWeekMonday(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const dayMeta = dayMetaForLocale(locale);

  const buckets = dayMeta.map((meta) => ({
    ...meta,
    income: 0,
    expenseTotal: 0,
    incomeItems: [] as DayActivityItem[],
    expenseItems: [] as DayActivityItem[],
  }));

  transactions.forEach((tx) => {
    const at = parseTransactionDate(tx, today);
    if (at < weekStart || at >= weekEnd) return;
    const bucket = buckets.find((item) => item.jsDay === at.getDay());
    if (!bucket) return;
    const entry = {
      id: tx.id,
      title: tx.title,
      category: tx.category,
      amount: tx.amount,
      icon: tx.icon,
    };
    if (tx.amount >= 0) {
      bucket.income += tx.amount;
      bucket.incomeItems.push(entry);
    } else {
      bucket.expenseTotal += Math.abs(tx.amount);
      bucket.expenseItems.push(entry);
    }
  });

  return buckets.map(({ jsDay: _jsDay, ...day }) => ({
    ...day,
    amount: day.expenseTotal,
    expenses: day.expenseItems.sort((a, b) => a.amount - b.amount),
    incomeItems: day.incomeItems.sort((a, b) => b.amount - a.amount),
    expenseItems: day.expenseItems.sort((a, b) => a.amount - b.amount),
  }));
}

const MODE_OPTIONS: Array<{ key: WeeklyMode; label: string }> = [
  { key: 'expenses', label: 'Gastos' },
  { key: 'income', label: 'Ingresos' },
  { key: 'both', label: 'Ambos' },
];

export function WeeklyBars({
  transactions = [],
  resetKey,
  today = new Date(),
  weekOffset: weekOffsetProp,
  onWeekOffsetChange,
  mode: modeProp,
  onModeChange,
  hideModeRow = false,
}: {
  transactions?: Transaction[];
  resetKey?: string;
  today?: Date;
  weekOffset?: number;
  onWeekOffsetChange?: (value: number) => void;
  mode?: WeeklyMode;
  onModeChange?: (value: WeeklyMode) => void;
  hideModeRow?: boolean;
}) {
  const theme = useAppTheme();
  const locale = useLanguageStore((state) => state.locale);
  const [modeState, setModeState] = useState<WeeklyMode>('expenses');
  const mode = modeProp ?? modeState;
  const setMode = (value: WeeklyMode) => {
    onModeChange?.(value);
    if (modeProp === undefined) setModeState(value);
  };
  const [weekOffsetState, setWeekOffsetState] = useState(0);
  const weekOffset = weekOffsetProp ?? weekOffsetState;
  const setWeekOffset = (updater: number | ((value: number) => number)) => {
    const next = typeof updater === 'function' ? updater(weekOffset) : updater;
    onWeekOffsetChange?.(next);
    if (weekOffsetProp === undefined) setWeekOffsetState(next);
  };
  const weekAnchor = useMemo(() => {
    const anchor = new Date(today);
    anchor.setDate(anchor.getDate() + weekOffset * 7);
    return anchor;
  }, [today, weekOffset]);
  const weekDays = useMemo(
    () => buildWeeklySpend(transactions, weekAnchor, locale),
    [transactions, weekAnchor, locale],
  );
  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return locale === 'es' ? 'Esta semana' : 'This week';
    if (weekOffset === -1) return locale === 'es' ? 'Semana pasada' : 'Last week';
    if (weekOffset === 1) return locale === 'es' ? 'Próxima semana' : 'Next week';
    const start = startOfWeekMonday(weekAnchor);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-CO' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }, [weekOffset, weekAnchor, locale]);
  const todayKey = (dayMetaForLocale(locale).find((item) => item.jsDay === weekAnchor.getDay())
    ?.key ?? 'L') as DaySpend['key'];
  const [selectedKey, setSelectedKey] = useState<DaySpend['key']>(todayKey);

  useEffect(() => {
    setWeekOffset(0);
  }, [resetKey]);

  useEffect(() => {
    setSelectedKey(todayKey);
  }, [resetKey, todayKey, weekOffset]);

  const totals = useMemo(() => {
    return weekDays.reduce(
      (acc, day) => {
        acc.expenses += day.expenseTotal;
        acc.income += day.income;
        return acc;
      },
      { expenses: 0, income: 0 },
    );
  }, [weekDays]);

  const maxAmount = useMemo(() => {
    if (mode === 'both') {
      return Math.max(...weekDays.flatMap((day) => [day.expenseTotal, day.income]), 1);
    }
    if (mode === 'income') {
      return Math.max(...weekDays.map((day) => day.income), 1);
    }
    return Math.max(...weekDays.map((day) => day.expenseTotal), 1);
  }, [weekDays, mode]);

  const selected = weekDays.find((day) => day.key === selectedKey) ?? weekDays[0];
  const selectedItems =
    mode === 'income'
      ? selected.incomeItems
      : mode === 'expenses'
        ? selected.expenseItems
        : [...selected.incomeItems, ...selected.expenseItems].sort(
            (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
          );
  const selectedAmount =
    mode === 'income'
      ? selected.income
      : mode === 'expenses'
        ? selected.expenseTotal
        : selected.income - selected.expenseTotal;
  const headerAmount =
    mode === 'income' ? totals.income : mode === 'expenses' ? totals.expenses : totals.income - totals.expenses;
  const emptyWeek =
    mode === 'income' ? totals.income === 0 : mode === 'expenses' ? totals.expenses === 0 : totals.income === 0 && totals.expenses === 0;

  return (
    <View style={styles.chart}>
      {hideModeRow ? null : (
        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((item) => {
            const active = mode === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(item.key)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceSecondary,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}>
                <Text style={[styles.modeChipText, { color: active ? '#FFFFFF' : theme.muted }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.summaryHeader}>
        <View style={styles.weekNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === 'es' ? 'Semana anterior' : 'Previous week'}
            onPress={() => setWeekOffset((value) => value - 1)}
            hitSlop={10}
            style={[styles.weekArrow, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="chevron.left" color={theme.text} size={16} />
          </Pressable>
          <View style={styles.weekNavCopy}>
            <Text style={[styles.summaryLabel, { color: theme.muted }]}>{weekLabel}</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{money(headerAmount)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={locale === 'es' ? 'Semana siguiente' : 'Next week'}
            disabled={weekOffset >= 0}
            onPress={() => setWeekOffset((value) => Math.min(0, value + 1))}
            hitSlop={10}
            style={[
              styles.weekArrow,
              {
                backgroundColor: theme.surfaceSecondary,
                opacity: weekOffset >= 0 ? 0.35 : 1,
              },
            ]}>
            <AppIcon name="chevron.right" color={theme.text} size={16} />
          </Pressable>
        </View>
        <Pill
          tone={
            mode === 'income'
              ? totals.income > 0
                ? 'green'
                : 'neutral'
              : mode === 'expenses'
                ? totals.expenses > 0
                  ? 'orange'
                  : 'neutral'
                : totals.income > 0 || totals.expenses > 0
                  ? 'blue'
                  : 'neutral'
          }>
          {mode === 'income'
            ? totals.income > 0
              ? 'Ingresos'
              : 'Sin ingresos'
            : mode === 'expenses'
              ? totals.expenses > 0
                ? 'Gastos'
                : 'Sin gastos'
              : 'Gastos e ingresos'}
        </Pill>
      </View>

      {mode === 'both' ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.danger }]} />
            <Text style={[styles.legendText, { color: theme.muted }]}>Gastos</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
            <Text style={[styles.legendText, { color: theme.muted }]}>Ingresos</Text>
          </View>
        </View>
      ) : null}

      <View
        accessible
        accessibilityLabel="Actividad de esta semana. Toca una barra para ver el detalle."
        style={styles.barsRow}>
        {weekDays.map((day) => {
          const active = day.key === selectedKey;
          if (mode === 'both') {
            const expenseHeight =
              day.expenseTotal <= 0 ? 8 : Math.max(18, Math.round((day.expenseTotal / maxAmount) * 90));
            const incomeHeight =
              day.income <= 0 ? 8 : Math.max(18, Math.round((day.income / maxAmount) * 90));
            return (
              <Pressable
                key={day.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${day.fullLabel}, gastos ${money(day.expenseTotal)}, ingresos ${money(day.income)}`}
                onPress={() => setSelectedKey(day.key)}
                style={styles.barHit}>
                <View style={styles.barTrack}>
                  <View style={styles.dualBars}>
                    <View
                      style={[
                        styles.dualBar,
                        {
                          height: expenseHeight,
                          backgroundColor: active ? theme.danger : `${theme.danger}55`,
                          opacity: day.expenseTotal <= 0 ? 0.35 : 1,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.dualBar,
                        {
                          height: incomeHeight,
                          backgroundColor: active ? theme.success : `${theme.success}55`,
                          opacity: day.income <= 0 ? 0.35 : 1,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.day, { color: active ? theme.primary : theme.muted, fontWeight: active ? '800' : '600' }]}>
                  {day.label}
                </Text>
              </Pressable>
            );
          }

          const amount = mode === 'income' ? day.income : day.expenseTotal;
          const height = amount <= 0 ? 8 : Math.max(18, Math.round((amount / maxAmount) * 90));
          const color = mode === 'income' ? theme.success : theme.primary;
          return (
            <Pressable
              key={day.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${day.fullLabel}, ${money(amount)}`}
              onPress={() => setSelectedKey(day.key)}
              style={styles.barHit}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: active ? color : mode === 'income' ? theme.successSoft : theme.primarySoft,
                      opacity: amount <= 0 ? 0.35 : 1,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.day, { color: active ? color : theme.muted, fontWeight: active ? '800' : '600' }]}>
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
              {selectedItems.length === 0
                ? mode === 'income'
                  ? 'Sin ingresos este día'
                  : mode === 'expenses'
                    ? 'Sin gastos este día'
                    : 'Sin movimientos este día'
                : mode === 'both'
                  ? `${selectedItems.length} movimiento${selectedItems.length === 1 ? '' : 's'}`
                  : `${selectedItems.length} ${mode === 'income' ? 'ingreso' : 'gasto'}${selectedItems.length === 1 ? '' : 's'} · ${money(selectedAmount)}`}
            </Text>
          </View>
          <Text
            style={[
              styles.dayTotal,
              {
                color:
                  mode === 'income'
                    ? selected.income > 0
                      ? theme.success
                      : theme.muted
                    : mode === 'expenses'
                      ? selected.expenseTotal > 0
                        ? theme.danger
                        : theme.muted
                      : theme.text,
              },
            ]}>
            {mode === 'both' && selectedAmount > 0 ? '+' : ''}
            {money(selectedAmount)}
          </Text>
        </View>

        {mode === 'both' && (selected.income > 0 || selected.expenseTotal > 0) ? (
          <View style={styles.bothSplit}>
            <Text style={[styles.splitText, { color: theme.success }]}>
              +{money(selected.income, true)}
            </Text>
            <Text style={[styles.splitText, { color: theme.danger }]}>
              −{money(selected.expenseTotal, true)}
            </Text>
          </View>
        ) : null}

        {selectedItems.length === 0 ? (
          <Text style={[styles.emptyDay, { color: theme.muted }]}>
            {emptyWeek
              ? mode === 'income'
                ? 'Este libro aún no tiene ingresos esta semana.'
                : mode === 'expenses'
                  ? 'Este libro aún no tiene gastos esta semana.'
                  : 'Este libro aún no tiene movimientos esta semana.'
              : 'No hay movimientos en este día.'}
          </Text>
        ) : (
          selectedItems.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.expenseRow,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}>
              <View
                style={[
                  styles.expenseIcon,
                  { backgroundColor: item.amount >= 0 ? theme.successSoft : theme.surface },
                ]}>
                <AppIcon
                  name={item.icon}
                  color={item.amount >= 0 ? theme.success : theme.primary}
                  size={16}
                />
              </View>
              <View style={styles.expenseCopy}>
                <Text style={[styles.expenseTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.expenseCategory, { color: theme.muted }]}>{item.category}</Text>
              </View>
              <Text
                style={[
                  styles.expenseAmount,
                  { color: item.amount >= 0 ? theme.success : theme.text },
                ]}>
                {item.amount > 0 ? '+' : ''}
                {money(item.amount)}
              </Text>
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
  modeRow: { flexDirection: 'row', gap: 8 },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  weekNav: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekNavCopy: { flex: 1, minWidth: 0 },
  weekArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeChipText: { fontSize: 12, fontWeight: '700' },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  legendRow: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
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
  dualBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: '100%',
  },
  dualBar: {
    width: 10,
    borderRadius: 6,
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
  bothSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  splitText: { fontSize: 12, fontWeight: '700' },
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
