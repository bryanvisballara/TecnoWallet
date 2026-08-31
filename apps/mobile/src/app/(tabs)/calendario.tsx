import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarSwitcher } from '@/components/calendar-switcher';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import {
  buildMonthMatrix,
  expandCalendarItemsForDates,
  formatDayLabel,
  formatHour,
  formatMonthTitle,
  localizedTypeLabels,
  parseDateKey,
  toDateKey,
  calendarItemIcon,
  weekDayLabels,
  type CalendarItem,
  type CalendarItemType,
} from '@/data/calendar';
import { displayCalendarName, useAppCopy } from '@/i18n/app-copy';
import { dateLocale } from '@/i18n/locale-format';
import { useAppRefresh } from '@/hooks/use-app-refresh';
import { useTabBarScrollHandler } from '@/hooks/use-tab-bar-scroll';
import { useActiveCalendar, useCalendarStore } from '@/store/calendar';
import { useCalendarFabStore } from '@/store/calendar-fab';
import { useLanguageStore } from '@/store/language';
import { useSafeLayout } from '@/hooks/use-safe-layout';
import { usePreferencesStore, weekStartsOnJsDay } from '@/store/preferences';
import { isSelfOwner } from '@/lib/collaboration-roles';
import { hasPaidPlan, usePlusStore } from '@/store/plus';

const AnimatedScrollView = Animated.ScrollView;
const DONE_GREEN = '#12B76A';

function CompleteButton({
  done,
  onPress,
  light,
}: {
  done: boolean;
  onPress: () => void;
  light?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? 'Marcar como pendiente' : 'Marcar como completado'}
      hitSlop={8}
      onPress={(event) => {
        event.stopPropagation?.();
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.completeBtn,
        done
          ? { backgroundColor: DONE_GREEN, borderColor: DONE_GREEN }
          : {
              backgroundColor: light ? 'rgba(255,255,255,0.22)' : 'transparent',
              borderColor: light ? 'rgba(255,255,255,0.92)' : '#D0D5DD',
            },
      ]}>
      {done ? <AppIcon name="checkmark" color="#FFFFFF" size={14} /> : null}
    </Pressable>
  );
}

