export const needWantKinds = ['need', 'want', 'na'] as const;
export type NeedWant = (typeof needWantKinds)[number];

const businessIcons = new Set(['briefcase.fill', 'building.columns.fill']);

/** Invisible suffix so classification survives APIs that drop `needWant`. */
const NEED_WANT_MARK = /\u2060#nw:(need|want|na)\s*$/;

export function parseNeedWant(value: unknown): NeedWant | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'need' || normalized === 'want' || normalized === 'na') {
    return normalized;
  }
  return undefined;
}

export function embedNeedWant(description: string, needWant?: NeedWant | '' | null) {
  const base = (description ?? '').replace(NEED_WANT_MARK, '').trimEnd();
  const parsed = parseNeedWant(needWant ?? undefined);
  return parsed ? `${base}\u2060#nw:${parsed}` : base;
}

export function extractNeedWant(
  description: string | undefined,
  explicit?: unknown,
): NeedWant | undefined {
  return parseNeedWant(explicit) ?? parseNeedWant(description?.match(NEED_WANT_MARK)?.[1]);
}

export function displayNeedWantDescription(description: string | undefined) {
  return (description ?? '').replace(NEED_WANT_MARK, '').trimEnd();
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
