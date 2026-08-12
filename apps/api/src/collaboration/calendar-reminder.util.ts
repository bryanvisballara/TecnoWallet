/**
 * Calendar reminder fire-time helpers.
 *
 * Wall-clock reminder strings ("15 minutos antes", "A las 09:00") are interpreted
 * in America/Bogota on the server (UTC-5, no DST) so Render's UTC process TZ
 * does not shift team pushes. Clients may also send an absolute ISO `reminderAt`
 * (creator device TZ), which we prefer when marked with `reminderAtClient`.
 */

const BOGOTA_OFFSET_HOURS = 5; // America/Bogota is UTC-5 year-round

function parseDateParts(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
  };
}

/** Local wall time in America/Bogota → absolute UTC Date. */
export function bogotaWallTimeToUtc(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(y, m - 1, d, hour + BOGOTA_OFFSET_HOURS, minute, 0, 0));
}

function atBogotaOnEventDay(
  dateKey: string,
  daysBefore: number,
  hour: number,
  minute: number,
): Date | null {
  const parts = parseDateParts(dateKey);
  if (!parts) return null;
  // Use UTC noon anchor then shift calendar days to avoid DST edge cases.
  const anchor = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - daysBefore);
  return bogotaWallTimeToUtc(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + 1,
    anchor.getUTCDate(),
    hour,
    minute,
  );
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
    if (input.allDay || input.startHour == null) {
      return atBogotaOnEventDay(input.date, 0, 9, 0);
    }
    const hours = Math.floor(input.startHour);
    const minutes = Math.round((input.startHour - hours) * 60);
    return atBogotaOnEventDay(input.date, 0, hours, minutes);
  })();

  if (!eventAt) return null;

  const customAt = /^A las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (customAt) {
    return atBogotaOnEventDay(
      input.date,
      0,
      Number(customAt[1]),
      Number(customAt[2]),
    );
  }

  const dayBeforeAt =
    /^El día anterior a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayBeforeAt) {
    return atBogotaOnEventDay(
      input.date,
      1,
      Number(dayBeforeAt[1]),
      Number(dayBeforeAt[2]),
    );
  }

  const dayOfAt =
    /^El día del evento a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayOfAt) {
    return atBogotaOnEventDay(
      input.date,
      0,
      Number(dayOfAt[1]),
      Number(dayOfAt[2]),
    );
  }

  const dayBeforeFixed =
    /^1 día antes a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (dayBeforeFixed) {
    return atBogotaOnEventDay(
      input.date,
      1,
      Number(dayBeforeFixed[1]),
      Number(dayBeforeFixed[2]),
    );
  }

  const weekBeforeFixed =
    /^1 semana antes a las ([01]?\d|2[0-3]):([0-5]\d)$/i.exec(reminder);
  if (weekBeforeFixed) {
    return atBogotaOnEventDay(
      input.date,
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

function parseIsoDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Effective fire time for cron / persistence.
 * Prefers absolute client ISO when `reminderAtClient` is true; otherwise Bogota.
 */
export function effectiveCalendarReminderAt(
  data: Record<string, unknown>,
): Date | null {
  const reminder =
    typeof data.reminder === 'string' ? data.reminder.trim() : undefined;
  if (
    !reminder ||
    reminder === 'Sin notificación' ||
    reminder === 'Hora personalizada…'
  ) {
    return null;
  }

  if (data.reminderAtClient === true) {
    const clientAt = parseIsoDate(data.reminderAt);
    if (clientAt) return clientAt;
  }

  return resolveCalendarReminderAt({
    date: typeof data.date === 'string' ? data.date : '',
    allDay: Boolean(data.allDay),
    startHour:
      typeof data.startHour === 'number' ? data.startHour : undefined,
    reminder,
  });
}

export function withReminderSchedule(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const reminder =
    typeof data.reminder === 'string' ? data.reminder.trim() : undefined;
  const clientProvided =
    data.reminderAtClient === true ||
    (typeof data.reminderAt === 'string' && Boolean(parseIsoDate(data.reminderAt)));

  const fireAt = clientProvided
    ? parseIsoDate(data.reminderAt) ??
      resolveCalendarReminderAt({
        date: typeof data.date === 'string' ? data.date : '',
        allDay: Boolean(data.allDay),
        startHour:
          typeof data.startHour === 'number' ? data.startHour : undefined,
        reminder,
      })
    : resolveCalendarReminderAt({
        date: typeof data.date === 'string' ? data.date : '',
        allDay: Boolean(data.allDay),
        startHour:
          typeof data.startHour === 'number' ? data.startHour : undefined,
        reminder,
      });

  const next: Record<string, unknown> = { ...data };
  delete next.reminderAt;
  delete next.reminderNotifiedAt;
  delete next.reminderAtClient;

  if (fireAt) {
    next.reminderAt = fireAt.toISOString();
    if (clientProvided && parseIsoDate(data.reminderAt)) {
      next.reminderAtClient = true;
    }
  } else if (
    !reminder ||
    reminder === 'Sin notificación' ||
    reminder === 'Hora personalizada…'
  ) {
    delete next.reminder;
  }
  return next;
}
