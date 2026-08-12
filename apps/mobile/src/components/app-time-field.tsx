import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, useAppTheme } from '@/components/ui';
import { useLanguageStore } from '@/store/language';

type Props = {
  value: string;
  onChange: (hhmm: string) => void;
  label?: string;
  compact?: boolean;
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function normalizeHhmm(value: string) {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function formatHhmmAmPm(value: string, _locale: 'es' | 'en' = 'es') {
  const normalized = normalizeHhmm(value);
  if (!normalized) return value || '';
  const [h, m] = normalized.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function periodOf(value: string): 'am' | 'pm' {
  const normalized = normalizeHhmm(value) ?? '09:00';
  const hours = Number(normalized.slice(0, 2));
  return hours >= 12 ? 'pm' : 'am';
}

function withPeriod(value: string, period: 'am' | 'pm') {
  const normalized = normalizeHhmm(value) ?? '09:00';
  let hours = Number(normalized.slice(0, 2)) % 12;
  if (period === 'pm') hours += 12;
  const minutes = normalized.slice(3);
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function partsFromHhmm(value: string) {
  const normalized = normalizeHhmm(value) ?? '09:00';
  const hours24 = Number(normalized.slice(0, 2));
  const minutes = Number(normalized.slice(3));
  const period: 'am' | 'pm' = hours24 >= 12 ? 'pm' : 'am';
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return { hour12, minutes, period };
}

function hhmmFromParts(hour12: number, minutes: number, period: 'am' | 'pm') {
  let hours = hour12 % 12;
  if (period === 'pm') hours += 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseTypedTime(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!trimmed) return null;

  const ampm = trimmed.match(/\b(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)\b/);
  const digits = trimmed.replace(/[^\d:]/g, '');
  let hours: number | undefined;
  let minutes = 0;

  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(digits);
  if (colon) {
    hours = Number(colon[1]);
    minutes = Number(colon[2]);
  } else {
    const compact = digits.replace(':', '');
    if (!/^\d{1,4}$/.test(compact)) return null;
    if (compact.length <= 2) {
      hours = Number(compact);
      minutes = 0;
    } else if (compact.length === 3) {
      hours = Number(compact.slice(0, 1));
      minutes = Number(compact.slice(1));
    } else {
      hours = Number(compact.slice(0, 2));
      minutes = Number(compact.slice(2));
    }
  }

  if (hours == null || !Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes > 59) return null;

  if (ampm) {
    const isPm = ampm[1].startsWith('p');
    if (hours === 12) hours = isPm ? 12 : 0;
    else if (hours > 12) return null;
    else if (isPm) hours += 12;
  } else if (hours > 23) {
    return null;
  }

  hours = Math.min(23, Math.max(0, hours));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const PERIOD_IDS = ['am', 'pm'] as const;

function WheelColumn<T extends string | number>({
  values,
  selected,
  onSelect,
  format = String,
  theme,
}: {
  values: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  format?: (value: T) => string;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const settling = useRef(false);
  const selectedIndex = Math.max(0, values.indexOf(selected));
  const padding = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (settling.current) return;
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 30);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const settleToIndex = (rawY: number) => {
    if (settling.current) return;
    const index = Math.round(rawY / ITEM_HEIGHT);
    const clamped = Math.min(values.length - 1, Math.max(0, index));
    const targetY = clamped * ITEM_HEIGHT;
    const next = values[clamped];
    settling.current = true;
    if (Math.abs(rawY - targetY) > 1) {
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
    }
    if (next !== selected) onSelect(next);
    setTimeout(() => {
      settling.current = false;
    }, 180);
  };

  return (
    <View style={styles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={(event) =>
          settleToIndex(event.nativeEvent.contentOffset.y)
        }
        contentContainerStyle={{ paddingVertical: padding }}>
        {values.map((item) => {
          const active = item === selected;
          return (
            <Pressable
              key={String(item)}
              onPress={() => onSelect(item)}
              style={styles.wheelItem}>
              <Text
                style={[
                  styles.wheelItemText,
                  { color: active ? theme.text : theme.muted },
                  active && styles.wheelItemActive,
                ]}>
                {format(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TimeWheelPicker({
  value,
  onChange,
  theme,
  amLabel,
  pmLabel,
}: {
  value: string;
  onChange: (hhmm: string) => void;
  theme: ReturnType<typeof useAppTheme>;
  amLabel: string;
  pmLabel: string;
}) {
  const parts = useMemo(() => partsFromHhmm(value), [value]);

  return (
    <View style={styles.wheelWrap}>
      <View
        pointerEvents="none"
        style={[
          styles.wheelHighlight,
          { backgroundColor: theme.primarySoft, borderColor: theme.border },
        ]}
      />
      <WheelColumn
        values={HOURS_12}
        selected={parts.hour12}
        onSelect={(hour12) => onChange(hhmmFromParts(hour12, parts.minutes, parts.period))}
        theme={theme}
      />
      <Text style={[styles.wheelColon, { color: theme.text }]}>:</Text>
      <WheelColumn
        values={MINUTES}
        selected={parts.minutes}
        onSelect={(minutes) => onChange(hhmmFromParts(parts.hour12, minutes, parts.period))}
        format={(minute) => String(minute).padStart(2, '0')}
        theme={theme}
      />
      <WheelColumn
        values={PERIOD_IDS}
        selected={parts.period}
        onSelect={(period) => onChange(hhmmFromParts(parts.hour12, parts.minutes, period))}
        format={(period) => (period === 'am' ? amLabel : pmLabel)}
        theme={theme}
      />
    </View>
  );
}

export function AppTimeField({ value, onChange, label, compact = false }: Props) {
  const theme = useAppTheme();
  const locale = useLanguageStore((state) => state.locale);
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState(value);
  const display = formatHhmmAmPm(value, locale);
  const [typed, setTyped] = useState(display);
  const period = periodOf(value);
  const amLabel = locale === 'es' ? 'a. m.' : 'AM';
  const pmLabel = locale === 'es' ? 'p. m.' : 'PM';

  useEffect(() => {
    if (!typing) setTyped(formatHhmmAmPm(value, locale));
  }, [value, locale, typing]);

  useEffect(() => {
    if (open) setDraft(normalizeHhmm(value) ?? '09:00');
  }, [open, value]);

  const commitTyped = (raw = typed) => {
    const parsed = parseTypedTime(raw);
    if (!parsed) {
      setTyped(formatHhmmAmPm(value, locale));
      setTyping(false);
      return false;
    }
    onChange(parsed);
    setTyped(formatHhmmAmPm(parsed, locale));
    setTyping(false);
    Keyboard.dismiss();
    return true;
  };

  const closePicker = (apply: boolean) => {
    if (apply) {
      const next = normalizeHhmm(draft);
      if (next) onChange(next);
    }
    setOpen(false);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.block, compact && styles.blockCompact]}>
        {label ? (
          <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
        ) : null}
        <input
          type="time"
          value={normalizeHhmm(value) ?? '09:00'}
          onChange={(event) => {
            const next = normalizeHhmm(event.target.value);
            if (next) onChange(next);
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 16,
            fontWeight: 600,
            color: theme.text,
            backgroundColor: theme.surfaceSecondary,
            fontFamily: 'inherit',
            minHeight: 40,
          }}
        />
        <Text style={[styles.webHint, { color: theme.muted }]}>{display}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.block, compact && styles.blockCompact]}>
      {label ? (
        <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `Elegir ${label}` : 'Elegir hora'}
        onPress={() => {
          Keyboard.dismiss();
          setTyping(false);
          setOpen(true);
        }}
        style={[
          styles.selector,
          {
            backgroundColor: theme.surfaceSecondary,
            borderColor: theme.border,
          },
        ]}>
        <AppIcon name="clock" color={theme.primary} size={18} />
        <Text style={[styles.selectorValue, { color: theme.text }]} numberOfLines={1}>
          {display || (locale === 'es' ? 'Elegir hora' : 'Pick time')}
        </Text>
        <AppIcon name="chevron.down" color={theme.muted} size={14} />
      </Pressable>

      <View style={styles.periodRow}>
        {(['am', 'pm'] as const).map((item) => {
          const selectedPeriod = period === item;
          return (
            <Pressable
              key={item}
              onPress={() => onChange(withPeriod(value, item))}
              style={[
                styles.periodChip,
                compact && styles.periodChipCompact,
                {
                  borderColor: selectedPeriod ? theme.primary : theme.border,
                  backgroundColor: selectedPeriod
                    ? theme.primarySoft
                    : theme.surfaceSecondary,
                },
              ]}>
              <Text
                style={{
                  color: selectedPeriod ? theme.primary : theme.text,
                  fontWeight: '700',
                  fontSize: compact ? 11 : 12,
                }}>
                {item === 'am' ? amLabel : pmLabel}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setTyping(true);
            setTyped(formatHhmmAmPm(value, locale));
          }}
          style={[
            styles.periodChip,
            styles.typeChip,
            compact && styles.periodChipCompact,
            {
              borderColor: typing ? theme.primary : theme.border,
              backgroundColor: typing ? theme.primarySoft : theme.surfaceSecondary,
            },
          ]}>
          <Text
            style={{
              color: typing ? theme.primary : theme.text,
              fontWeight: '700',
              fontSize: compact ? 11 : 12,
            }}>
            {locale === 'es' ? 'Escribir' : 'Type'}
          </Text>
        </Pressable>
      </View>

      {typing ? (
        <TextInput
          autoFocus
          value={typed}
          onChangeText={setTyped}
          onBlur={() => commitTyped()}
          onSubmitEditing={() => commitTyped()}
          placeholder={locale === 'es' ? '7:30 p. m.' : '7:30 PM'}
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="done"
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.surfaceSecondary,
              borderColor: theme.border,
            },
          ]}
        />
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => closePicker(true)}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => closePicker(false)}
            accessibilityLabel="Cerrar selector de hora"
          />
          <View
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {label || (locale === 'es' ? 'Elige una hora' : 'Pick a time')}
              </Text>
              <Pressable onPress={() => closePicker(true)} style={styles.doneBtn}>
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>
                  {locale === 'es' ? 'Listo' : 'Done'}
                </Text>
              </Pressable>
            </View>
            <TimeWheelPicker
              value={draft}
              onChange={setDraft}
              theme={theme}
              amLabel={amLabel}
              pmLabel={pmLabel}
            />
            <Text style={[styles.pickerHint, { color: theme.muted }]}>
              {formatHhmmAmPm(draft, locale)}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flex: 1, gap: 6 },
  blockCompact: { minWidth: 0 },
  label: { fontSize: 12, fontWeight: '700' },
  selector: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorValue: { flex: 1, fontSize: 16, fontWeight: '700' },
  periodRow: { flexDirection: 'row', gap: 6 },
  periodChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodChipCompact: {
    minHeight: 28,
    paddingHorizontal: 8,
  },
  typeChip: { flexGrow: 1 },
  input: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  webHint: { fontSize: 12, fontWeight: '600' },
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
    zIndex: 2,
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
  pickerHint: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  wheelWrap: {
    height: WHEEL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  wheelHighlight: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wheelColumn: {
    flex: 1,
    height: WHEEL_HEIGHT,
  },
  wheelColon: {
    fontSize: 22,
    fontWeight: '700',
    marginHorizontal: 2,
    marginBottom: 2,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontSize: 18,
    fontWeight: '600',
  },
  wheelItemActive: {
    fontSize: 22,
    fontWeight: '800',
  },
});
