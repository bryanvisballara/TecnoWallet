import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppTimeField, formatHhmmAmPm, normalizeHhmm } from '@/components/app-time-field';
import { focusScrollToEnd, FormScrollView } from '@/components/form-scroll-view';
import { AttachmentPreview } from '@/components/attachment-preview';
import { SheetScreen } from '@/components/sheet-screen';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import { attachmentKind, isImageAttachment } from '@/lib/open-attachment';
import {
  CALENDAR_REMINDER_CUSTOM,
  CALENDAR_REMINDER_NONE,
  calendarColors,
  calendarListOptions,
  calendarReminderOptions,
  calendarRepeatOptions,
  formatDayLabel,
  formatReminderLabel,
  hhmmFromHour,
  hourFromHhmm,
  parseDateKey,
  resolveCalendarReminderAt,
  toDateKey,
  typeIcons,
  typeLabels,
  type CalendarAttachment,
  type CalendarItemType,
} from '@/data/calendar';
import {
  scheduleCalendarReminder,
} from '@/services/push-notifications';
import { useAuthStore } from '@/store/auth';
import { useActiveCalendar, useCalendarStore } from '@/store/calendar';
import { useLanguageStore } from '@/store/language';
import { useActiveLedger } from '@/store/ledger';

const colors = ['#0878F9', '#7F56D9', '#12B76A', '#F79009', '#F5C518', '#EE46BC', '#06AED4'];

