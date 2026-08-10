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
    const saved = await localStorage.get('locale', 'es');
    set({ locale: isLocale(saved) ? saved : 'es', hydrated: true });
    syncPeriodLabel();
  },
  setLocale: async (locale) => {
    await localStorage.set('locale', locale);
    set({ locale });
    syncPeriodLabel();
  },
}));
