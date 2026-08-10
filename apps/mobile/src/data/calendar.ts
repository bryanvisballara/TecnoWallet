export type CalendarItemType = 'event' | 'task' | 'birthday';

export type CalendarAttachment = {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  kind: 'image' | 'file';
};

export type CalendarItem = {
  id: string;
  type: CalendarItemType;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  allDay: boolean;
  startHour?: number; // 0-23.75
  endHour?: number;
  color: string;
  notes?: string;
  location?: string;
  meetingLink?: string;
  list?: string;
  reminder?: string;
  repeat?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  completed?: boolean;
  attachments?: CalendarAttachment[];
  /** Libro/calendario al que pertenece (p. ej. personal o el de un jefe). */
  calendarId?: string;
};

export const calendarColors = {
  event: '#7F56D9',
  task: '#0878F9',
  birthday: '#12B76A',
  flight: '#F79009',
} as const;

export const calendarRepeatOptions = [
  'No se repite',
  'Cada día',
  'Cada semana',
  'Cada mes',
  'Cada año',
] as const;

export const calendarListOptions = [
  'Mi calendario',
  'Mis tareas',
  'Trabajo',
  'Personal',
] as const;

export const calendarReminderOptions = [
  'En el momento',
  '5 minutos antes',
  '10 minutos antes',
  '15 minutos antes',
  '30 minutos antes',
  '1 hora antes',
  '2 horas antes',
  'El día del evento a las 09:00',
  '1 día antes a las 09:00',
  '1 semana antes a las 09:00',
  'Hora personalizada…',
  'Sin notificación',
] as const;

export const CALENDAR_REMINDER_NONE = 'Sin notificación';
export const CALENDAR_REMINDER_CUSTOM = 'Hora personalizada…';

export function hourFromHhmm(value: string): number | undefined {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return undefined;
  return Number(match[1]) + Number(match[2]) / 60;
}

export function hhmmFromHour(value?: number, fallback = '10:00') {
  if (value == null || !Number.isFinite(value)) return fallback;
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
}

export function formatReminderLabel(reminder: string) {
  if (reminder === CALENDAR_REMINDER_NONE) return 'Sin notificación push';
  if (reminder.startsWith('A las ')) return `Push a las ${reminder.slice(6)}`;
  return `Push · ${reminder}`;
}

/** Calcula cuándo debe dispararse el recordatorio push. */
export function resolveCalendarReminderAt(input: {
  date: string;
  allDay: boolean;
  startHour?: number;
  reminder?: string;
}): Date | null {
  const reminder = input.reminder?.trim();
  if (!reminder || reminder === CALENDAR_REMINDER_NONE || reminder === CALENDAR_REMINDER_CUSTOM) {
    return null;
  }

  const eventAt = (() => {
    const date = parseDateKey(input.date);
    if (input.allDay || input.startHour == null) {
      date.setHours(9, 0, 0, 0);
      return date;
    }
    const hours = Math.floor(input.startHour);
    const minutes = Math.round((input.startHour - hours) * 60);
    date.setHours(hours, minutes, 0, 0);
    return date;
  })();

  const atTimeOnDay = (daysBefore: number, hour: number, minute: number) => {
    const date = parseDateKey(input.date);
    date.setDate(date.getDate() - daysBefore);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const customAt = /^A las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (customAt) {
    return atTimeOnDay(0, Number(customAt[1]), Number(customAt[2]));
  }

  const dayBeforeAt = /^El día anterior a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayBeforeAt) {
    return atTimeOnDay(1, Number(dayBeforeAt[1]), Number(dayBeforeAt[2]));
  }

  const dayOfAt = /^El día del evento a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayOfAt) {
    return atTimeOnDay(0, Number(dayOfAt[1]), Number(dayOfAt[2]));
  }

  const dayBeforeFixed = /^1 día antes a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayBeforeFixed) {
    return atTimeOnDay(1, Number(dayBeforeFixed[1]), Number(dayBeforeFixed[2]));
  }

  const weekBeforeFixed = /^1 semana antes a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (weekBeforeFixed) {
    return atTimeOnDay(7, Number(weekBeforeFixed[1]), Number(weekBeforeFixed[2]));
  }

  if (reminder === 'En el momento') {
    return eventAt;
  }

  const minutesBefore = (() => {
    const match = /^(\d+)\s+minutos?\s+antes$/i.exec(reminder);
    if (match) return Number(match[1]);
    if (/^1 hora antes$/i.test(reminder)) return 60;
    if (/^2 horas antes$/i.test(reminder)) return 120;
    return null;
  })();

  if (minutesBefore != null) {
    return new Date(eventAt.getTime() - minutesBefore * 60_000);
  }

  return null;
}

export const seedCalendarItems: CalendarItem[] = [
  {
    id: 'c1',
    type: 'event',
    title: 'Vuelo a Barranquilla',
    date: '2026-08-05',
    allDay: false,
    startHour: 9.75,
    endHour: 11.25,
    color: '#F5C518',
    location: 'San Andrés ADZ',
    notes: 'P5 7207',
    reminder: 'El día anterior a las 17:00',
  },
  {
    id: 'c2',
    type: 'task',
    title: 'Pagar alquiler',
    date: '2026-08-08',
    allDay: true,
    color: calendarColors.task,
    list: 'Mis tareas',
    reminder: 'El día del evento a las 09:00',
  },
  {
    id: 'c3',
    type: 'birthday',
    title: 'Cumpleaños de Sam',
    date: '2026-08-12',
    allDay: true,
    color: calendarColors.birthday,
    reminder: '1 semana antes a las 09:00',
  },
  {
    id: 'c4',
    type: 'event',
    title: 'Revisión de presupuesto',
    date: '2026-08-05',
    allDay: false,
    startHour: 16,
    endHour: 17,
    color: calendarColors.event,
    list: 'Mi calendario',
  },
  {
    id: 'c5',
    type: 'task',
    title: 'Renovar seguro',
    date: '2026-08-15',
    allDay: true,
    color: calendarColors.task,
    list: 'Mis tareas',
  },
  {
    id: 'c6',
    type: 'event',
    title: 'Cena familiar',
    date: '2026-08-20',
    allDay: false,
    startHour: 19,
    endHour: 21,
    color: '#EE46BC',
    location: 'Casa',
  },
  {
    id: 'c7',
    type: 'birthday',
    title: 'Cumpleaños de Alex',
    date: '2026-08-28',
    allDay: true,
    color: calendarColors.birthday,
  },
];

export const typeLabels: Record<CalendarItemType, string> = {
  event: 'Evento',
  task: 'Tarea',
  birthday: 'Cumpleaños',
};

export const typeIcons: Record<CalendarItemType, string> = {
  event: 'calendar',
  task: 'checkmark.circle.fill',
  birthday: 'gift.fill',
};

export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

export function formatMonthTitle(date: Date) {
  const raw = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatHour(value?: number) {
  if (value == null) return '';
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${`${minutes}`.padStart(2, '0')} ${suffix}`;
}

export function buildMonthMatrix(anchor: Date, weekStartsOn: 0 | 1 = 0) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];

  for (let i = 0; i < 42; i += 1) {
    const dayNumber = i - startOffset + 1;
    const date = new Date(year, month, dayNumber);
    cells.push({
      date,
      inMonth: dayNumber >= 1 && dayNumber <= daysInMonth,
      key: toDateKey(date),
    });
  }
  return cells;
}

export function weekDayLabels(weekStartsOn: 0 | 1 = 0) {
  const labels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  if (weekStartsOn === 0) return labels;
  return [...labels.slice(1), labels[0]];
}
