import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
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
import { formatDayLabel, parseDateKey, toDateKey } from '@/data/calendar';
import { useLanguageStore } from '@/store/language';

type Props = {
  value: string;
  onChange: (next: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: boolean;
  placeholder?: string;
};

function safeParse(value: string, fallback = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = parseDateKey(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

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
  const label = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return formatDayLabel(selected, locale);
  }, [value, selected, locale]);

  const apply = (date: Date) => {
    onChange(toDateKey(date));
  };

  const onNativeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type !== 'set' || !date) return;
      apply(date);
      return;
    }
    if (date) apply(date);
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
        onPress={() => setOpen(true)}
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

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display="calendar"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onNativeChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
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
              <DateTimePicker
                value={selected}
                mode="date"
                display="inline"
                themeVariant="light"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={onNativeChange}
                style={styles.iosPicker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  doneBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  iosPicker: { alignSelf: 'center', width: '100%' },
});
