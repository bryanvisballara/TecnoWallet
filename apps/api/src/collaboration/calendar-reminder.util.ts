/**
 * Mirrors apps/mobile resolveCalendarReminderAt so the API can fan-out
 * calendar reminder pushes to every calendar member at the right time.
 */

function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function resolveCalendarReminderAt(input: {
  date: string;
  allDay?: boolean;
  startHour?: number;
  reminder?: string;
}): Date | null {
  const reminder = input.reminder?.trim();
  if (
    !reminder ||
    reminder === 'Sin notificación' ||
    reminder === 'Hora personalizada…'
  ) {
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

  const dayBeforeAt =
    /^El día anterior a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayBeforeAt) {
    return atTimeOnDay(1, Number(dayBeforeAt[1]), Number(dayBeforeAt[2]));
  }

  const dayOfAt =
    /^El día del evento a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayOfAt) {
    return atTimeOnDay(0, Number(dayOfAt[1]), Number(dayOfAt[2]));
  }

  const dayBeforeFixed =
    /^1 día antes a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayBeforeFixed) {
    return atTimeOnDay(1, Number(dayBeforeFixed[1]), Number(dayBeforeFixed[2]));
  }

  const weekBeforeFixed =
    /^1 semana antes a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (weekBeforeFixed) {
    return atTimeOnDay(
      7,
      Number(weekBeforeFixed[1]),
      Number(weekBeforeFixed[2]),
    );
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

export function withReminderSchedule(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const reminder =
    typeof data.reminder === 'string' ? data.reminder.trim() : undefined;
  const date = typeof data.date === 'string' ? data.date : '';
  const allDay = Boolean(data.allDay);
  const startHour =
    typeof data.startHour === 'number' ? data.startHour : undefined;
  const fireAt = resolveCalendarReminderAt({
    date,
    allDay,
    startHour,
    reminder,
  });

  const next = { ...data };
  delete next.reminderAt;
  delete next.reminderNotifiedAt;

  if (fireAt) {
    next.reminderAt = fireAt.toISOString();
  } else if (
    !reminder ||
    reminder === 'Sin notificación' ||
    reminder === 'Hora personalizada…'
  ) {
    delete next.reminder;
  }
  return next;
}
