import { create } from 'zustand';

import { languages, type Locale } from '@/i18n/languages';
import { localStorage } from '@/services/persistence';

type LanguageState = {
  locale: Locale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
};

const isLocale = (value: string): value is Locale =>
  languages.some((language) => language.code === value);

export const useLanguageStore = create<LanguageState>((set) => ({
  locale: 'es',
  hydrated: false,
  hydrate: async () => {
    const saved = await localStorage.get('locale', 'es');
    set({ locale: isLocale(saved) ? saved : 'es', hydrated: true });
  },
  setLocale: async (locale) => {
    await localStorage.set('locale', locale);
    set({ locale });
  },
}));
