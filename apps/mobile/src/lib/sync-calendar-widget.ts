import { NativeModules, Platform } from 'react-native';

import { toDateKey, type CalendarItem } from '@/data/calendar';
import { calendarTimeView } from '@/lib/timezones';

function timeRange(item: CalendarItem) {
  const view = calendarTimeView(item);
  if (item.allDay || item.startHour == null) return view.rangeLabel;
  return view.localHint ? `${view.rangeLabel} · ${view.localHint}` : view.rangeLabel;
}

function itemDateKey(value: unknown) {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? '';
}

export function syncCalendarWidget(items: CalendarItem[]) {
  if (Platform.OS !== 'ios') return;
  const sync = NativeModules.WidgetCalendarSync as
    | { writeSnapshot?: (json: string) => void }
    | undefined;
  if (!sync?.writeSnapshot) return;
  const today = toDateKey(new Date());
  const mapped = items.map((item) => {
    const view = calendarTimeView(item);
    return {
      date: view.dateKey || itemDateKey(item.date),
      title: item.title,
      time: timeRange(item),
      color: item.color || '#0878F9',
      type: item.type || 'event',
      completed: Boolean(item.completed),
    };
  });
  const dates = [...new Set(mapped.map((item) => item.date).filter(Boolean))];
  const todayEvents = mapped
    .filter((item) => item.date === today && !item.completed)
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 8);
  try {
    sync.writeSnapshot(JSON.stringify({ dates, today: todayEvents, items: mapped }));
  } catch {
    // Widget sync is best-effort.
  }
}
