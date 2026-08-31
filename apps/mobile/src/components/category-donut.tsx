import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import type { CategorySlice } from '@/lib/activity-breakdown';
import { moneyAmount } from '@/data/demo';
import { useAppTheme } from '@/components/ui';

export function CategoryDonut({
  slices,
  total,
  currency,
  label,
  hidden,
  detailLabel,
  onDetail,
  emptyLabel,
}: {
  slices: CategorySlice[];
  total: number;
  currency: string;
  label: string;
  hidden?: boolean;
  detailLabel?: string;
  onDetail?: () => void;
  emptyLabel: string;
}) {
  const theme = useAppTheme();
  const size = 168;
  const radius = 62;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.wrap}>
      {detailLabel && onDetail ? (
        <Pressable
          accessibilityRole="button"
          onPress={onDetail}
          style={styles.detailBtn}
          hitSlop={8}>
          <Text style={[styles.detail, { color: theme.primary }]}>{detailLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View
          accessible
          accessibilityLabel={`${label} ${hidden ? '' : moneyAmount(total)} ${currency}`}
          style={styles.chartCol}>
          <View style={[styles.donut, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox="0 0 168 168">
              <G transform="rotate(-90 84 84)">
                <Circle
                  cx="84"
                  cy="84"
                  r={radius}
                  fill="none"
                  stroke={theme.surfaceSecondary}
                  strokeWidth={stroke}
                />
                {slices.map((slice) => {
                  const dash = Math.max(2, slice.pct * circumference);
                  const gap = Math.max(0, circumference - dash);
                  const current = offset;
                  offset += dash;
                  return (
                    <Circle
                      key={slice.name}
                      cx="84"
                      cy="84"
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={stroke}
                      strokeLinecap="butt"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeDashoffset={-current}
                    />
                  );
                })}
              </G>
            </Svg>
          </View>
          <View style={styles.totals}>
            <Text style={[styles.kicker, { color: theme.muted }]}>{label}</Text>
            <Text
              style={[styles.amount, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}>
              {hidden ? '••••' : moneyAmount(total, true)}
            </Text>
            <Text style={[styles.currency, { color: theme.muted }]}>{currency}</Text>
          </View>
        </View>
        <View style={styles.legend}>
          {slices.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>{emptyLabel}</Text>
          ) : (
            slices.map((slice) => (
              <View key={slice.name} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: slice.color }]} />
                <Text numberOfLines={1} style={[styles.legendName, { color: theme.text }]}>
                  {slice.name}
                </Text>
                <Text style={[styles.legendPct, { color: theme.muted }]}>
                  {Math.round(slice.pct * 100)}%
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 6 },
  detailBtn: { alignSelf: 'flex-end' },
  detail: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, minHeight: 220 },
  chartCol: { width: 168, alignItems: 'center', gap: 10 },
  donut: { alignItems: 'center', justifyContent: 'center' },
  totals: { alignItems: 'center', gap: 2, paddingBottom: 4 },
  kicker: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  amount: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  currency: { fontSize: 13, lineHeight: 16, fontWeight: '700' },
  legend: { flex: 1, minWidth: 0, gap: 10, paddingTop: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, fontSize: 13, fontWeight: '600' },
  legendPct: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { fontSize: 13, lineHeight: 18 },
});
