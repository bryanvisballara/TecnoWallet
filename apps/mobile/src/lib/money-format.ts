let activeMoneyCurrency = 'USD';
let activeMoneyLocale = 'es-CO';

/** Sync display currency with the active ledger (Más → Divisa). */
export function setActiveMoneyCurrency(code: string) {
  const next = code.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(next)) activeMoneyCurrency = next;
}

export function getActiveMoneyCurrency() {
  return activeMoneyCurrency;
}

/** Sync number/currency formatting with the app language (Más → Idioma). */
export function setActiveMoneyLocale(locale: string) {
  activeMoneyLocale = locale === 'es' ? 'es-CO' : 'en-US';
}

export function getActiveMoneyLocale() {
  return activeMoneyLocale;
}

export const money = (value: number, compact = false, currency?: string) => {
  const code = (currency || activeMoneyCurrency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(activeMoneyLocale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      notation: compact ? 'compact' : 'standard',
    }).format(value);
  } catch {
    return `${Math.round(value)} ${code}`;
  }
};

/** Amount digits only (no currency code/symbol) — use with titles that show the currency. */
export const moneyAmount = (value: number, compact = false) =>
  new Intl.NumberFormat(activeMoneyLocale, {
    style: 'decimal',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
