import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { CategorySlice } from '@/lib/activity-breakdown';
import { moneyAmount } from '@/data/demo';
import { useAppTheme } from '@/components/ui';

const CX = 84;
const CY = 84;

function polar(radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function describeArc(radius: number, startAngle: number, endAngle: number) {
  const start = polar(radius, startAngle);
  const end = polar(radius, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

export function CategoryDonut({
  slices,
  total,
  currency,
  label,
  hidden,
  detailLabel,
  onDetail,
  emptyLabel,
  onSlicePress,
  sliceA11y,
}: {
  slices: CategorySlice[];
  total: number;
  currency: string;
  label: string;
  hidden?: boolean;
  detailLabel?: string;
  onDetail?: () => void;
  emptyLabel: string;
  onSlicePress?: (name: string) => void;
  sliceA11y?: (name: string) => string;
}) {
  const theme = useAppTheme();
  const size = 168;
  const radius = 62;
  const stroke = 22;
  let angle = 0;
  const arcs = slices.map((slice) => {
    const sweep = slice.pct * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return { ...slice, start, end, sweep };
  });

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
          accessible={!onSlicePress}
          accessibilityLabel={`${label} ${hidden ? '' : moneyAmount(total)} ${currency}`}
          style={styles.chartCol}>
          <View style={[styles.donut, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox="0 0 168 168">
              <Circle
                cx={CX}
                cy={CY}
                r={radius}
                fill="none"
                stroke={theme.surfaceSecondary}
                strokeWidth={stroke}
              />
              {arcs.map((slice) => {
                if (slice.sweep <= 0) return null;
                const a11y = sliceA11y?.(slice.name) ?? slice.name;
                if (slice.sweep >= 359.5) {
                  return (
                    <Circle
                      key={slice.name}
                      cx={CX}
                      cy={CY}
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={stroke}
                      pointerEvents="stroke"
                      onPress={onSlicePress ? () => onSlicePress(slice.name) : undefined}
                      accessibilityLabel={a11y}
                    />
                  );
                }
                return (
                  <Path
                    key={slice.name}
                    d={describeArc(radius, slice.start, slice.end)}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={stroke}
                    strokeLinecap="butt"
                    pointerEvents="stroke"
                    onPress={onSlicePress ? () => onSlicePress(slice.name) : undefined}
                    accessibilityLabel={a11y}
                  />
                );
              })}
            </Svg>
          </View>
          <View style={styles.totals} pointerEvents="none">
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
            slices.map((slice) => {
              const row = (
                <>
                  <View style={[styles.dot, { backgroundColor: slice.color }]} />
                  <Text numberOfLines={1} style={[styles.legendName, { color: theme.text }]}>
                    {slice.name}
                  </Text>
                  <Text style={[styles.legendPct, { color: theme.muted }]}>
                    {Math.round(slice.pct * 100)}%
                  </Text>
                </>
              );
              if (!onSlicePress) {
                return (
                  <View key={slice.name} style={styles.legendRow}>
                    {row}
                  </View>
                );
              }
              return (
                <Pressable
                  key={slice.name}
                  accessibilityRole="button"
                  accessibilityLabel={sliceA11y?.(slice.name) ?? slice.name}
                  onPress={() => onSlicePress(slice.name)}
                  style={({ pressed }) => [
                    styles.legendRow,
                    styles.legendHit,
                    pressed && { backgroundColor: theme.surfaceSecondary },
                  ]}>
                  {row}
                </Pressable>
              );
            })
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
  legend: { flex: 1, minWidth: 0, gap: 4, paddingTop: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendHit: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { flex: 1, fontSize: 13, fontWeight: '600' },
  legendPct: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { fontSize: 13, lineHeight: 18 },
});