export default function CalendarScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { height: windowHeight } = useWindowDimensions();
  /** iPhone Pro / compact heights need a denser month grid so the day list can scroll into view. */
  const compact = windowHeight < 900;
  const typeLabels = useMemo(() => localizedTypeLabels(locale), [locale]);
  const { tabsBottom, fabBottom } = useSafeLayout();
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);
  const { items, calendar, activeCalendarId } = useActiveCalendar();
  const toggleTask = useCalendarStore((state) => state.toggleTask);
  const { onScroll, useAnimatedScrollView } = useTabBarScrollHandler();
  const VerticalScroll = useAnimatedScrollView ? AnimatedScrollView : ScrollView;
  const { refreshing, onRefresh } = useAppRefresh();
  const weekStartsOn = usePreferencesStore((state) => state.weekStartsOn);
  const weekStartJs = weekStartsOnJsDay(weekStartsOn);
  const weekDays = useMemo(() => weekDayLabels(weekStartJs, locale), [weekStartJs, locale]);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [anchor, setAnchor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(today));
  const [view, setView] = useState<'month' | 'day'>('month');
  const fabOpen = useCalendarFabStore((state) => state.open);
  const setFabOpen = useCalendarFabStore((state) => state.setOpen);

  useEffect(() => () => setFabOpen(false), [setFabOpen]);

  const months = useMemo(() => {
    const list: Date[] = [];
    for (let i = -1; i < 8; i += 1) {
      list.push(new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));
    }
    return list;
  }, [anchor]);

  const matrix = useMemo(() => buildMonthMatrix(anchor, weekStartJs), [anchor, weekStartJs]);
  const selectedDate = useMemo(() => parseDateKey(selectedKey), [selectedKey]);
  const visibleDateKeys = useMemo(() => {
    const keys = matrix.map((cell) => cell.key);
    if (!keys.includes(selectedKey)) keys.push(selectedKey);
    return keys;
  }, [matrix, selectedKey]);
  const expandedItems = useMemo(
    () => expandCalendarItemsForDates(items, visibleDateKeys),
    [items, visibleDateKeys],
  );
  const dayItems = useMemo(
    () =>
      expandedItems
        .filter((item) => item.date === selectedKey)
        .sort((a, b) => (a.startHour ?? -1) - (b.startHour ?? -1)),
    [expandedItems, selectedKey],
  );
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    expandedItems.forEach((item) => {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    });
    return map;
  }, [expandedItems]);

  const openCompose = (type: CalendarItemType, hour?: number) => {
    setFabOpen(false);
    const params: { type: string; date: string; hour?: string } = {
      type,
      date: selectedKey,
    };
    if (hour != null && Number.isFinite(hour)) {
      params.hour = String(Math.floor(hour));
    }
    router.push({ pathname: '/add-calendar-item', params });
  };

  const openItem = (id: string) => {
    router.push({ pathname: '/add-calendar-item', params: { id } });
  };

  const calendarTitle = calendar?.name
    ? displayCalendarName(calendar.name, locale)
    : copy.calendar.myCalendar;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {fabOpen ? <Pressable style={styles.fabScrim} onPress={() => setFabOpen(false)} /> : null}
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <CalendarSwitcher compact={compact} />
          <Pressable
            onPress={() => setView(view === 'month' ? 'day' : 'month')}
            onLongPress={() => {
              setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedKey(todayKey);
              setView('day');
            }}
            style={styles.monthButton}>
            <Text
              style={[
                styles.monthTitle,
                compact && styles.monthTitleCompact,
                { color: theme.text },
              ]}>
              {formatMonthTitle(anchor, locale)}
            </Text>
            <AppIcon name="chevron" color={theme.muted} size={14} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (selectedKey === todayKey && view === 'day') return;
              setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedKey(todayKey);
              setView('day');
            }}>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              {view === 'month'
                ? copy.calendar.monthView
                : formatDayLabel(selectedDate, locale)}
              {selectedKey !== todayKey ? ` · ${copy.calendar.goToday}` : ''}
            </Text>
          </Pressable>
        </View>
        <ScalePressable
          accessibilityLabel={copy.common.inviteTo(calendarTitle)}
          onPress={() => {
            if (!isSelfOwner(calendar?.members)) {
              Alert.alert(
                'Solo el organizador',
                'En un calendario compartido solo el organizador puede invitar a más personas.',
              );
              return;
            }
            if (!hasPaidPlan(plusAccess)) {
              openPaywall('SHARING_REQUIRED');
              return;
            }
            router.push({
              pathname: '/(tabs)/calendars',
              params: { focus: activeCalendarId, tab: 'share' },
            });
          }}
          style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppIcon name="person.badge.plus" color={theme.primary} size={20} />
        </ScalePressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthPills}
        style={[styles.monthStrip, compact && styles.monthStripCompact]}>
        {months.map((month) => {
          const active = month.getMonth() === anchor.getMonth() && month.getFullYear() === anchor.getFullYear();
          const label = new Intl.DateTimeFormat(dateLocale(locale), { month: 'short' })
            .format(month)
            .replace('.', '');
          return (
            <Pressable
              key={`${month.getFullYear()}-${month.getMonth()}`}
              onPress={() => setAnchor(new Date(month.getFullYear(), month.getMonth(), 1))}
              style={[
                styles.monthPill,
                compact && styles.monthPillCompact,
                {
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}>
              <Text style={[styles.monthPillText, { color: active ? '#FFFFFF' : theme.text }]}>
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <VerticalScroll
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          compact && styles.contentCompact,
          { paddingBottom: tabsBottom + 36 },
        ]}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={view === 'month' ? copy.calendar.viewDay : copy.calendar.viewMonth}
          onPress={() => setView(view === 'month' ? 'day' : 'month')}
          style={[styles.viewToggle, compact && styles.viewToggleCompact]}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>
            {view === 'month' ? copy.calendar.viewDay : copy.calendar.viewMonth}
          </Text>
        </Pressable>

        {view === 'month' ? (
          <View
            style={[
              styles.monthCard,
              compact && styles.monthCardCompact,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <View style={styles.weekRow}>
              {weekDays.map((day, index) => (
                <Text key={`${day}-${index}`} style={[styles.weekDay, { color: theme.muted }]}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {matrix.map((cell) => {
                const selected = cell.key === selectedKey;
                const isToday = cell.key === todayKey;
                const dayEvents = itemsByDay.get(cell.key) ?? [];
                return (
                  <Pressable
                    key={cell.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir día ${cell.date.getDate()}`}
                    onPress={() => {
                      setSelectedKey(cell.key);
                      if (!cell.inMonth) {
                        setAnchor(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                      }
                      setView('day');
                    }}
                    style={[styles.cell, compact && styles.cellCompact]}>
                    <View
                      style={[
                        styles.dayNumberWrap,
                        compact && styles.dayNumberWrapCompact,
                        selected && { backgroundColor: theme.primary },
                        !selected && isToday && { borderColor: theme.primary, borderWidth: 1.5 },
                      ]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          compact && styles.dayNumberCompact,
                          { color: cell.inMonth ? theme.text : theme.border },
                          selected && { color: '#FFFFFF' },
                          isToday && !selected && { color: theme.primary, fontWeight: '700' },
                        ]}>
                        {cell.date.getDate()}
                      </Text>
                    </View>
                    {compact ? (
                      <View style={styles.dots}>
                        {dayEvents.slice(0, 3).map((item) => (
                          <View
                            key={`${item.id}-${item.date}`}
                            style={[styles.dot, { backgroundColor: item.color }]}
                          />
                        ))}
                      </View>
                    ) : (
                      <View style={styles.chips}>
                        {dayEvents.slice(0, 2).map((item) => (
                          <View
                            key={`${item.id}-${item.date}`}
                            style={[styles.chip, { backgroundColor: item.color }]}>
                            <Text numberOfLines={1} style={styles.chipText}>
                              {item.title}
                            </Text>
                          </View>
                        ))}
                        {dayEvents.length > 2 ? (
                          <Text style={[styles.more, { color: theme.muted }]}>
                            +{dayEvents.length - 2}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <DayTimeline
            date={selectedDate}
            items={dayItems}
            theme={theme}
            locale={locale}
            compact={compact}
            onOpenItem={openItem}
            onToggleTask={toggleTask}
            onCreateAtHour={(hour) => openCompose('event', hour)}
          />
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact, { color: theme.text }]}>
            {view === 'month' ? copy.calendar.selectedDay : copy.calendar.dayAgenda}
          </Text>
        </View>

        {dayItems.length === 0 ? (
          <View style={[styles.empty, compact && styles.emptyCompact, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppIcon name="calendar" color={theme.muted} size={compact ? 22 : 28} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{copy.calendar.emptyDay}</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              {copy.calendar.emptyDayHint}
            </Text>
          </View>
        ) : (
          dayItems.map((item) => (
            <ScalePressable
              key={`${item.id}-${item.date}`}
              onPress={() => openItem(item.id)}
              style={[
                styles.itemCard,
                {
                  backgroundColor: item.completed ? '#ECFDF3' : theme.surface,
                  borderColor: item.completed ? DONE_GREEN : theme.border,
                  borderWidth: item.completed ? 2 : StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={[styles.itemAccent, { backgroundColor: item.completed ? DONE_GREEN : item.color }]} />
              <View style={[styles.itemIcon, { backgroundColor: `${item.completed ? DONE_GREEN : item.color}22` }]}>
                <AppIcon
                  name={calendarItemIcon(item)}
                  color={item.completed ? DONE_GREEN : item.color}
                  size={18}
                />
              </View>
              <View style={styles.itemCopy}>
                <Text
                  style={[
                    styles.itemTitle,
                    { color: theme.text },
                    item.completed && styles.completed,
                  ]}>
                  {item.title}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.muted }]}>
                  {typeLabels[item.type]}
                  {item.allDay
                    ? ` · ${copy.calendar.allDay}`
                    : ` · ${formatHour(item.startHour)}${item.endHour != null ? ` – ${formatHour(item.endHour)}` : ''}`}
                  {item.location ? ` · ${item.location}` : ''}
                </Text>
              </View>
              <CompleteButton done={Boolean(item.completed)} onPress={() => toggleTask(item.id)} />
            </ScalePressable>
          ))
        )}
      </VerticalScroll>

      <View pointerEvents="box-none" style={[styles.fabHost, { bottom: fabBottom }]}>
        {fabOpen ? (
          <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={styles.fabMenu}>
            {([
              { type: 'birthday' as const, label: copy.calendar.birthday, icon: 'gift.fill' },
              { type: 'task' as const, label: copy.calendar.task, icon: 'checkmark.circle.fill' },
              { type: 'event' as const, label: copy.calendar.event, icon: 'calendar' },
            ]).map((action) => (
              <ScalePressable
                key={action.type}
                onPress={() => openCompose(action.type)}
                style={[styles.fabAction, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name={action.icon} color={theme.primary} size={18} />
                <Text style={[styles.fabActionText, { color: theme.primary }]}>{action.label}</Text>
              </ScalePressable>
            ))}
          </Animated.View>
        ) : null}

        <ScalePressable
          accessibilityLabel={fabOpen ? 'Cerrar menú' : 'Agregar al calendario'}
          onPress={() => {
            void Haptics.selectionAsync();
            setFabOpen((open) => !open);
          }}
          style={[
            styles.fab,
            compact && styles.fabCompact,
            { backgroundColor: fabOpen ? theme.primary : theme.primarySoft },
          ]}>
          <Animated.View key={fabOpen ? 'x' : 'plus'} entering={ZoomIn.duration(160)}>
            <AppIcon
              name={fabOpen ? 'xmark' : 'plus'}
              color={fabOpen ? '#FFFFFF' : theme.primary}
              size={compact ? 24 : 26}
            />
          </Animated.View>
        </ScalePressable>
      </View>
    </SafeAreaView>
  );
}

function DayTimeline({
  date,
  items,
  theme,
  locale,
  compact = false,
  onOpenItem,
  onToggleTask,
  onCreateAtHour,
}: {
  date: Date;
  items: CalendarItem[];
  theme: ReturnType<typeof useAppTheme>;
  locale: string;
  compact?: boolean;
  onOpenItem: (id: string) => void;
  onToggleTask: (id: string) => void;
  onCreateAtHour: (hour: number) => void;
}) {
  // Cover early/late hours so timed items (e.g. 6:00) stay visible.
  const hours = Array.from({ length: 18 }, (_, index) => index + 5);
  const hourHeight = compact ? 44 : 56;
  const timed = items.filter((item) => !item.allDay && item.startHour != null);
  const allDay = items.filter((item) => item.allDay);

  return (
    <View style={[styles.timelineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.dayBadgeRow}>
        <View>
          <Text style={[styles.dayBadgeWeek, { color: theme.primary }]}>
            {new Intl.DateTimeFormat(dateLocale(locale), { weekday: 'short' })
              .format(date)
              .toUpperCase()}
          </Text>
          <View style={[styles.dayBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.dayBadgeNum}>{date.getDate()}</Text>
          </View>
        </View>
        <View style={styles.allDayStack}>
          {allDay.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onOpenItem(item.id)}
              style={[
                styles.allDayChip,
                {
                  backgroundColor: item.completed ? '#ECFDF3' : `${item.color}22`,
                  borderWidth: item.completed ? 2 : 0,
                  borderColor: item.completed ? DONE_GREEN : 'transparent',
                },
              ]}>
              <AppIcon
                name={calendarItemIcon(item)}
                color={item.completed ? DONE_GREEN : item.color}
                size={16}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.allDayText,
                  { color: theme.text },
                  item.completed && styles.completed,
                ]}>
                {item.title}
              </Text>
              <CompleteButton done={Boolean(item.completed)} onPress={() => onToggleTask(item.id)} />
            </Pressable>
          ))}
        </View>
      </View>

      {hours.map((hour) => {
        const blocks = timed.filter((item) => Math.floor(item.startHour ?? 0) === hour);
        return (
          <Pressable
            key={hour}
            accessibilityRole="button"
            accessibilityLabel={`Crear actividad a las ${formatHour(hour)}`}
            onPress={() => onCreateAtHour(hour)}
            style={[styles.hourRow, { minHeight: hourHeight }]}>
            <Text style={[styles.hourLabel, { color: theme.muted }]}>
              {formatHour(hour).replace(':00', '')}
            </Text>
            <View style={[styles.hourLine, { borderTopColor: theme.border }]}>
              {blocks.map((block, index) => (
                <Pressable
                  key={block.id}
                  onPress={() => onOpenItem(block.id)}
                  style={[
                    styles.eventBlock,
                    {
                      backgroundColor: block.completed ? '#0E9F6E' : block.color,
                      borderWidth: block.completed ? 3 : 0,
                      borderColor: block.completed ? '#054C32' : 'transparent',
                      top: ((block.startHour ?? hour) - hour) * hourHeight,
                      height: Math.max(
                        compact ? 36 : 44,
                        ((block.endHour ?? hour + 1) - (block.startHour ?? hour)) * hourHeight,
                      ),
                      left: 8 + index * 8,
                      right: 8,
                    },
                  ]}>
                  <View style={styles.eventBlockRow}>
                    <View style={styles.eventBlockCopy}>
                      <View style={styles.eventBlockHead}>
                        <AppIcon name={calendarItemIcon(block)} color="#FFFFFF" size={14} />
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.eventBlockTitle,
                            block.completed && styles.completed,
                          ]}>
                          {block.title}
                        </Text>
                      </View>
                      {block.location ? (
                        <Text style={styles.eventBlockMeta}>{block.location}</Text>
                      ) : null}
                    </View>
                    <CompleteButton
                      light
                      done={Boolean(block.completed)}
                      onPress={() => onToggleTask(block.id)}
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexShrink: 0,
  },
  headerCompact: {
    paddingTop: 4,
    paddingBottom: 6,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 6 },
  monthButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  monthTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.8 },
  monthTitleCompact: { fontSize: 22, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  monthStrip: { maxHeight: 56, flexGrow: 0, flexShrink: 0 },
  monthStripCompact: { maxHeight: 48 },
  monthPills: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 8,
    alignItems: 'center',
  },
  monthPill: {
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPillCompact: {
    minHeight: 32,
    paddingHorizontal: 12,
  },
  monthPillText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  content: { padding: 18, gap: 14 },
  contentCompact: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14, gap: 10 },
  monthCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  monthCardCompact: {
    borderRadius: 18,
    padding: 8,
  },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { width: `${100 / 7}%` as unknown as number, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%` as unknown as number, minHeight: 72, padding: 2 },
  cellCompact: { minHeight: 48, paddingVertical: 1, paddingHorizontal: 1 },
  dayNumberWrap: {
    alignSelf: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dayNumberWrapCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 1,
  },
  dayNumber: { fontSize: 12, fontWeight: '600' },
  dayNumberCompact: { fontSize: 11 },
  chips: { gap: 2 },
  chip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  chipText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  more: { fontSize: 9, textAlign: 'center' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    minHeight: 8,
    marginTop: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  viewToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 12,
    marginBottom: 4,
  },
  viewToggleCompact: {
    paddingVertical: 2,
    marginBottom: 0,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitleCompact: { fontSize: 16 },
  empty: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  emptyCompact: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  itemCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    gap: 10,
    paddingRight: 14,
  },
  itemAccent: { width: 5, alignSelf: 'stretch' },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: { flex: 1, gap: 3, paddingVertical: 12 },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemMeta: { fontSize: 12 },
  completed: { textDecorationLine: 'line-through', opacity: 0.55 },
  timelineCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    overflow: 'hidden',
  },
  dayBadgeRow: { flexDirection: 'row', gap: 14, marginBottom: 12, alignItems: 'flex-start' },
  dayBadgeWeek: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  dayBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dayBadgeNum: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  allDayStack: { flex: 1, gap: 6 },
  allDayChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allDayDot: { width: 8, height: 8, borderRadius: 4 },
  allDayText: { flex: 1, fontSize: 13, fontWeight: '600' },
  hourRow: { flexDirection: 'row', minHeight: 56 },
  hourLabel: { width: 54, fontSize: 11, fontWeight: '600' },
  hourLine: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, position: 'relative' },
  eventBlock: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  eventBlockRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventBlockCopy: { flex: 1, minWidth: 0 },
  eventBlockHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  eventBlockTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1 },
  completeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventBlockMeta: { color: '#FFFFFFCC', fontSize: 11, marginTop: 2 },
  fabHost: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
    gap: 10,
    zIndex: 20,
  },
  fabMenu: { gap: 10, alignItems: 'flex-end' },
  fabAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    shadowColor: '#0B1D3A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  fabActionText: { fontSize: 14, fontWeight: '700' },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1D3A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabCompact: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  fabScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 15,
  },
});
