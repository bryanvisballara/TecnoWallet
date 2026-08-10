import type { Locale } from '@/i18n/languages';

export function intlLocale(locale: Locale | string) {
  return locale === 'es' ? 'es-CO' : 'en-US';
}

export function dateLocale(locale: Locale | string) {
  return locale === 'es' ? 'es-ES' : 'en-US';
}
