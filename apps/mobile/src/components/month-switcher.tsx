import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import { formatMonthLabel } from '@/lib/dates';
import { useLanguageStore } from '@/store/language';
import { usePeriodStore } from '@/store/period';

export function MonthSwitcher({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const isCurrentMonth = usePeriodStore((state) => state.isCurrentMonth);
  const goPrevMonth = usePeriodStore((state) => state.goPrevMonth);
  const goNextMonth = usePeriodStore((state) => state.goNextMonth);
  const goToCurrentMonth = usePeriodStore((state) => state.goToCurrentMonth);
  const label = formatMonthLabel({ year, month }, 'long', locale);

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.common.prevMonth}
        onPress={goPrevMonth}
        hitSlop={10}
        style={[styles.arrow, { backgroundColor: theme.surfaceSecondary }]}>
        <AppIcon name="arrow.left" color={theme.text} size={16} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isCurrentMonth
            ? `${copy.common.currentMonth} ${label}`
            : `${copy.common.goToCurrentMonth}. ${label}`
        }
        onPress={goToCurrentMonth}
        style={styles.labelPress}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {!isCurrentMonth ? (
          <Text style={[styles.hint, { color: theme.primary }]}>
            {copy.common.goToCurrentMonth}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.common.nextMonth}
        onPress={goNextMonth}
        hitSlop={10}
        style={[styles.arrow, { backgroundColor: theme.surfaceSecondary }]}>
        <AppIcon name="arrow.right" color={theme.text} size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  compact: { marginBottom: 0 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelPress: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 11, fontWeight: '600' },
});
