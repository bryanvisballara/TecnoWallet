import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon, useAppTheme } from '@/components/ui';
import {
  buildMonthMatrix,
  formatDayLabel,
  formatMonthTitle,
  parseDateKey,
  toDateKey,
  weekDayLabels,
} from '@/data/calendar';
import { useLanguageStore } from '@/store/language';

type Props = {
  value: string;
  onChange: (next: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: boolean;
  placeholder?: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function safeParse(value: string, fallback = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = parseDateKey(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDisabled(date: Date, minimumDate?: Date, maximumDate?: Date) {
  const day = startOfDay(date).getTime();
  if (minimumDate && day < startOfDay(minimumDate).getTime()) return true;
  if (maximumDate && day > startOfDay(maximumDate).getTime()) return true;
  return false;
}

/**
 * Pure-JS date field. Avoids @react-native-community/datetimepicker `display="inline"`,
 * which renders an empty sheet in our Expo/iOS build (same class of bug as AppTimeField).
 */
export function AppDateField({
  value,
  onChange,
  minimumDate,
  maximumDate,
  error = false,
  placeholder = 'Elegir fecha',
}: Props) {
  const theme = useAppTheme();
  const locale = useLanguageStore((state) => state.locale);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => safeParse(value), [value]);
  const [anchor, setAnchor] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const label = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return formatDayLabel(selected, locale);
  }, [value, selected, locale]);

  const weekLabels = useMemo(() => weekDayLabels(0, locale === 'es' ? 'es' : 'en'), [locale]);
  const matrix = useMemo(() => buildMonthMatrix(anchor, 0), [anchor]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const openPicker = () => {
    setAnchor(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setOpen(true);
  };

  const apply = (date: Date) => {
    if (isDisabled(date, minimumDate, maximumDate)) return;
    onChange(toDateKey(date));
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrap}>
        <input
          type="date"
          value={value}
          min={minimumDate ? toDateKey(minimumDate) : undefined}
          max={maximumDate ? toDateKey(maximumDate) : undefined}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: `${error ? 1.5 : 1}px solid ${error ? theme.danger : theme.border}`,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 15,
            color: theme.text,
            backgroundColor: theme.surfaceSecondary,
            fontFamily: 'inherit',
          }}
        />
        {label ? (
          <Text style={[styles.preview, { color: theme.primary }]}>{label}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `Fecha ${label}` : placeholder}
        onPress={openPicker}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.surfaceSecondary,
            borderColor: error ? theme.danger : theme.border,
            borderWidth: error ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}>
        <AppIcon name="calendar" color={theme.primary} size={18} />
        <View style={styles.triggerCopy}>
          <Text style={[styles.triggerValue, { color: theme.text }]}>
            {label ?? placeholder}
          </Text>
          {label ? (
            <Text style={[styles.triggerMeta, { color: theme.muted }]}>{value}</Text>
          ) : null}
        </View>
        <AppIcon name="chevron.down" color={theme.muted} size={14} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {locale === 'es' ? 'Elige una fecha' : 'Pick a date'}
              </Text>
              <Pressable onPress={() => setOpen(false)} style={styles.doneBtn}>
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>
                  {locale === 'es' ? 'Listo' : 'Done'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.monthNav}>
              <Pressable
                accessibilityLabel={locale === 'es' ? 'Mes anterior' : 'Previous month'}
                onPress={() =>
                  setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                style={[styles.navBtn, { backgroundColor: theme.surfaceSecondary }]}>
                <AppIcon name="arrow.left" color={theme.text} size={18} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: theme.text }]}>
                {formatMonthTitle(anchor, locale === 'es' ? 'es' : 'en')} {anchor.getFullYear()}
              </Text>
              <Pressable
                accessibilityLabel={locale === 'es' ? 'Mes siguiente' : 'Next month'}
                onPress={() =>
                  setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                style={[styles.navBtn, { backgroundColor: theme.surfaceSecondary }]}>
                <AppIcon name="arrow.right" color={theme.text} size={18} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {weekLabels.map((day) => (
                <Text key={day} style={[styles.weekLabel, { color: theme.muted }]}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {matrix.map((cell) => {
                const selectedDay = isSameDay(cell.date, selected);
                const isToday = isSameDay(cell.date, today);
                const disabled = isDisabled(cell.date, minimumDate, maximumDate);
                const muted = !cell.inMonth || disabled;
                return (
                  <Pressable
                    key={cell.key}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedDay, disabled }}
                    accessibilityLabel={cell.key}
                    onPress={() => apply(cell.date)}
                    style={styles.dayCell}>
                    <View
                      style={[
                        styles.dayBubble,
                        selectedDay ? { backgroundColor: theme.primary } : null,
                        !selectedDay && isToday
                          ? { borderColor: theme.primary, borderWidth: 1.5 }
                          : null,
                      ]}>
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: selectedDay
                              ? '#FFFFFF'
                              : muted
                                ? theme.muted
                                : theme.text,
                            opacity: muted && !selectedDay ? 0.45 : 1,
                            fontWeight: selectedDay || isToday ? '700' : '500',
                          },
                        ]}>
                        {cell.date.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  webWrap: { gap: 8 },
  trigger: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  triggerCopy: { flex: 1, gap: 2 },
  triggerValue: { fontSize: 15, fontWeight: '700' },
  triggerMeta: { fontSize: 12 },
  preview: { fontSize: 13, fontWeight: '700' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 28,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  doneBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 15,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
