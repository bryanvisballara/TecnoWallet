import {
  bogotaWallTimeToUtc,
  effectiveCalendarReminderAt,
  resolveCalendarReminderAt,
  withReminderSchedule,
} from './calendar-reminder.util';

describe('calendar-reminder.util', () => {
  it('maps Bogota wall time to UTC (UTC-5, no DST)', () => {
    expect(bogotaWallTimeToUtc(2026, 8, 11, 22, 5).toISOString()).toBe(
      '2026-08-12T03:05:00.000Z',
    );
    expect(bogotaWallTimeToUtc(2026, 8, 11, 9, 0).toISOString()).toBe(
      '2026-08-11T14:00:00.000Z',
    );
  });

  it('resolves minutes-before against Bogota event start', () => {
    const fireAt = resolveCalendarReminderAt({
      date: '2026-08-11',
      allDay: false,
      startHour: 22 + 5 / 60,
      reminder: '15 minutos antes',
    });
    expect(fireAt?.toISOString()).toBe('2026-08-12T02:50:00.000Z');
  });

  it('prefers client absolute reminderAt when flagged', () => {
    const fireAt = effectiveCalendarReminderAt({
      date: '2026-08-11',
      allDay: false,
      startHour: 22,
      reminder: '15 minutos antes',
      reminderAt: '2026-08-12T01:00:00.000Z',
      reminderAtClient: true,
    });
    expect(fireAt?.toISOString()).toBe('2026-08-12T01:00:00.000Z');
  });

  it('ignores stale server reminderAt without client flag (recomputes Bogota)', () => {
    const fireAt = effectiveCalendarReminderAt({
      date: '2026-08-11',
      allDay: false,
      startHour: 22,
      reminder: 'En el momento',
      // Wrong value from old UTC Date#setHours on Render
      reminderAt: '2026-08-11T22:00:00.000Z',
    });
    expect(fireAt?.toISOString()).toBe('2026-08-12T03:00:00.000Z');
  });

  it('persists client reminderAt through withReminderSchedule', () => {
    const next = withReminderSchedule({
      title: 'Standup',
      date: '2026-08-11',
      type: 'event',
      allDay: false,
      startHour: 10,
      reminder: '15 minutos antes',
      reminderAt: '2026-08-11T14:45:00.000Z',
      reminderAtClient: true,
    });
    expect(next.reminderAt).toBe('2026-08-11T14:45:00.000Z');
    expect(next.reminderAtClient).toBe(true);
  });
});
