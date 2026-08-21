import { useLanguageStore } from '@/store/language';
import type { Locale } from '@/i18n/languages';

export type VoiceCopy = {
  listening: string;
  listeningShort: string;
  speakAfterBeep: string;
  speakNow: string;
  speakHint: string;
  listeningHint: string;
  saving: string;
  cancel: string;
  done: string;
  close: string;
  micA11y: string;
  noSpeech: string;
  parseAmount: string;
  parseEnvelope: string;
  parseTitle: string;
  missingEnvelope: (name: string) => string;
  missingEnvelopeBody: (name: string) => string;
  envelopeMissingTitle: string;
  needAccountTitle: string;
  createAndSave: string;
  recorded: (kind: 'income' | 'expense', amount: string, envelope: string) => string;
  needAccount: (ledger: string) => string;
  saveFailed: string;
  createEnvelopeFailed: string;
  dictationUnavailableWeb: string;
  dictationUnavailableNative: string;
  recognitionUnavailable: string;
  micPermission: string;
  network: string;
  micTimeout: string;
  listenFailed: string;
};

const en: VoiceCopy = {
  listening: "I'm listening",
  listeningShort: "I'm listening…",
  speakAfterBeep: 'Speak after the beep…',
  speakNow: 'Speak now',
  speakHint: 'Speak now…\ne.g. “add 20 in sports”',
  listeningHint: 'It saves when you finish the phrase, or tap Done.',
  saving: 'Saving…',
  cancel: 'Cancel',
  done: 'Done',
  close: 'Close dictation',
  micA11y: 'Log a transaction by voice',
  noSpeech: 'I didn’t catch that. Try “add 20 in sports”.',
  parseAmount: 'I didn’t catch the amount. Try “add 20 in sports”.',
  parseEnvelope: 'Name the envelope, for example: “add 20 in sports”.',
  parseTitle: 'I didn’t understand the transaction',
  missingEnvelope: (name) =>
    `The envelope ${name} doesn’t exist. Should I create it and save the transaction?`,
  missingEnvelopeBody: (name) =>
    `The envelope “${name}” doesn’t exist. Create it first, or create it now and save this transaction.`,
  envelopeMissingTitle: 'Envelope not found',
  needAccountTitle: 'Account needed',
  createAndSave: 'Create and save',
  recorded: (kind, amount, envelope) =>
    `Done. I logged ${kind === 'income' ? 'income' : 'an expense'} of ${amount} in ${envelope}.`,
  needAccount: (ledger) => `Create an account in ${ledger} to log the transaction.`,
  saveFailed: 'Couldn’t save. Try again.',
  createEnvelopeFailed: 'Couldn’t create the envelope. Try again.',
  dictationUnavailableWeb: 'Use Chrome or Safari to log expenses by voice.',
  dictationUnavailableNative:
    'Reinstall TecnoWallet on the iPhone to enable the microphone.',
  recognitionUnavailable: 'Speech recognition isn’t available right now. Try again in a few seconds.',
  micPermission: 'Turn on the microphone and speech recognition in Settings → TecnoWallet.',
  network: 'I need an internet connection to hear you. Check Wi‑Fi and try again.',
  micTimeout: 'The microphone took too long to start. Tap the voice button and try again.',
  listenFailed: 'I couldn’t hear you. Try again.',
};

const es: VoiceCopy = {
  listening: 'Te escucho',
  listeningShort: 'Te escucho…',
  speakAfterBeep: 'Habla después del pitido…',
  speakNow: 'Habla ahora',
  speakHint: 'Habla ahora…\nej. “añade 20 mil en deporte”',
  listeningHint: 'Se guarda solo cuando termines la frase, o toca Listo.',
  saving: 'Registrando…',
  cancel: 'Cancelar',
  done: 'Listo',
  close: 'Cerrar dictado',
  micA11y: 'Registrar movimiento por voz',
  noSpeech: 'No escuché nada. Di por ejemplo: añade 20 mil en deporte.',
  parseAmount: 'No entendí el monto. Prueba con “añade 20 mil en deporte”.',
  parseEnvelope: 'Indica el sobre, por ejemplo: “añade 20 mil en deporte”.',
  parseTitle: 'No entendí el movimiento',
  missingEnvelope: (name) =>
    `El sobre ${name} no existe. ¿Lo creo y guardo el movimiento?`,
  missingEnvelopeBody: (name) =>
    `El sobre “${name}” no existe. Créalo primero, o créalo ahora y guarda este movimiento.`,
  envelopeMissingTitle: 'Sobre no encontrado',
  needAccountTitle: 'Falta una cuenta',
  createAndSave: 'Crear y guardar',
  recorded: (kind, amount, envelope) =>
    `Listo. Registré un ${kind === 'income' ? 'ingreso' : 'gasto'} de ${amount} en ${envelope}.`,
  needAccount: (ledger) =>
    `Crea una cuenta en ${ledger} para registrar el movimiento.`,
  saveFailed: 'No se pudo guardar. Inténtalo de nuevo.',
  createEnvelopeFailed: 'No se pudo crear el sobre. Inténtalo de nuevo.',
  dictationUnavailableWeb: 'Usa Chrome o Safari para registrar gastos por voz.',
  dictationUnavailableNative:
    'Hay que reinstalar TecnoWallet en el iPhone para activar el micrófono. El botón ya está; falta el módulo nativo en este build.',
  recognitionUnavailable:
    'El reconocimiento de voz no está disponible ahora mismo. Inténtalo en unos segundos.',
  micPermission: 'Activa el micrófono y el reconocimiento de voz en Ajustes → TecnoWallet.',
  network: 'Necesito conexión a internet para escucharte. Revisa el Wi‑Fi e inténtalo de nuevo.',
  micTimeout: 'El micrófono tardó en activarse. Toca el botón de voz e inténtalo de nuevo.',
  listenFailed: 'No pudimos escuchar. Inténtalo de nuevo.',
};

export function getVoiceCopy(locale: Locale = 'es'): VoiceCopy {
  return locale === 'es' ? es : en;
}

export function useVoiceCopy() {
  const locale = useLanguageStore((state) => state.locale);
  return getVoiceCopy(locale);
}

/** BCP-47 tag for TTS / speech recognition. */
export function speechLanguageForLocale(locale: Locale | string): string {
  const map: Record<string, string> = {
    es: 'es-MX',
    en: 'en-US',
    pt: 'pt-BR',
    it: 'it-IT',
    fr: 'fr-FR',
    de: 'de-DE',
    ru: 'ru-RU',
    zh: 'zh-CN',
    ja: 'ja-JP',
    ko: 'ko-KR',
    hi: 'hi-IN',
    ar: 'ar-SA',
    nl: 'nl-NL',
    pl: 'pl-PL',
    tr: 'tr-TR',
    uk: 'uk-UA',
  };
  return map[locale] ?? 'en-US';
}

export function speechLangFallbacks(lang: string): string[] {
  const prefix = lang.slice(0, 2).toLowerCase();
  if (prefix === 'es') return ['es-MX', 'es-CO', 'es-ES', 'es-US'];
  if (prefix === 'en') return ['en-US', 'en-GB', 'en-AU'];
  if (prefix === 'pt') return ['pt-BR', 'pt-PT'];
  return [lang];
}
