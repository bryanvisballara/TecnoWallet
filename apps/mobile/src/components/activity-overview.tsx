import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDateField } from '@/components/app-date-field';
import { CategoryDonut } from '@/components/category-donut';
import { WeeklyBars, type WeeklyMode } from '@/components/charts';
import { Card, SectionTitle, useAppTheme } from '@/components/ui';
import { money, type Envelope, type Transaction } from '@/data/demo';
import { parseDateKey, toDateKey } from '@/data/calendar';
import { useAppCopy } from '@/i18n/app-copy';
import {
  buildExpenseSlices,
  buildPeriodBuckets,
  filterTransactionsByRange,
  periodRange,
  startOfWeekMonday,
  type ActivityPeriod,
} from '@/lib/activity-breakdown';
import { parseTransactionDate } from '@/lib/dates';
import { useLanguageStore } from '@/store/language';

const MODE_OPTIONS: Array<{ key: WeeklyMode; label: string }> = [
  { key: 'expenses', label: 'Gastos' },
  { key: 'income', label: 'Ingresos' },
  { key: 'both', label: 'Ambos' },
];

type Props = {
  transactions: Transaction[];
  envelopes: Envelope[];
  year: number;
  month: number;
  weekAnchor: Date;
  resetKey: string;
  hidden?: boolean;
  currency: string;
};

