import { NativeModules, Platform } from 'react-native';

import { toDateKey, type CalendarItem } from '@/data/calendar';

function hourLabel(hour?: number, allDay?: boolean) {
  if (allDay || hour === undefined || !Number.isFinite(hour)) return 'Todo el día';
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function timeRange(item: CalendarItem) {
  if (item.allDay || item.startHour == null) return 'Todo el día';
  const start = hourLabel(item.startHour);
  if (item.endHour == null || !Number.isFinite(item.endHour)) return start;
  return `${start} – ${hourLabel(item.endHour)}`;
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
  const mapped = items.map((item) => ({
    date: itemDateKey(item.date),
    title: item.title,
    time: timeRange(item),
    color: item.color || '#0878F9',
    type: item.type || 'event',
    completed: Boolean(item.completed),
  }));
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
