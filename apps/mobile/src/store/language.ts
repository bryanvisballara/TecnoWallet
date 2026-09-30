import { NativeModules, Platform } from 'react-native';
import { create } from 'zustand';

import { languages, type Locale } from '@/i18n/languages';
import { setActiveMoneyLocale } from '@/lib/money-format';
import { localStorage } from '@/services/persistence';

type LanguageState = {
  locale: Locale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
};

const isLocale = (value: string): value is Locale =>
  languages.some((language) => language.code === value);

function deviceLanguageTags() {
  const tags: string[] = [];
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings as
      | { AppleLocale?: string; AppleLanguages?: string[] }
      | undefined;
    if (Array.isArray(settings?.AppleLanguages)) tags.push(...settings.AppleLanguages);
    if (settings?.AppleLocale) tags.push(settings.AppleLocale);
  } else if (Platform.OS === 'android') {
    const identifier = NativeModules.I18nManager?.localeIdentifier;
    if (typeof identifier === 'string') tags.push(identifier);
  } else if (typeof navigator !== 'undefined') {
    tags.push(...(navigator.languages ?? []), navigator.language);
  }
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intl) tags.push(intl);
  } catch {
    // Intl can be missing in older runtimes; English is the fallback below.
  }
  return tags;
}

/** Phone language on first launch. Unknown languages use English. */
export function localeFromDevice(): Locale {
  for (const tag of deviceLanguageTags()) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return 'en';
}

function syncPeriodLabel() {
  // Lazy require avoids a circular import with period.ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { usePeriodStore } = require('@/store/period') as typeof import('@/store/period');
  usePeriodStore.getState().refreshLabel();
}

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: 'es',
  hydrated: false,
  hydrate: async () => {
    try {
      const saved = await localStorage.get<string>('locale', '');
      const locale = isLocale(saved) ? saved : localeFromDevice();
      if (!isLocale(saved)) await localStorage.set('locale', locale);
      setActiveMoneyLocale(locale);
      set({ locale, hydrated: true });
      syncPeriodLabel();
    } catch {
      const locale = localeFromDevice();
      setActiveMoneyLocale(locale);
      set({ locale, hydrated: true });
    }
  },
  setLocale: async (locale) => {
    await localStorage.set('locale', locale);
    setActiveMoneyLocale(locale);
    set({ locale });
    syncPeriodLabel();
  },
}));
