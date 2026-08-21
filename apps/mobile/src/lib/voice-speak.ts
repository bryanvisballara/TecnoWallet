import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { getActiveMoneyCurrency } from '@/data/demo';
import { speechLanguageForLocale } from '@/i18n/voice-copy';
import { useLanguageStore } from '@/store/language';

type SpeechModule = {
  speak: (
    text: string,
    options?: {
      language?: string;
      rate?: number;
      pitch?: number;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: () => void;
    },
  ) => void;
  stop: () => void;
};

type NativeSpeakModule = {
  speakAsync?: (text: string, options?: { language?: string; rate?: number }) => Promise<void>;
  stopSpeaking?: () => void;
  playListenCueAsync?: () => Promise<void>;
};

function loadExpoSpeech(): SpeechModule | null {
  try {
    // Optional until a rebuild includes expo-speech.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech') as SpeechModule;
  } catch {
    return null;
  }
}

const ExpoSpeech = loadExpoSpeech();
const NativeSpeak = (requireOptionalNativeModule('ExpoSpeechRecognition') ??
  null) as NativeSpeakModule | null;

export function isVoiceSpeechAvailable() {
  return (
    Boolean(NativeSpeak?.speakAsync) ||
    Boolean(ExpoSpeech) ||
    (Platform.OS === 'web' && typeof window !== 'undefined')
  );
}

/** Stop any in-progress utterance. */
export function stopVoiceSpeech() {
  try {
    NativeSpeak?.stopSpeaking?.();
  } catch {
    // ignore
  }
  try {
    ExpoSpeech?.stop();
  } catch {
    // ignore
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
  }
}

function playWebListenCue(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return Promise.resolve();

  return new Promise((resolve) => {
    try {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      master.connect(ctx.destination);

      const beep = (start: number, duration: number, hz: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(1, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + duration + 0.01);
      };

      beep(now, 0.07, 880);
      beep(now + 0.11, 0.09, 1320);
      const finish = () => {
        void ctx.close().catch(() => undefined);
        resolve();
      };
      setTimeout(finish, 280);
    } catch {
      resolve();
    }
  });
}

/**
 * Short two-tone chirp after “Te escucho” so the user knows they can start talking.
 */
export async function playListenCue(): Promise<void> {
  if (NativeSpeak?.playListenCueAsync) {
    try {
      await Promise.race([
        NativeSpeak.playListenCueAsync(),
        new Promise<void>((resolve) => setTimeout(resolve, 700)),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 80));
      return;
    } catch {
      // fall through
    }
  }
  if (Platform.OS === 'web') {
    await playWebListenCue();
  }
}

/**
 * Speak a short Spanish reply (Siri-style). Prefer the in-app native TTS
 * (AVSpeechSynthesizer via ExpoSpeechRecognition.speakAsync), then expo-speech, then web.
 */
export async function speakVoice(
  text: string,
  options?: { rate?: number; language?: string },
): Promise<void> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;

  stopVoiceSpeech();
  const rate = options?.rate ?? 0.96;
  const locale = useLanguageStore.getState().locale;
  const language = options?.language || speechLanguageForLocale(locale);
  const safetyMs = Math.min(8000, Math.max(1400, clean.length * 110));

  if (NativeSpeak?.speakAsync) {
    try {
      await Promise.race([
        NativeSpeak.speakAsync(clean, { language, rate }),
        new Promise<void>((resolve) => setTimeout(resolve, safetyMs)),
      ]);
      // Brief gap so iOS releases playback before recognition starts.
      await new Promise((resolve) => setTimeout(resolve, 280));
      return;
    } catch {
      // fall through
    }
  }

  if (ExpoSpeech) {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      try {
        ExpoSpeech.speak(clean, {
          language,
          rate,
          pitch: 1.04,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      } catch {
        finish();
        return;
      }
      setTimeout(finish, safetyMs);
    });
    await new Promise((resolve) => setTimeout(resolve, 280));
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const synth = window.speechSynthesis;
    if (synth) {
      await new Promise<void>((resolve) => {
        const utter = new SpeechSynthesisUtterance(clean);
        utter.lang = language;
        utter.rate = Math.min(1, rate);
        utter.pitch = 1.04;
        const voices = synth.getVoices?.() ?? [];
        const langPrefix = language.slice(0, 2).toLowerCase();
        const preferred =
          voices.find((item) => /paulina|samantha|nicky/i.test(item.name)) ||
          voices.find((item) =>
            /google.*español|microsoft.*(sabina|dalia|aria|jenny)/i.test(item.name),
          ) ||
          voices.find((item) => item.lang?.toLowerCase().startsWith(language.toLowerCase())) ||
          voices.find((item) => item.lang?.toLowerCase().startsWith(langPrefix));
        if (preferred) utter.voice = preferred;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        utter.onend = finish;
        utter.onerror = finish;
        synth.cancel();
        synth.speak(utter);
        setTimeout(finish, safetyMs);
      });
    }
  }
}

/** Amount phrasing that sounds natural when spoken aloud. */
export function spokenMoney(amount: number): string {
  const value = Math.abs(Math.round(amount));
  const locale = useLanguageStore.getState().locale;
  const currency = getActiveMoneyCurrency();
  const english = locale !== 'es';
  const unit =
    currency === 'USD'
      ? english
        ? value === 1
          ? 'dollar'
          : 'dollars'
        : 'dólares'
      : english
        ? 'pesos'
        : 'pesos';

  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const label = Number.isInteger(millions) ? String(millions) : millions.toFixed(1);
    return english ? `${label} million ${unit}` : `${label} millones de ${unit}`;
  }
  if (value >= 1000 && value % 1000 === 0) {
    return english ? `${value / 1000} thousand ${unit}` : `${value / 1000} mil ${unit}`;
  }
  if (value >= 1000) {
    const thousands = Math.floor(value / 1000);
    const rest = value % 1000;
    if (english) {
      return rest === 0
        ? `${thousands} thousand ${unit}`
        : `${thousands} thousand ${rest} ${unit}`;
    }
    return rest === 0
      ? `${thousands} mil ${unit}`
      : `${thousands} mil ${rest} ${unit}`;
  }
  return `${value} ${unit}`;
}
