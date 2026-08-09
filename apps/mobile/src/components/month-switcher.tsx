import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, useAppTheme } from '@/components/ui';
import { usePeriodStore } from '@/store/period';

export function MonthSwitcher({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  const label = usePeriodStore((state) => state.label);
  const isCurrentMonth = usePeriodStore((state) => state.isCurrentMonth);
  const goPrevMonth = usePeriodStore((state) => state.goPrevMonth);
  const goNextMonth = usePeriodStore((state) => state.goNextMonth);
  const goToCurrentMonth = usePeriodStore((state) => state.goToCurrentMonth);

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
        onPress={goPrevMonth}
        hitSlop={10}
        style={[styles.arrow, { backgroundColor: theme.surfaceSecondary }]}>
        <AppIcon name="arrow.left" color={theme.text} size={16} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isCurrentMonth ? `Mes actual ${label}` : `Ir al mes actual. Estás en ${label}`
        }
        onPress={goToCurrentMonth}
        style={styles.labelPress}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {!isCurrentMonth ? (
          <Text style={[styles.hint, { color: theme.primary }]}>Ir a este mes</Text>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
        onPress={goNextMonth}
        hitSlop={10}
        style={[styles.arrow, { backgroundColor: theme.surfaceSecondary }]}>
        <AppIcon name="chevron" color={theme.text} size={16} />
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
    minHeight: 44,
  },
  compact: { minHeight: 40 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelPress: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  hint: { fontSize: 11, fontWeight: '600' },
});
