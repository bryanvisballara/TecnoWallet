import { create } from 'zustand';

import { localStorage } from '@/services/persistence';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type WeekStartsOn = 'sunday' | 'monday';
export type AutoLockDelay = 'immediate' | '1m' | '5m';

type PreferencesState = {
  hapticsEnabled: boolean;
  appearance: AppearanceMode;
  remindersEnabled: boolean;
  reminderPayments: boolean;
  reminderGoals: boolean;
  reminderCalendar: boolean;
  biometricsLockEnabled: boolean;
  hideBalances: boolean;
  weekStartsOn: WeekStartsOn;
  autoLockDelay: AutoLockDelay;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setHapticsEnabled: (value: boolean) => Promise<void>;
  setAppearance: (value: AppearanceMode) => Promise<void>;
  setRemindersEnabled: (value: boolean) => Promise<void>;
  setReminderPayments: (value: boolean) => Promise<void>;
  setReminderGoals: (value: boolean) => Promise<void>;
  setReminderCalendar: (value: boolean) => Promise<void>;
  setBiometricsLockEnabled: (value: boolean) => Promise<void>;
  setHideBalances: (value: boolean) => Promise<void>;
  setWeekStartsOn: (value: WeekStartsOn) => Promise<void>;
  setAutoLockDelay: (value: AutoLockDelay) => Promise<void>;
};

const appearanceLabelsEs: Record<AppearanceMode, string> = {
  system: 'Automático · sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

const appearanceLabelsEn: Record<AppearanceMode, string> = {
  system: 'Automatic · system',
  light: 'Light',
  dark: 'Dark',
};

const weekLabelsEs: Record<WeekStartsOn, string> = {
  monday: 'Lunes',
  sunday: 'Domingo',
};

const weekLabelsEn: Record<WeekStartsOn, string> = {
  monday: 'Monday',
  sunday: 'Sunday',
};

const autoLockLabels: Record<AutoLockDelay, string> = {
  immediate: 'Al salir',
  '1m': '1 minuto',
  '5m': '5 minutos',
};

export function appearanceLabel(
  mode: AppearanceMode,
  locale: string = 'es',
) {
  return (locale === 'es' ? appearanceLabelsEs : appearanceLabelsEn)[mode];
}

export function weekStartsOnLabel(value: WeekStartsOn, locale: string = 'es') {
  return (locale === 'es' ? weekLabelsEs : weekLabelsEn)[value];
}

export function autoLockDelayLabel(value: AutoLockDelay) {
  return autoLockLabels[value];
}

export function weekStartsOnJsDay(value: WeekStartsOn): 0 | 1 {
  return value === 'monday' ? 1 : 0;
}

function isAppearance(value: string): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isWeekStartsOn(value: string): value is WeekStartsOn {
  return value === 'sunday' || value === 'monday';
}

function isAutoLockDelay(value: string): value is AutoLockDelay {
  return value === 'immediate' || value === '1m' || value === '5m';
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  hapticsEnabled: true,
  appearance: 'system',
  remindersEnabled: true,
  reminderPayments: true,
  reminderGoals: true,
  reminderCalendar: true,
  biometricsLockEnabled: false,
  hideBalances: false,
  weekStartsOn: 'monday',
  autoLockDelay: 'immediate',
  hydrated: false,

  hydrate: async () => {
    const [
      haptics,
      appearance,
      reminders,
      reminderPayments,
      reminderGoals,
      reminderCalendar,
      biometrics,
      hideBalances,
      weekStartsOn,
      autoLockDelay,
    ] = await Promise.all([
      localStorage.get('prefs-haptics', true),
      localStorage.get('prefs-appearance', 'system'),
      localStorage.get('prefs-reminders', true),
      localStorage.get('prefs-reminder-payments', true),
      localStorage.get('prefs-reminder-goals', true),
      localStorage.get('prefs-reminder-calendar', true),
      localStorage.get('prefs-biometrics-lock', false),
      localStorage.get('prefs-hide-balances', false),
      localStorage.get('prefs-week-starts', 'monday'),
      localStorage.get('prefs-auto-lock', 'immediate'),
    ]);
    set({
      hapticsEnabled: haptics !== false,
      appearance: isAppearance(appearance) ? appearance : 'system',
      remindersEnabled: reminders !== false,
      reminderPayments: reminderPayments !== false,
      reminderGoals: reminderGoals !== false,
      reminderCalendar: reminderCalendar !== false,
      biometricsLockEnabled: biometrics === true,
      hideBalances: hideBalances === true,
      weekStartsOn: isWeekStartsOn(weekStartsOn) ? weekStartsOn : 'monday',
      autoLockDelay: isAutoLockDelay(autoLockDelay) ? autoLockDelay : 'immediate',
      hydrated: true,
    });
  },

  setHapticsEnabled: async (value) => {
    await localStorage.set('prefs-haptics', value);
    set({ hapticsEnabled: value });
  },

  setAppearance: async (value) => {
    await localStorage.set('prefs-appearance', value);
    set({ appearance: value });
  },

  setRemindersEnabled: async (value) => {
    await localStorage.set('prefs-reminders', value);
    set({ remindersEnabled: value });
  },

  setReminderPayments: async (value) => {
    await localStorage.set('prefs-reminder-payments', value);
    set({ reminderPayments: value });
  },

  setReminderGoals: async (value) => {
    await localStorage.set('prefs-reminder-goals', value);
    set({ reminderGoals: value });
  },

  setReminderCalendar: async (value) => {
    await localStorage.set('prefs-reminder-calendar', value);
    set({ reminderCalendar: value });
  },

  setBiometricsLockEnabled: async (value) => {
    await localStorage.set('prefs-biometrics-lock', value);
    set({ biometricsLockEnabled: value });
  },

  setHideBalances: async (value) => {
    await localStorage.set('prefs-hide-balances', value);
    set({ hideBalances: value });
  },

  setWeekStartsOn: async (value) => {
    await localStorage.set('prefs-week-starts', value);
    set({ weekStartsOn: value });
  },

  setAutoLockDelay: async (value) => {
    await localStorage.set('prefs-auto-lock', value);
    set({ autoLockDelay: value });
  },
}));
