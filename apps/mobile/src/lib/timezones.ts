function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHourValue(value: number) {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${`${minutes}`.padStart(2, '0')} ${suffix}`;
}

export type CalendarTimeZone = {
  id: string;
  es: string;
  en: string;
};

/** Curated IANA zones for family calendars (LatAm + US + a few extras). */
export const calendarTimeZones: CalendarTimeZone[] = [
  { id: 'America/Bogota', es: 'Colombia (Bogotá)', en: 'Colombia (Bogotá)' },
  { id: 'America/New_York', es: 'EE. UU. Oriental (Nueva York)', en: 'US Eastern (New York)' },
  { id: 'America/Chicago', es: 'EE. UU. Central (Chicago)', en: 'US Central (Chicago)' },
  { id: 'America/Denver', es: 'EE. UU. Montaña (Denver)', en: 'US Mountain (Denver)' },
  { id: 'America/Los_Angeles', es: 'EE. UU. Pacífico (Los Ángeles)', en: 'US Pacific (Los Angeles)' },
  { id: 'America/Phoenix', es: 'EE. UU. Arizona (Phoenix)', en: 'US Arizona (Phoenix)' },
  { id: 'America/Mexico_City', es: 'México (CDMX)', en: 'Mexico (Mexico City)' },
  { id: 'America/Lima', es: 'Perú (Lima)', en: 'Peru (Lima)' },
  { id: 'America/Guayaquil', es: 'Ecuador (Quito)', en: 'Ecuador (Quito)' },
  { id: 'America/Panama', es: 'Panamá', en: 'Panama' },
  { id: 'America/Caracas', es: 'Venezuela (Caracas)', en: 'Venezuela (Caracas)' },
  { id: 'America/Santiago', es: 'Chile (Santiago)', en: 'Chile (Santiago)' },
  { id: 'America/Argentina/Buenos_Aires', es: 'Argentina (Buenos Aires)', en: 'Argentina (Buenos Aires)' },
  { id: 'America/Sao_Paulo', es: 'Brasil (São Paulo)', en: 'Brazil (São Paulo)' },
  { id: 'America/Costa_Rica', es: 'Costa Rica', en: 'Costa Rica' },
  { id: 'UTC', es: 'UTC', en: 'UTC' },
  { id: 'Europe/Madrid', es: 'España (Madrid)', en: 'Spain (Madrid)' },
  { id: 'Europe/London', es: 'Reino Unido (Londres)', en: 'United Kingdom (London)' },
];

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function knownZone(id: string) {
  return calendarTimeZones.find((zone) => zone.id === id);
}

export function normalizeTimeZone(id?: string) {
  const value = id?.trim();
  if (!value) return deviceTimeZone();
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return deviceTimeZone();
  }
}

function timeZoneOffsetMs(timeZone: string, instant: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

/** Wall-clock time in `timeZone` on `dateKey` → absolute Date. */
export function zonedWallToDate(dateKey: string, hourValue: number, timeZone: string) {
  const hours = Math.floor(hourValue);
  const minutes = Math.round((hourValue - hours) * 60);
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcGuess = Date.UTC(year, (month ?? 1) - 1, day ?? 1, hours, minutes, 0);
  const first = utcGuess - timeZoneOffsetMs(timeZone, new Date(utcGuess));
  return new Date(utcGuess - timeZoneOffsetMs(timeZone, new Date(first)));
}

export function dateToHourValue(date: Date) {
  return date.getHours() + date.getMinutes() / 60;
}

export function timeZoneAbbr(timeZone: string, at: Date, locale = 'en') {
  const tag = locale === 'es' ? 'es' : 'en-US';
  const name = new Intl.DateTimeFormat(tag, {
    timeZone,
    timeZoneName: 'short',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;
  return name || timeZone;
}

export function timeZoneGmtLabel(timeZone: string, at = new Date()) {
  const offsetMs = timeZoneOffsetMs(timeZone, at);
  const totalMinutes = Math.round(offsetMs / 60_000);
  const sign = totalMinutes >= 0 ? '+' : '−';
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes
    ? `GMT${sign}${hours}:${`${minutes}`.padStart(2, '0')}`
    : `GMT${sign}${hours}`;
}

export function timeZoneTitle(id: string, locale: string) {
  const zone = knownZone(id);
  if (zone) return locale === 'es' ? zone.es : zone.en;
  if (id === deviceTimeZone()) return locale === 'es' ? 'Tu zona horaria' : 'Your time zone';
  return id.replace(/_/g, ' ');
}

export function timeZoneRowLabel(id: string, locale: string, at = new Date()) {
  return `${timeZoneTitle(id, locale)} · ${timeZoneGmtLabel(id, at)}`;
}

export function sameTimeZone(a?: string, b?: string) {
  return normalizeTimeZone(a) === normalizeTimeZone(b);
}

export type CalendarTimeView = {
  dateKey: string;
  startHour?: number;
  endHour?: number;
  rangeLabel: string;
  localHint?: string;
};

export function calendarTimeView(
  item: {
    date: string;
    allDay: boolean;
    startHour?: number;
    endHour?: number;
    timeZone?: string;
  },
  locale = 'es',
): CalendarTimeView {
  if (item.allDay || item.startHour == null) {
    return {
      dateKey: item.date,
      rangeLabel: locale === 'es' ? 'Todo el día' : 'All day',
    };
  }

  const zone = normalizeTimeZone(item.timeZone);
  const device = deviceTimeZone();
  const startAt = zonedWallToDate(item.date, item.startHour, zone);
  const endAt =
    item.endHour != null ? zonedWallToDate(item.date, item.endHour, zone) : undefined;
  const start = formatHourValue(item.startHour);
  const end = item.endHour != null ? formatHourValue(item.endHour) : '';
  const range = end ? `${start} – ${end}` : start;

  if (sameTimeZone(zone, device)) {
    return {
      dateKey: item.date,
      startHour: item.startHour,
      endHour: item.endHour,
      rangeLabel: range,
    };
  }

  const abbr = timeZoneAbbr(zone, startAt, locale);
  const rangeLabel = `${range} ${abbr}`;

  const localStart = dateToHourValue(startAt);
  const localEnd = endAt ? dateToHourValue(endAt) : undefined;
  const here = locale === 'es' ? 'aquí' : 'here';
  const localRange = localEnd
    ? `${formatHourValue(localStart)} – ${formatHourValue(localEnd)} ${here}`
    : `${formatHourValue(localStart)} ${here}`;

  return {
    dateKey: toLocalDateKey(startAt),
    startHour: localStart,
    endHour: localEnd,
    rangeLabel,
    localHint: localRange,
  };
}

export function localEquivalentHint(
  dateKey: string,
  startHhmmHour: number,
  eventTimeZone: string,
  locale: string,
) {
  const zone = normalizeTimeZone(eventTimeZone);
  const device = deviceTimeZone();
  if (sameTimeZone(zone, device)) return '';
  const local = zonedWallToDate(dateKey, startHhmmHour, zone);
  const localHour = formatHourValue(dateToHourValue(local));
  const localDate = toLocalDateKey(local);
  const zoneName = timeZoneTitle(device, locale);
  if (localDate === dateKey) {
    return locale === 'es'
      ? `En ${zoneName} son las ${localHour}`
      : `That's ${localHour} in ${zoneName}`;
  }
  const [year, month, day] = localDate.split('-').map(Number);
  const dayLabel = new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    locale === 'es' ? 'es' : 'en-US',
    { weekday: 'short', day: 'numeric', month: 'short' },
  );
  return locale === 'es'
    ? `En ${zoneName} son las ${localHour} (${dayLabel})`
    : `That's ${localHour} in ${zoneName} (${dayLabel})`;
}

export function calendarTimeZoneOptions(locale: string, at = new Date()) {
  const device = deviceTimeZone();
  const ids = [device, ...calendarTimeZones.map((zone) => zone.id)].filter(
    (id, index, list) => list.indexOf(id) === index,
  );
  return ids.map((id) => ({
    value: id,
    label: timeZoneRowLabel(id, locale, at),
  }));
}
