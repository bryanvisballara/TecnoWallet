import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import {
  calendarColors,
  formatDayLabel,
  parseDateKey,
  toDateKey,
  typeIcons,
  typeLabels,
  type CalendarItemType,
} from '@/data/calendar';
import { useCalendarStore } from '@/store/calendar';

const colors = ['#0878F9', '#7F56D9', '#12B76A', '#F79009', '#F5C518', '#EE46BC', '#06AED4'];

export default function AddCalendarItemScreen() {
  const theme = useAppTheme();
  const addItem = useCalendarStore((state) => state.addItem);
  const params = useLocalSearchParams<{ type?: string; date?: string }>();
  const initialType = (['event', 'task', 'birthday'].includes(params.type ?? '')
    ? params.type
    : 'event') as CalendarItemType;
  const initialDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : toDateKey(new Date(2026, 7, 5));

  const [type, setType] = useState<CalendarItemType>(initialType);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(type !== 'event');
  const [dateKey, setDateKey] = useState(initialDate);
  const [color, setColor] = useState<string>(calendarColors[initialType]);
  const [reminder, setReminder] = useState('El día del evento a las 09:00');
  const [list, setList] = useState(type === 'task' ? 'Mis tareas' : 'Mi calendario');

  const dateLabel = useMemo(() => formatDayLabel(parseDateKey(dateKey)), [dateKey]);
  const titlePlaceholder = type === 'birthday' ? 'Agregar nombre' : 'Agregar título';

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Falta el título', 'Escribe un nombre para esta entrada.');
      return;
    }
    addItem({
      type,
      title: title.trim(),
      date: dateKey,
      allDay: type === 'birthday' ? true : allDay,
      startHour: allDay || type === 'birthday' ? undefined : 10,
      endHour: allDay || type === 'birthday' ? undefined : 11,
      color,
      notes: notes.trim() || undefined,
      location: location.trim() || undefined,
      reminder,
      list,
      completed: false,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.handle} />
          <ScalePressable onPress={() => void save()} style={[styles.save, { backgroundColor: theme.primary }]}>
            <Text style={styles.saveText}>Guardar</Text>
          </ScalePressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={titlePlaceholder}
            placeholderTextColor={theme.muted}
            style={[styles.titleInput, { color: theme.text }]}
            autoFocus
          />

          <View style={styles.typeRow}>
            {([
              { key: 'event' as const, label: 'Evento' },
              { key: 'task' as const, label: 'Tarea' },
              { key: 'birthday' as const, label: 'Cumpleaños' },
            ]).map((item) => {
              const active = type === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setType(item.key);
                    setColor(calendarColors[item.key]);
                    setAllDay(item.key !== 'event');
                    setList(item.key === 'task' ? 'Mis tareas' : 'Mi calendario');
                  }}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? theme.primarySoft : theme.surface,
                      borderColor: active ? theme.primarySoft : theme.border,
                    },
                  ]}>
                  <Text style={[styles.typeChipText, { color: active ? theme.primary : theme.text }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Row icon={typeIcons[type]}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{typeLabels[type]}</Text>
          </Row>

          {type !== 'birthday' ? (
            <Row icon="clock">
              <Text style={[styles.rowLabel, { color: theme.text }]}>Todo el día</Text>
              <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: theme.primary }} />
            </Row>
          ) : null}

          <Row icon="calendar">
            <Text style={[styles.rowValue, { color: theme.text }]}>{dateLabel}</Text>
            <Pressable
              onPress={() => {
                const next = parseDateKey(dateKey);
                next.setDate(next.getDate() + 1);
                setDateKey(toDateKey(next));
              }}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>+1 día</Text>
            </Pressable>
          </Row>

          {type === 'event' || type === 'task' ? (
            <Row icon="repeat">
              <Text style={[styles.rowValue, { color: theme.text }]}>No se repite</Text>
              <AppIcon name="chevron" color={theme.muted} size={14} />
            </Row>
          ) : null}

          {type === 'task' ? (
            <Row icon="target">
              <Text style={[styles.rowValue, { color: theme.muted }]}>Agregar fecha límite</Text>
            </Row>
          ) : null}

          <Row icon="person.crop.circle">
            <View style={styles.flex}>
              <Text style={[styles.rowValue, { color: theme.text }]}>Alex Rivera</Text>
              <Text style={[styles.rowHint, { color: theme.muted }]}>alex@tecnowallet.app</Text>
            </View>
            <AppIcon name="chevron" color={theme.muted} size={14} />
          </Row>

          <Row icon={type === 'task' ? 'line.3.horizontal.decrease' : 'calendar'}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{list}</Text>
            <AppIcon name="chevron" color={theme.muted} size={14} />
          </Row>

          {type === 'event' ? (
            <Row icon="mappin">
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Agregar ubicación"
                placeholderTextColor={theme.muted}
                style={[styles.inlineInput, { color: theme.text }]}
              />
            </Row>
          ) : null}

          <Row icon="bell">
            <View style={styles.flex}>
              <Text style={[styles.rowValue, { color: theme.text }]}>{reminder}</Text>
              <Pressable onPress={() => setReminder('1 semana antes a las 09:00')}>
                <Text style={[styles.rowHint, { color: theme.muted }]}>Agregar otra notificación</Text>
              </Pressable>
            </View>
            <AppIcon name="chevron" color={theme.muted} size={14} />
          </Row>

          <Row icon="paintbrush.fill">
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text style={[styles.rowValue, { color: theme.text }]}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatches}>
              {colors.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setColor(item)}
                  style={[
                    styles.swatchOption,
                    { backgroundColor: item, borderColor: item === color ? theme.text : 'transparent' },
                  ]}
                />
              ))}
            </ScrollView>
          </Row>

          <Row icon="doc.text.fill" last>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Agregar detalles"
              placeholderTextColor={theme.muted}
              style={[styles.inlineInput, { color: theme.text }]}
              multiline
            />
          </Row>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  children,
  last,
}: {
  icon: string;
  children: ReactNode;
  last?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.rowIcon}>
        <AppIcon name={icon} color={theme.muted} size={18} />
      </View>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D0D5DD',
  },
  save: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  content: { paddingHorizontal: 8, paddingBottom: 40 },
  titleInput: {
    fontSize: 28,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: -0.5,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeChipText: { fontSize: 13, fontWeight: '700' },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
  },
  rowIcon: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowValue: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowHint: { fontSize: 13, marginTop: 2 },
  inlineInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  swatch: { width: 18, height: 18, borderRadius: 4 },
  swatches: { gap: 8, alignItems: 'center' },
  swatchOption: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
  },
});
