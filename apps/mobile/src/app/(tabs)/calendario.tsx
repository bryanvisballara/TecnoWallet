import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import {
  buildMonthMatrix,
  formatHour,
  formatMonthTitle,
  parseDateKey,
  toDateKey,
  typeIcons,
  typeLabels,
  type CalendarItem,
  type CalendarItemType,
} from '@/data/calendar';
import { useCalendarStore } from '@/store/calendar';
import { useSafeLayout } from '@/hooks/use-safe-layout';
import { useTabBarStore } from '@/store/tab-bar';

const weekDays = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export default function CalendarScreen() {
  const theme = useAppTheme();
  const { tabsBottom, fabBottom } = useSafeLayout();
  const items = useCalendarStore((state) => state.items);
  const toggleTask = useCalendarStore((state) => state.toggleTask);
  const onScrollOffset = useTabBarStore((state) => state.onScrollOffset);
  const today = useMemo(() => new Date(2026, 7, 5), []);
  const [anchor, setAnchor] = useState(() => new Date(2026, 7, 1));
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(today));
  const [view, setView] = useState<'month' | 'day'>('month');
  const [fabOpen, setFabOpen] = useState(false);
  const [lastOffset, setLastOffset] = useState(0);

  const months = useMemo(() => {
    const list: Date[] = [];
    for (let i = -1; i < 8; i += 1) {
      list.push(new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));
    }
    return list;
  }, [anchor]);

  const matrix = useMemo(() => buildMonthMatrix(anchor), [anchor]);
  const selectedDate = useMemo(() => parseDateKey(selectedKey), [selectedKey]);
  const dayItems = useMemo(
    () => items.filter((item) => item.date === selectedKey).sort((a, b) => (a.startHour ?? -1) - (b.startHour ?? -1)),
    [items, selectedKey],
  );
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    items.forEach((item) => {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    });
    return map;
  }, [items]);

  const openCompose = (type: CalendarItemType) => {
    setFabOpen(false);
    router.push({ pathname: '/add-calendar-item', params: { type, date: selectedKey } });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {fabOpen ? <Pressable style={styles.fabScrim} onPress={() => setFabOpen(false)} /> : null}
      <View style={styles.header}>
        <View>
          <Pressable onPress={() => setView(view === 'month' ? 'day' : 'month')} style={styles.monthButton}>
            <Text style={[styles.monthTitle, { color: theme.text }]}>{formatMonthTitle(anchor)}</Text>
            <AppIcon name="chevron" color={theme.muted} size={14} />
          </Pressable>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {view === 'month' ? 'Vista mensual' : formatDayLabelSafe(selectedDate)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <ScalePressable
            accessibilityLabel="Buscar"
            onPress={() => undefined}
            style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppIcon name="magnifyingglass" color={theme.text} size={18} />
          </ScalePressable>
          <ScalePressable
            accessibilityLabel="Ir a hoy"
            onPress={() => {
              setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedKey(toDateKey(today));
              setView('day');
            }}
            style={[styles.todayBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.todayText, { color: theme.primary }]}>{today.getDate()}</Text>
          </ScalePressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthPills}
        style={styles.monthStrip}>
        {months.map((month) => {
          const active = month.getMonth() === anchor.getMonth() && month.getFullYear() === anchor.getFullYear();
          const label = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(month).replace('.', '');
          return (
            <Pressable
              key={`${month.getFullYear()}-${month.getMonth()}`}
              onPress={() => setAnchor(new Date(month.getFullYear(), month.getMonth(), 1))}
              style={[
                styles.monthPill,
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: tabsBottom + 24 }]}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          onScrollOffset(y, y - lastOffset);
          setLastOffset(y);
        }}>
        {view === 'month' ? (
          <View style={[styles.monthCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.weekRow}>
              {weekDays.map((day) => (
                <Text key={day} style={[styles.weekDay, { color: theme.muted }]}>{day}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {matrix.map((cell) => {
                const selected = cell.key === selectedKey;
                const isToday = cell.key === toDateKey(today);
                const dayEvents = itemsByDay.get(cell.key) ?? [];
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => {
                      setSelectedKey(cell.key);
                      if (!cell.inMonth) {
                        setAnchor(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                      }
                      setView('day');
                    }}
                    style={styles.cell}>
                    <View
                      style={[
                        styles.dayNumberWrap,
                        selected && { backgroundColor: theme.primary },
                        !selected && isToday && { borderColor: theme.primary, borderWidth: 1.5 },
                      ]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          { color: cell.inMonth ? theme.text : theme.border },
                          (selected || isToday) && selected && { color: '#FFFFFF' },
                          isToday && !selected && { color: theme.primary, fontWeight: '700' },
                        ]}>
                        {cell.date.getDate()}
                      </Text>
                    </View>
                    <View style={styles.chips}>
                      {dayEvents.slice(0, 2).map((item) => (
                        <View key={item.id} style={[styles.chip, { backgroundColor: item.color }]}>
                          <Text numberOfLines={1} style={styles.chipText}>{item.title}</Text>
                        </View>
                      ))}
                      {dayEvents.length > 2 ? (
                        <Text style={[styles.more, { color: theme.muted }]}>+{dayEvents.length - 2}</Text>
                      ) : null}
                    </View>
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
            onToggleTask={toggleTask}
          />
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {view === 'month' ? 'Del día seleccionado' : 'Agenda del día'}
          </Text>
          <Pressable onPress={() => setView(view === 'month' ? 'day' : 'month')}>
            <Text style={{ color: theme.primary, fontWeight: '600' }}>
              {view === 'month' ? 'Ver día' : 'Ver mes'}
            </Text>
          </Pressable>
        </View>

        {dayItems.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppIcon name="calendar" color={theme.muted} size={28} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin entradas este día</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Toca + para agregar un evento, tarea o cumpleaños.
            </Text>
          </View>
        ) : (
          dayItems.map((item) => (
            <ScalePressable
              key={item.id}
              onPress={() => {
                if (item.type === 'task') toggleTask(item.id);
              }}
              style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.itemAccent, { backgroundColor: item.color }]} />
              <View style={[styles.itemIcon, { backgroundColor: `${item.color}22` }]}>
                <AppIcon name={typeIcons[item.type]} color={item.color} size={18} />
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
                    ? ' · Todo el día'
                    : ` · ${formatHour(item.startHour)}${item.endHour != null ? ` – ${formatHour(item.endHour)}` : ''}`}
                  {item.location ? ` · ${item.location}` : ''}
                </Text>
              </View>
            </ScalePressable>
          ))
        )}
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.fabHost, { bottom: fabBottom }]}>
        {fabOpen ? (
          <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)} style={styles.fabMenu}>
            {([
              { type: 'birthday' as const, label: 'Cumpleaños', icon: 'gift.fill' },
              { type: 'task' as const, label: 'Tarea', icon: 'checkmark.circle.fill' },
              { type: 'event' as const, label: 'Evento', icon: 'calendar' },
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
          style={[styles.fab, { backgroundColor: fabOpen ? theme.primary : theme.primarySoft }]}>
          <Animated.View key={fabOpen ? 'x' : 'plus'} entering={ZoomIn.duration(160)}>
            <AppIcon name={fabOpen ? 'xmark' : 'plus'} color={fabOpen ? '#FFFFFF' : theme.primary} size={26} />
          </Animated.View>
        </ScalePressable>
      </View>
    </SafeAreaView>
  );
}

function formatDayLabelSafe(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function DayTimeline({
  date,
  items,
  theme,
  onToggleTask,
}: {
  date: Date;
  items: CalendarItem[];
  theme: ReturnType<typeof useAppTheme>;
  onToggleTask: (id: string) => void;
}) {
  const hours = Array.from({ length: 14 }, (_, index) => index + 7);
  const timed = items.filter((item) => !item.allDay && item.startHour != null);
  const allDay = items.filter((item) => item.allDay);

  return (
    <View style={[styles.timelineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.dayBadgeRow}>
        <View>
          <Text style={[styles.dayBadgeWeek, { color: theme.primary }]}>
            {new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).toUpperCase()}
          </Text>
          <View style={[styles.dayBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.dayBadgeNum}>{date.getDate()}</Text>
          </View>
        </View>
        <View style={styles.allDayStack}>
          {allDay.map((item) => (
            <Pressable key={item.id} onPress={() => item.type === 'task' && onToggleTask(item.id)} style={[styles.allDayChip, { backgroundColor: `${item.color}22` }]}>
              <View style={[styles.allDayDot, { backgroundColor: item.color }]} />
              <Text numberOfLines={1} style={[styles.allDayText, { color: theme.text }, item.completed && styles.completed]}>
                {item.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {hours.map((hour) => {
        const block = timed.find((item) => Math.floor(item.startHour ?? 0) === hour);
        return (
          <View key={hour} style={styles.hourRow}>
            <Text style={[styles.hourLabel, { color: theme.muted }]}>
              {formatHour(hour).replace(':00', '')}
            </Text>
            <View style={[styles.hourLine, { borderTopColor: theme.border }]}>
              {block ? (
                <View
                  style={[
                    styles.eventBlock,
                    {
                      backgroundColor: block.color,
                      top: ((block.startHour ?? hour) - hour) * 56,
                      height: Math.max(44, ((block.endHour ?? hour + 1) - (block.startHour ?? hour)) * 56),
                    },
                  ]}>
                  <Text numberOfLines={2} style={styles.eventBlockTitle}>{block.title}</Text>
                  {block.location ? <Text style={styles.eventBlockMeta}>{block.location}</Text> : null}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: { fontSize: 16, fontWeight: '800' },
  monthStrip: { maxHeight: 48 },
  monthPills: { paddingHorizontal: 18, gap: 8, alignItems: 'center' },
  monthPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthPillText: { fontSize: 13, fontWeight: '700' },
  content: { padding: 18, gap: 14 },
  monthCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { width: `${100 / 7}%` as unknown as number, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%` as unknown as number, minHeight: 72, padding: 2 },
  dayNumberWrap: {
    alignSelf: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dayNumber: { fontSize: 12, fontWeight: '600' },
  chips: { gap: 2 },
  chip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  chipText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  more: { fontSize: 9, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  empty: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    alignItems: 'center',
    gap: 8,
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
  eventBlockTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
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
  fabScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 15,
  },
});