export function ActivityOverview({
  transactions,
  envelopes,
  year,
  month,
  weekAnchor,
  resetKey,
  hidden,
  currency,
}: Props) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const [period, setPeriod] = useState<ActivityPeriod>('week');
  const [mode, setMode] = useState<WeeklyMode>('expenses');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  const [fromKey, setFromKey] = useState(() => toDateKey(startOfWeekMonday(weekAnchor)));
  const [toKey, setToKey] = useState(() => toDateKey(weekAnchor));

  useEffect(() => {
    setWeekOffset(0);
    setFromKey(toDateKey(startOfWeekMonday(weekAnchor)));
    setToKey(toDateKey(weekAnchor));
  }, [resetKey, weekAnchor]);

  const shiftedWeek = useMemo(() => {
    const anchor = new Date(weekAnchor);
    anchor.setDate(anchor.getDate() + weekOffset * 7);
    return anchor;
  }, [weekAnchor, weekOffset]);

  const customFrom = useMemo(() => parseDateKey(fromKey), [fromKey]);
  const customTo = useMemo(() => parseDateKey(toKey), [toKey]);

  const range = useMemo(
    () =>
      periodRange({
        period,
        weekAnchor: shiftedWeek,
        year,
        month,
        customFrom,
        customTo,
      }),
    [period, shiftedWeek, year, month, customFrom, customTo],
  );

  const ranged = useMemo(
    () => filterTransactionsByRange(transactions, range.start, range.end),
    [transactions, range.start, range.end],
  );
  const slices = useMemo(() => buildExpenseSlices(ranged, envelopes), [ranged, envelopes]);
  const expenseTotal = useMemo(
    () => slices.reduce((sum, item) => sum + item.amount, 0),
    [slices],
  );
  const buckets = useMemo(
    () => (period === 'week' ? [] : buildPeriodBuckets(ranged, range.start, range.end, locale)),
    [period, ranged, range.start, range.end, locale],
  );
  const maxBar = useMemo(() => {
    if (mode === 'both') {
      return Math.max(...buckets.flatMap((item) => [item.expenseTotal, item.income]), 1);
    }
    if (mode === 'income') {
      return Math.max(...buckets.map((item) => item.income), 1);
    }
    return Math.max(...buckets.map((item) => item.expenseTotal), 1);
  }, [buckets, mode]);
  const selectedBucket =
    buckets.find((item) => item.key === selectedBucketKey) ?? buckets[buckets.length - 1] ?? null;

  useEffect(() => {
    if (!buckets.length) {
      setSelectedBucketKey(null);
      return;
    }
    setSelectedBucketKey((current) =>
      current && buckets.some((item) => item.key === current) ? current : buckets[buckets.length - 1].key,
    );
  }, [buckets]);

  const selectedBucketTxs = useMemo(() => {
    if (!selectedBucket) return [];
    const today = new Date();
    return ranged
      .filter((tx) => {
        const at = parseTransactionDate(tx, today);
        return at >= selectedBucket.start && at < selectedBucket.end;
      })
      .filter((tx) => {
        if (mode === 'income') return tx.amount >= 0;
        if (mode === 'expenses') return tx.amount < 0;
        return true;
      })
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [ranged, selectedBucket, mode]);

  const selectedBucketAmount = selectedBucket
    ? mode === 'income'
      ? selectedBucket.income
      : mode === 'expenses'
        ? selectedBucket.expenseTotal
        : selectedBucket.income - selectedBucket.expenseTotal
    : 0;

  const title =
    period === 'month'
      ? copy.home.monthlyActivity
      : period === 'custom'
        ? copy.home.rangeActivity
        : copy.home.weeklyActivity;

  const chips: Array<{ key: ActivityPeriod; label: string }> = [
    { key: 'week', label: copy.home.periodWeek },
    { key: 'month', label: copy.home.periodMonth },
    { key: 'custom', label: copy.home.periodDates },
  ];

  return (
    <View style={styles.block}>
      <SectionTitle>{title}</SectionTitle>
      <View style={styles.chips}>
        {chips.map((item) => {
          const active = period === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setPeriod(item.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}>
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.muted }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {period === 'custom' ? (
        <View style={styles.dates}>
          <View style={styles.dateField}>
            <Text style={[styles.dateLabel, { color: theme.muted }]}>{copy.home.dateFrom}</Text>
            <AppDateField
              value={fromKey}
              onChange={(next) => {
                setFromKey(next);
                if (next > toKey) setToKey(next);
              }}
              maximumDate={new Date()}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={[styles.dateLabel, { color: theme.muted }]}>{copy.home.dateTo}</Text>
            <AppDateField
              value={toKey}
              onChange={(next) => {
                setToKey(next);
                if (next < fromKey) setFromKey(next);
              }}
              minimumDate={customFrom}
              maximumDate={new Date()}
            />
          </View>
        </View>
      ) : null}

      <Card>
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

        {period === 'week' ? (
          <WeeklyBars
            transactions={transactions}
            today={weekAnchor}
            resetKey={resetKey}
            weekOffset={weekOffset}
            onWeekOffsetChange={setWeekOffset}
            mode={mode}
            onModeChange={setMode}
            hideModeRow
          />
        ) : (
          <View style={styles.monthBars}>
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
            <View style={styles.barsRow}>
              {buckets.map((bucket) => {
                const active = bucket.key === selectedBucket?.key;
                if (mode === 'both') {
                  const expenseHeight =
                    bucket.expenseTotal <= 0
                      ? 8
                      : Math.max(16, Math.round((bucket.expenseTotal / maxBar) * 90));
                  const incomeHeight =
                    bucket.income <= 0 ? 8 : Math.max(16, Math.round((bucket.income / maxBar) * 90));
                  return (
                    <Pressable
                      key={bucket.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedBucketKey(bucket.key)}
                      style={styles.barHit}>
                      <View style={styles.barTrack}>
                        <View style={styles.dualBars}>
                          <View
                            style={[
                              styles.dualBar,
                              {
                                height: expenseHeight,
                                backgroundColor: active ? theme.danger : `${theme.danger}55`,
                                opacity: bucket.expenseTotal <= 0 ? 0.28 : 1,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.dualBar,
                              {
                                height: incomeHeight,
                                backgroundColor: active ? theme.success : `${theme.success}55`,
                                opacity: bucket.income <= 0 ? 0.28 : 1,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.barLabel,
                          { color: active ? theme.primary : theme.muted, fontWeight: active ? '800' : '600' },
                        ]}
                        numberOfLines={1}>
                        {bucket.label}
                      </Text>
                    </Pressable>
                  );
                }
                const amount = mode === 'income' ? bucket.income : bucket.expenseTotal;
                const height = amount <= 0 ? 8 : Math.max(16, Math.round((amount / maxBar) * 90));
                const color = mode === 'income' ? theme.success : theme.primary;
                return (
                  <Pressable
                    key={bucket.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedBucketKey(bucket.key)}
                    style={styles.barHit}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height,
                            backgroundColor: active
                              ? color
                              : mode === 'income'
                                ? theme.successSoft
                                : theme.primarySoft,
                            opacity: amount <= 0 ? 0.28 : 1,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barLabel,
                        { color: active ? color : theme.muted, fontWeight: active ? '800' : '600' },
                      ]}
                      numberOfLines={1}>
                      {bucket.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedBucket ? (
              <View style={[styles.bucketPanel, { backgroundColor: theme.surfaceSecondary }]}>
                <View style={styles.bucketHeader}>
                  <View style={styles.bucketCopy}>
                    <Text style={[styles.bucketTitle, { color: theme.text }]}>
                      {selectedBucket.fullLabel}
                    </Text>
                    <Text style={[styles.bucketSubtitle, { color: theme.muted }]}>
                      {selectedBucketTxs.length === 0
                        ? mode === 'income'
                          ? 'Sin ingresos'
                          : mode === 'expenses'
                            ? 'Sin gastos'
                            : 'Sin movimientos'
                        : `${selectedBucketTxs.length} movimiento${selectedBucketTxs.length === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.bucketTotal,
                      {
                        color:
                          mode === 'income'
                            ? selectedBucket.income > 0
                              ? theme.success
                              : theme.muted
                            : mode === 'expenses'
                              ? selectedBucket.expenseTotal > 0
                                ? theme.danger
                                : theme.muted
                              : theme.text,
                      },
                    ]}>
                    {mode === 'both' && selectedBucketAmount > 0 ? '+' : ''}
                    {money(selectedBucketAmount)}
                  </Text>
                </View>
                {selectedBucketTxs.slice(0, 4).map((tx) => (
                  <View key={tx.id} style={styles.bucketRow}>
                    <Text numberOfLines={1} style={[styles.bucketRowTitle, { color: theme.text }]}>
                      {tx.title}
                    </Text>
                    <Text
                      style={[
                        styles.bucketRowAmount,
                        { color: tx.amount >= 0 ? theme.success : theme.text },
                      ]}>
                      {tx.amount > 0 ? '+' : ''}
                      {money(tx.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
        <View style={[styles.donutWrap, { borderTopColor: theme.border }]}>
          <CategoryDonut
            slices={slices}
            total={expenseTotal}
            currency={currency}
            label={copy.home.expenses}
            hidden={hidden}
            detailLabel={copy.home.viewBreakdown}
            onDetail={() =>
              router.push({ pathname: '/(tabs)/cashflow/[type]', params: { type: 'gastos' } })
            }
            emptyLabel={copy.home.noExpensesInPeriod}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  dates: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, minWidth: 0, gap: 6 },
  dateLabel: { fontSize: 12, fontWeight: '600' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
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
  monthBars: { paddingBottom: 4, gap: 12 },
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
  barHit: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: {
    height: 96,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: { width: 22, borderRadius: 11, maxWidth: '70%' },
  dualBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: '100%',
  },
  dualBar: { width: 10, borderRadius: 6 },
  barLabel: { width: '100%', textAlign: 'center', fontSize: 11, fontWeight: '600' },
  bucketPanel: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  bucketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bucketCopy: { flex: 1, minWidth: 0 },
  bucketTitle: { fontSize: 15, fontWeight: '700' },
  bucketSubtitle: { fontSize: 11, marginTop: 2 },
  bucketTotal: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bucketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 },
  bucketRowTitle: { flex: 1, fontSize: 13, fontWeight: '600' },
  bucketRowAmount: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  donutWrap: {
    marginTop: 12,
    paddingTop: 18,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
