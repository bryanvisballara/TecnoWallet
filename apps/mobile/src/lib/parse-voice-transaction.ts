import type { Envelope } from '@/data/demo';
import { getVoiceCopy } from '@/i18n/voice-copy';
import { useLanguageStore } from '@/store/language';

export type VoiceKind = 'expense' | 'income';

export type ParsedVoiceTransaction = {
  kind: VoiceKind;
  amount: number;
  title: string;
  envelopeName: string;
  envelopeId?: string;
};

export type MissingVoiceEnvelope = {
  missingEnvelope: string;
  kind: VoiceKind;
  amount: number;
  title: string;
};

const ENVELOPE_MATCH_MIN = 60;

const WORD_NUMBERS: Record<string, number> = {
  cero: 0,
  zero: 0,
  un: 1,
  una: 1,
  uno: 1,
  one: 1,
  dos: 2,
  two: 2,
  tres: 3,
  three: 3,
  cuatro: 4,
  four: 4,
  cinco: 5,
  five: 5,
  seis: 6,
  six: 6,
  siete: 7,
  seven: 7,
  ocho: 8,
  eight: 8,
  nueve: 9,
  nine: 9,
  diez: 10,
  ten: 10,
  once: 11,
  eleven: 11,
  doce: 12,
  twelve: 12,
  trece: 13,
  thirteen: 13,
  catorce: 14,
  fourteen: 14,
  quince: 15,
  fifteen: 15,
  dieciseis: 16,
  sixteen: 16,
  diecisiete: 17,
  seventeen: 17,
  dieciocho: 18,
  eighteen: 18,
  diecinueve: 19,
  nineteen: 19,
  veinte: 20,
  twenty: 20,
  treinta: 30,
  thirty: 30,
  cuarenta: 40,
  forty: 40,
  cincuenta: 50,
  fifty: 50,
  sesenta: 60,
  sixty: 60,
  setenta: 70,
  seventy: 70,
  ochenta: 80,
  eighty: 80,
  noventa: 90,
  ninety: 90,
  cien: 100,
  ciento: 100,
  hundred: 100,
};

const COMMAND_WORDS = new Set([
  'anade',
  'agrega',
  'agregar',
  'registra',
  'registrar',
  'pon',
  'poner',
  'anota',
  'anotar',
  'crea',
  'crear',
  'gasta',
  'gaste',
  'pague',
  'compra',
  'un',
  'una',
  'el',
  'la',
  'los',
  'las',
  'de',
  'del',
  'en',
  'por',
  'para',
  'con',
  'al',
  'a',
  'mi',
  'mis',
  'cop',
  'peso',
  'pesos',
  'dollar',
  'dollars',
  'usd',
  'gasto',
  'gastos',
  'ingreso',
  'ingresos',
  'expense',
  'expenses',
  'income',
  'categoria',
  'category',
  'sobre',
  'envelope',
  'cuenta',
  'account',
  'add',
  'added',
  'record',
  'register',
  'spend',
  'spent',
  'paid',
  'buy',
  'bought',
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'for',
  'with',
  'my',
  'to',
]);

export function foldVoiceText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseWordAmount(folded: string): number | null {
  const tokens = folded.split(' ');
  let total = 0;
  let current = 0;
  let found = false;
  for (const token of tokens) {
    if (token === 'mil' || token === 'thousand') {
      current = Math.max(current, 1) * 1000;
      found = true;
      continue;
    }
    if (token === 'millon' || token === 'millones' || token === 'million') {
      current = Math.max(current, 1) * 1_000_000;
      found = true;
      continue;
    }
    const mapped = WORD_NUMBERS[token];
    if (mapped === undefined) {
      if (found && current) {
        total += current;
        current = 0;
      }
      continue;
    }
    current += mapped;
    found = true;
  }
  total += current;
  return found && total > 0 ? total : null;
}

export function parseVoiceAmount(text: string): number | null {
  const folded = foldVoiceText(text);
  const numeric = folded.match(
    /(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:\s*(mil|millon(?:es)?|thousand|million))?/,
  );
  if (numeric) {
    const raw = numeric[1].replace(/[.\s]/g, '');
    let value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return parseWordAmount(folded);
    if (numeric[2]?.startsWith('millon') || numeric[2] === 'million') value *= 1_000_000;
    else if (numeric[2] === 'mil' || numeric[2] === 'thousand') value *= 1000;
    return value;
  }
  return parseWordAmount(folded);
}

export function parseVoiceKind(text: string): VoiceKind {
  const folded = foldVoiceText(text);
  if (
    /\b(ingreso|ingresos|cobre|recibi|recibir|sueldo|nomina|salario|income|salary|paycheck|earned|received)\b/.test(
      folded,
    )
  ) {
    return 'income';
  }
  return 'expense';
}

function leftoverLabel(text: string): string {
  const folded = foldVoiceText(text)
    .replace(/\d{1,3}(?:[.\s]\d{3})+|\d+/g, ' ')
    .replace(/\b(mil|millon(?:es)?|thousand|million|cop|pesos?|dollars?|usd)\b/g, ' ');
  const words = folded
    .split(' ')
    .filter((word) => word && !COMMAND_WORDS.has(word) && !(word in WORD_NUMBERS));
  return words.join(' ').trim();
}

export function titleCaseVoiceLabel(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

function scoreEnvelope(name: string, query: string) {
  const foldedName = foldVoiceText(name);
  if (!query || query.length < 2) return 0;
  if (foldedName === query) return 100;
  if (
    query.length >= 3 &&
    (foldedName.includes(query) || query.includes(foldedName))
  ) {
    return 80;
  }
  const nameParts = foldedName.split(' ');
  const queryParts = query.split(' ');
  const overlap = queryParts.filter((part) =>
    nameParts.some((item) => item === part),
  );
  return overlap.length * 40;
}

export function matchVoiceEnvelope(
  envelopes: Envelope[],
  kind: VoiceKind,
  query: string,
): Envelope | undefined {
  if (!query) return undefined;
  const pool = envelopes.filter((item) => item.kind === kind);
  const source = pool.length ? pool : envelopes;
  if (!source.length) return undefined;
  let best: Envelope | undefined;
  let bestScore = 0;
  for (const item of source) {
    const score = scoreEnvelope(item.name, query);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return bestScore >= ENVELOPE_MATCH_MIN ? best : undefined;
}

export function parseVoiceTransaction(
  transcript: string,
  envelopes: Envelope[],
): ParsedVoiceTransaction | MissingVoiceEnvelope | { error: string } {
  const copy = getVoiceCopy(useLanguageStore.getState().locale);
  const amount = parseVoiceAmount(transcript);
  if (!amount) {
    return { error: copy.parseAmount };
  }
  const kind = parseVoiceKind(transcript);
  const query = leftoverLabel(transcript);
  if (!query) {
    return {
      error: copy.parseEnvelope,
    };
  }
  const title = titleCaseVoiceLabel(query);
  const envelope = matchVoiceEnvelope(envelopes, kind, query);
  if (!envelope) {
    return {
      missingEnvelope: title,
      kind,
      amount,
      title,
    };
  }
  return {
    kind,
    amount,
    title,
    envelopeName: envelope.name,
    envelopeId: envelope.id,
  };
}
