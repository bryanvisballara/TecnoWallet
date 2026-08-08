export type CalendarItemType = 'event' | 'task' | 'birthday';

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
  list?: string;
  reminder?: string;
  completed?: boolean;
};

export const calendarColors = {
  event: '#7F56D9',
  task: '#0878F9',
  birthday: '#12B76A',
  flight: '#F79009',
} as const;

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

export function buildMonthMatrix(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // Sunday = 0
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
