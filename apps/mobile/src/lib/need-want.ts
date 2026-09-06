export const needWantKinds = ['need', 'want', 'na'] as const;
export type NeedWant = (typeof needWantKinds)[number];

const businessIcons = new Set(['briefcase.fill', 'building.columns.fill']);

export function parseNeedWant(value: unknown): NeedWant | undefined {
  if (value === 'need' || value === 'want' || value === 'na') return value;
  return undefined;
}

export function needWantLabel(value: NeedWant | undefined, locale = 'es') {
  if (value === 'need') return locale === 'en' ? 'Need' : 'Necesidad';
  if (value === 'want') return locale === 'en' ? 'Want' : 'Deseo';
  if (value === 'na') return locale === 'en' ? 'N/A' : 'No aplica';
  return '';
}

export function isBusinessLedger(ledger?: { name?: string; icon?: string } | null) {
  if (!ledger) return false;
  if (ledger.icon && businessIcons.has(ledger.icon)) return true;
  const name = (ledger.name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(negocio|business|empresa|trabajo|work|company|pyme)\b/.test(name);
}

export function defaultNeedWant(
  ledger?: { name?: string; icon?: string } | null,
): NeedWant | undefined {
  return isBusinessLedger(ledger) ? 'na' : undefined;
}