function newAttachmentId() {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pickOption(title: string, options: readonly string[], onPick: (value: string) => void) {
  Alert.alert(title, undefined, [
    ...options.map((option) => ({
      text: option,
      onPress: () => onPick(option),
    })),
    { text: 'Cancelar', style: 'cancel' as const },
  ]);
}

export default function AddCalendarItemScreen() {
  const theme = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const locale = useLanguageStore((state) => state.locale);
  const addItem = useCalendarStore((state) => state.addItem);
  const updateItem = useCalendarStore((state) => state.updateItem);
  const removeItem = useCalendarStore((state) => state.removeItem);
  const calendarItems = useCalendarStore((state) => state.items);
  const profile = useAuthStore((state) => state.profile);
  const { ledger } = useActiveLedger();
  const { calendar, activeCalendarId } = useActiveCalendar();
  const params = useLocalSearchParams<{
    type?: string;
    date?: string;
    id?: string;
    hour?: string;
  }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const existing = useMemo(
    () =>
      editId?.trim()
        ? calendarItems.find((item) => item.id === editId.trim())
        : undefined,
    [calendarItems, editId],
  );
  const isEditing = Boolean(existing);
  const hourFromParam = useMemo(() => {
    if (existing || params.hour == null) return undefined;
    const raw = Array.isArray(params.hour) ? params.hour[0] : params.hour;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 23) return undefined;
    return Math.floor(value);
  }, [existing, params.hour]);
  const initialType = (['event', 'task', 'birthday'].includes(params.type ?? '')
    ? params.type
    : existing?.type ?? 'event') as CalendarItemType;
  const initialDate =
    existing?.date && /^\d{4}-\d{2}-\d{2}$/.test(existing.date)
      ? existing.date
      : params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
        ? params.date
        : toDateKey(new Date());

  const [type, setType] = useState<CalendarItemType>(initialType);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [meetingLink, setMeetingLink] = useState(existing?.meetingLink ?? '');
  const [allDay, setAllDay] = useState(
    existing?.allDay ?? (hourFromParam != null ? false : type !== 'event'),
  );
  const [dateKey, setDateKey] = useState(initialDate);
  const [startTime, setStartTime] = useState(
    hhmmFromHour(
      existing?.startHour,
      hourFromParam != null ? hhmmFromHour(hourFromParam) : '09:00',
    ),
  );
  const [endTime, setEndTime] = useState(
    hhmmFromHour(
      existing?.endHour,
      hourFromParam != null
        ? hhmmFromHour(hourFromParam < 23 ? hourFromParam + 1 : 23 + 59 / 60)
        : '10:00',
    ),
  );
  const [color, setColor] = useState<string>(
    existing?.color ?? calendarColors[initialType],
  );
  const [reminder, setReminder] = useState<string>(
    existing?.reminder?.startsWith('A las ')
      ? CALENDAR_REMINDER_CUSTOM
      : existing?.reminder ?? calendarReminderOptions[2],
  );
  const [customReminderTime, setCustomReminderTime] = useState(
    existing?.reminder?.startsWith('A las ')
      ? existing.reminder.slice(6)
      : '13:50',
  );
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [list, setList] = useState(
    existing?.list ?? (type === 'task' ? 'Mis tareas' : 'Mi calendario'),
  );
  const [repeat, setRepeat] = useState<string>(
    existing?.repeat ?? calendarRepeatOptions[0],
  );
  const [assigneeName, setAssigneeName] = useState(
    existing?.assigneeName ?? profile.name,
  );
  const [assigneeEmail, setAssigneeEmail] = useState(
    existing?.assigneeEmail ?? profile.email,
  );
  const [attachments, setAttachments] = useState<CalendarAttachment[]>(
    existing?.attachments ?? [],
  );
  const [preview, setPreview] = useState<CalendarAttachment | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydratedEdit, setHydratedEdit] = useState(!editId);

  useEffect(() => {
    if (!editId || !existing || hydratedEdit) return;
    setType(existing.type);
    setTitle(existing.title);
    setNotes(existing.notes ?? '');
    setLocation(existing.location ?? '');
    setMeetingLink(existing.meetingLink ?? '');
    setAllDay(existing.allDay);
    setDateKey(existing.date);
    setStartTime(hhmmFromHour(existing.startHour, '09:00'));
    setEndTime(hhmmFromHour(existing.endHour, '10:00'));
    setColor(existing.color);
    if (existing.reminder?.startsWith('A las ')) {
      setReminder(CALENDAR_REMINDER_CUSTOM);
      setCustomReminderTime(existing.reminder.slice(6));
    } else {
      setReminder(existing.reminder ?? calendarReminderOptions[2]);
    }
    setList(existing.list ?? (existing.type === 'task' ? 'Mis tareas' : 'Mi calendario'));
    setRepeat(existing.repeat ?? calendarRepeatOptions[0]);
    setAssigneeName(existing.assigneeName ?? profile.name);
    setAssigneeEmail(existing.assigneeEmail ?? profile.email);
    setAttachments(existing.attachments ?? []);
    setHydratedEdit(true);
  }, [editId, existing, hydratedEdit, profile.email, profile.name]);

  const people = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    map.set(profile.email.toLowerCase(), { name: profile.name, email: profile.email });
    (ledger?.members ?? []).forEach((member) => {
      map.set(member.email.toLowerCase(), { name: member.name, email: member.email });
    });
    calendar?.members.forEach((member) => {
      map.set(member.email.toLowerCase(), { name: member.name, email: member.email });
    });
    return [...map.values()];
  }, [profile.name, profile.email, ledger?.members, calendar?.members]);

  const dateLabel = useMemo(
    () => formatDayLabel(parseDateKey(dateKey), locale),
    [dateKey, locale],
  );
  const titlePlaceholder = type === 'birthday' ? 'Agregar nombre' : 'Agregar título';
  const timed = type !== 'birthday' && !allDay;
  const reminderIsCustom =
    reminder === CALENDAR_REMINDER_CUSTOM || reminder.startsWith('A las ');
  const reminderDisplay = reminderIsCustom
    ? `A las ${normalizeHhmm(customReminderTime) ?? customReminderTime}`
    : reminder;

  const pickRepeat = () => pickOption('Repetición', calendarRepeatOptions, setRepeat);
  const pickList = () => pickOption('Lista', calendarListOptions, setList);
  const pickReminder = () => setShowReminderPicker((open) => !open);
  const selectReminder = (value: string) => {
    setReminder(value);
    if (value !== CALENDAR_REMINDER_CUSTOM && !value.startsWith('A las ')) {
      setShowReminderPicker(false);
    }
  };
  const pickAssignee = () => {
    Alert.alert('Persona', undefined, [
      ...people.map((person) => ({
        text: `${person.name} · ${person.email}`,
        onPress: () => {
          setAssigneeName(person.name);
          setAssigneeEmail(person.email);
        },
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const addAttachments = (items: CalendarAttachment[]) => {
    if (!items.length) return;
    setAttachments((prev) => [...prev, ...items]);
  };

  const pickPhoto = async (camera = false) => {
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: 6,
        });
    if (result.canceled) return;
    addAttachments(
      result.assets.map((asset, index) => ({
        id: newAttachmentId() + index,
        name: asset.fileName ?? `Foto ${attachments.length + index + 1}`,
        uri: asset.uri,
        mimeType: asset.mimeType,
        kind: 'image' as const,
      })),
    );
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    addAttachments(
      result.assets.map((asset, index) => ({
        id: newAttachmentId() + index,
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType ?? undefined,
        kind: attachmentKind(asset.name, asset.mimeType ?? undefined),
      })),
    );
  };

  const chooseAttachment = () => {
    Alert.alert('Agregar adjunto', 'Elige una foto, toma una imagen o adjunta un archivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tomar foto', onPress: () => void pickPhoto(true) },
      { text: 'Elegir foto', onPress: () => void pickPhoto(false) },
      { text: 'Archivo', onPress: () => void pickFile() },
    ]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const save = async () => {
    if (saving) return;
    if (!title.trim()) {
      Alert.alert('Falta el título', 'Escribe un nombre para esta entrada.');
      return;
    }

    const isAllDay = type === 'birthday' ? true : allDay;
    let startHour: number | undefined;
    let endHour: number | undefined;
    const startNormalized = normalizeHhmm(startTime) ?? '09:00';
    const endNormalized = normalizeHhmm(endTime) ?? '10:00';
    setStartTime(startNormalized);
    setEndTime(endNormalized);
    if (!isAllDay) {
      startHour = hourFromHhmm(startNormalized);
      endHour = hourFromHhmm(endNormalized);
      if (startHour == null || endHour == null) {
        Alert.alert('Hora inválida', 'Elige una hora de inicio y fin.');
        return;
      }
      if (endHour <= startHour) {
        Alert.alert('Hora inválida', 'La hora de fin debe ser posterior a la de inicio.');
        return;
      }
    }

    let reminderValue: string | undefined;
    if (reminder === CALENDAR_REMINDER_NONE) {
      reminderValue = undefined;
    } else if (reminderIsCustom) {
      const custom = normalizeHhmm(customReminderTime) ?? '09:00';
      setCustomReminderTime(custom);
      reminderValue = `A las ${custom}`;
    } else {
      reminderValue = reminder;
    }

    const reminderFireAt = reminderValue
      ? resolveCalendarReminderAt({
          date: dateKey,
          allDay: isAllDay,
          startHour,
          reminder: reminderValue,
        })
      : null;

    const payload = {
      type,
      title: title.trim(),
      date: dateKey,
      allDay: isAllDay,
      startHour,
      endHour,
      color,
      notes: notes.trim() || undefined,
      location: location.trim() || undefined,
      meetingLink: type === 'event' && meetingLink.trim() ? meetingLink.trim() : undefined,
      reminder: reminderValue,
      reminderAt: reminderFireAt ? reminderFireAt.toISOString() : undefined,
      reminderAtClient: reminderFireAt ? true : undefined,
      list,
      repeat: repeat === 'No se repite' ? undefined : repeat,
      assigneeName,
      assigneeEmail,
      completed: existing?.completed ?? false,
      attachments: attachments.length ? attachments : undefined,
      calendarId: existing?.calendarId ?? activeCalendarId,
    };

    setSaving(true);
    try {
      const itemId = isEditing && existing
        ? (await updateItem({ ...existing, ...payload }), existing.id)
        : await addItem(payload);

      const reminderScheduled = reminderValue
        ? await scheduleCalendarReminder({
            itemId,
            title: title.trim(),
            typeLabel: typeLabels[type],
            date: dateKey,
            allDay: isAllDay,
            startHour,
            reminder: reminderValue,
          })
        : true;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (reminderValue && !reminderScheduled && Platform.OS !== 'web') {
        Alert.alert(
          'Guardado',
          'El elemento se guardó, pero no se pudo programar el push. Revisa permisos de notificación o elige una hora futura.',
        );
      }

      safeGoBack('/(tabs)/calendario');
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!existing || saving) return;
    const run = async () => {
      setSaving(true);
      try {
        removeItem(existing.id);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        safeGoBack('/(tabs)/calendario');
      } catch (error) {
        Alert.alert(
          'No se pudo eliminar',
          error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        );
      } finally {
        setSaving(false);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`¿Eliminar «${existing.title}»?`)) void run();
      return;
    }
    Alert.alert('Eliminar', `¿Eliminar «${existing.title}» del calendario?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <SheetScreen fallback="/(tabs)/calendario">
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Cerrar" onPress={() => safeGoBack('/(tabs)/calendario')} style={styles.close}>
            <AppIcon name="xmark" color={theme.text} size={20} />
          </Pressable>
          <View style={styles.headerSpacer} />
          <ScalePressable
            onPress={saving ? undefined : () => void save()}
            style={[styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
            <Text style={styles.saveText}>{saving ? '…' : 'Guardar'}</Text>
          </ScalePressable>
        </View>

        <FormScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onFocus={focusScrollToEnd(scrollRef)}
            placeholder={titlePlaceholder}
            placeholderTextColor={theme.muted}
            style={[styles.titleInput, { color: theme.text }]}
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
                    Keyboard.dismiss();
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

          {timed ? (
            <Row icon="clock">
              <View style={styles.timeFields}>
                <AppTimeField
                  label="Inicio"
                  value={startTime}
                  onChange={setStartTime}
                />
                <AppTimeField
                  label="Fin"
                  value={endTime}
                  onChange={setEndTime}
                />
              </View>
            </Row>
          ) : null}

          {type === 'event' || type === 'task' ? (
            <Row icon="repeat" onPress={pickRepeat}>
              <Text style={[styles.rowValue, { color: theme.text }]}>{repeat}</Text>
              <AppIcon name="chevron" color={theme.muted} size={14} />
            </Row>
          ) : null}

          {type === 'task' ? (
            <Row icon="target">
              <Text style={[styles.rowValue, { color: theme.muted }]}>Agregar fecha límite</Text>
            </Row>
          ) : null}

          <Row icon="person.crop.circle" onPress={pickAssignee}>
            <View style={styles.flex}>
              <Text style={[styles.rowValue, { color: theme.text }]}>{assigneeName}</Text>
              <Text style={[styles.rowHint, { color: theme.muted }]}>{assigneeEmail}</Text>
            </View>
            <AppIcon name="chevron" color={theme.muted} size={14} />
          </Row>

          <Row
            icon={type === 'task' ? 'line.3.horizontal.decrease' : 'calendar'}
            onPress={pickList}>
            <Text style={[styles.rowValue, { color: theme.text }]}>{list}</Text>
            <AppIcon name="chevron" color={theme.muted} size={14} />
          </Row>

          {type === 'event' ? (
            <>
              <Row icon="mappin">
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  onFocus={focusScrollToEnd(scrollRef, 120)}
                  placeholder="Agregar ubicación"
                  placeholderTextColor={theme.muted}
                  style={[styles.inlineInput, { color: theme.text }]}
                />
              </Row>
              <Row icon="video.fill">
                <TextInput
                  value={meetingLink}
                  onChangeText={setMeetingLink}
                  onFocus={focusScrollToEnd(scrollRef, 120)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="Agregar link de reunión"
                  placeholderTextColor={theme.muted}
                  style={[styles.inlineInput, { color: theme.text }]}
                />
              </Row>
            </>
          ) : null}

          <Row icon="bell" onPress={pickReminder}>
            <View style={styles.flex}>
              <Text style={[styles.rowValue, { color: theme.text }]}>
                {formatReminderLabel(reminderDisplay)}
              </Text>
              <Text style={[styles.rowHint, { color: theme.muted }]}>
                {timed
                  ? `Si empieza a las ${formatHhmmAmPm(startTime, locale)}, elige minutos antes o una hora fija.`
                  : 'Toca para elegir cuándo quieres el aviso push.'}
              </Text>
            </View>
            <AppIcon
              name={showReminderPicker ? 'chevron.down' : 'chevron'}
              color={theme.muted}
              size={14}
            />
          </Row>

          {showReminderPicker ? (
            <View
              style={[
                styles.reminderPicker,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceSecondary,
                },
              ]}
            >
              <Text style={[styles.reminderPickerTitle, { color: theme.muted }]}>
                ¿Cuándo avisar?
              </Text>
              <View style={styles.reminderChips}>
                {calendarReminderOptions.map((option) => {
                  const selected =
                    option === reminder ||
                    (option === CALENDAR_REMINDER_CUSTOM && reminderIsCustom);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => selectReminder(option)}
                      style={[
                        styles.reminderChip,
                        {
                          borderColor: selected ? theme.primary : theme.border,
                          backgroundColor: selected
                            ? theme.primarySoft
                            : theme.surface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selected ? theme.primary : theme.text,
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        {option === CALENDAR_REMINDER_CUSTOM
                          ? 'Hora fija…'
                          : option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {reminderIsCustom ? (
                <View style={styles.customReminderBlock}>
                  <AppTimeField
                    label="Hora fija del push"
                    value={customReminderTime}
                    onChange={setCustomReminderTime}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

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

          <Row icon="doc.text.fill">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onFocus={focusScrollToEnd(scrollRef, 120)}
              placeholder="Agregar detalles"
              placeholderTextColor={theme.muted}
              style={[styles.inlineInput, { color: theme.text }]}
              multiline
            />
          </Row>

          <Row icon="paperclip" last={!isEditing}>
            <View style={styles.attachBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Agregar foto o archivo"
                onPress={chooseAttachment}
                style={styles.attachHeader}>
                <Text style={[styles.rowValue, { color: theme.text }]}>
                  {attachments.length
                    ? `${attachments.length} adjunto${attachments.length === 1 ? '' : 's'}`
                    : 'Agregar foto o archivo'}
                </Text>
                <Text style={[styles.rowHint, { color: theme.primary, marginTop: 0 }]}>Añadir</Text>
              </Pressable>

              {attachments.length ? (
                <View style={styles.attachList}>
                  {attachments.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.attachItem, { backgroundColor: theme.surfaceSecondary }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir ${item.name}`}
                        onPress={() => setPreview(item)}
                        style={styles.attachOpen}>
                        {isImageAttachment(item) ? (
                          <Image source={{ uri: item.uri }} style={styles.attachThumb} />
                        ) : (
                          <View style={[styles.attachFileIcon, { backgroundColor: theme.primarySoft }]}>
                            <AppIcon name="doc.fill" color={theme.primary} size={16} />
                          </View>
                        )}
                        <Text numberOfLines={1} style={[styles.attachName, { color: theme.text }]}>
                          {item.name}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Quitar ${item.name}`}
                        onPress={() => removeAttachment(item.id)}
                        hitSlop={8}>
                        <AppIcon name="xmark" color={theme.muted} size={16} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Row>

          {isEditing ? (
            <ScalePressable
              onPress={saving ? undefined : confirmDelete}
              style={[styles.deleteBtn, { borderColor: theme.danger }]}>
              <Text style={[styles.deleteBtnText, { color: theme.danger }]}>
                Eliminar
              </Text>
            </ScalePressable>
          ) : null}
        </FormScrollView>
      </View>
      <AttachmentPreview item={preview} onClose={() => setPreview(null)} />
    </SheetScreen>
  );
}

function Row({
  icon,
  children,
  last,
  onPress,
}: {
  icon: string;
  children: ReactNode;
  last?: boolean;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const content = (
    <>
      <View style={styles.rowIcon}>
        <AppIcon name={icon} color={theme.muted} size={18} />
      </View>
      <View style={styles.rowBody}>{children}</View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.row, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        {content}
      </Pressable>
    );
  }
  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerSpacer: { flex: 1 },
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
    paddingTop: 12,
    paddingBottom: 18,
    letterSpacing: -0.5,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
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
  timeFields: { flex: 1, gap: 12 },
  timeBlock: { flex: 1, gap: 4 },
  timeInput: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  swatch: { width: 18, height: 18, borderRadius: 4 },
  swatches: { gap: 8, alignItems: 'center' },
  swatchOption: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
  },
  attachBlock: { flex: 1, gap: 10 },
  attachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  attachList: { gap: 8 },
  attachItem: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachOpen: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachThumb: { width: 34, height: 34, borderRadius: 8 },
  attachFileIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16, fontWeight: '700' },
  attachName: { flex: 1, fontSize: 13, fontWeight: '600' },
  reminderPicker: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  reminderPickerTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  reminderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  customReminderBlock: { gap: 4, marginTop: 2 },
});
