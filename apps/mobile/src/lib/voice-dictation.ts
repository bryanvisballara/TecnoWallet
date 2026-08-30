import { requireOptionalNativeModule } from 'expo';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { AppState, Platform } from 'react-native';

import { getVoiceCopy, speechLangFallbacks, speechLanguageForLocale } from '@/i18n/voice-copy';
import { useLanguageStore } from '@/store/language';

export type VoiceDictationHandlers = {
  onTranscript: (value: { finalText: string; interimText: string }) => void;
  onLevel?: (value: number) => void;
  onError?: (message: string) => void;
  onStarted?: () => void;
  /** Fired when the engine thinks the user finished an utterance (final segment). */
  onUtteranceFinal?: (fullText: string) => void;
};

export type VoiceDictationSession = {
  stop: () => void;
};

type SpeechNative = {
  start: (options: object) => void;
  stop: () => void;
  abort: () => void;
  requestMicrophonePermissionsAsync: () => Promise<{ granted: boolean }>;
  requestSpeechRecognizerPermissionsAsync: () => Promise<{ granted: boolean }>;
  setCategoryIOS: (options: object) => void;
  setAudioSessionActiveIOS: (
    active: boolean,
    options?: { notifyOthersOnDeactivation?: boolean },
  ) => void;
  isRecognitionAvailable: () => boolean;
  supportsOnDeviceRecognition: () => boolean;
  addListener: (
    event: string,
    cb: (event?: ExpoSpeechRecognitionResultEvent &
      ExpoSpeechRecognitionErrorEvent & { value?: number }) => void,
  ) => { remove: () => void };
};

const Speech = requireOptionalNativeModule(
  'ExpoSpeechRecognition',
) as SpeechNative | null;

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function speechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function startAnalyser(
  onLevel: (value: number) => void,
): Promise<{ stop: () => void }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve({ stop: () => undefined });
  }
  return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      stream.getTracks().forEach((track) => track.stop());
      return { stop: () => undefined };
    }
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let alive = true;
    let lastLevelAt = 0;
    const tick = () => {
      if (!alive) return;
      analyser.getByteFrequencyData(data);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - lastLevelAt > 70) {
        lastLevelAt = now;
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i] ?? 0;
        onLevel(Math.min(1, sum / (data.length * 180)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return {
      stop: () => {
        alive = false;
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((track) => track.stop());
        void ctx.close().catch(() => undefined);
      },
    };
  });
}

export function isVoiceDictationSupported() {
  if (Platform.OS === 'web') return Boolean(speechCtor());
  try {
    return typeof Speech?.start === 'function';
  } catch {
    return false;
  }
}

export function voiceDictationUnavailableMessage() {
  const copy = getVoiceCopy(useLanguageStore.getState().locale);
  if (Platform.OS === 'web') {
    return copy.dictationUnavailableWeb;
  }
  return copy.dictationUnavailableNative;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForAppActive(timeoutMs = 4000) {
  if (Platform.OS === 'web' || AppState.currentState === 'active') {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve();
    }, timeoutMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      clearTimeout(timer);
      sub.remove();
      resolve();
    });
  });
}

function isTransientSpeechError(error?: string, message?: string) {
  const text = `${error ?? ''} ${message ?? ''}`.toLowerCase();
  return (
    text.includes('209') ||
    text.includes('kafassistant') ||
    text.includes('timeout') ||
    text.includes('busy') ||
    text.includes('interrupted') ||
    text.includes('audio session') ||
    error === 'busy' ||
    error === 'interrupted' ||
    error === 'audio-capture' ||
    error === 'service-not-allowed'
  );
}

export function friendlySpeechError(error?: string, message?: string) {
  const copy = getVoiceCopy(useLanguageStore.getState().locale);
  if (error === 'not-allowed' || /not-allowed|permission/i.test(message ?? '')) {
    return copy.micPermission;
  }
  if (error === 'network' || /network/i.test(message ?? '')) {
    return copy.network;
  }
  if (isTransientSpeechError(error, message)) {
    return copy.micTimeout;
  }
  const raw = `${error ?? ''} ${message ?? ''}`;
  if (/kAFAssistant|operation couldn|NSCocoaError|error \d+|domain/i.test(raw)) {
    return copy.listenFailed;
  }
  const clean = message?.trim();
  if (clean && !/domain|error \d+|NS[A-Z]/i.test(clean)) return clean;
  return copy.listenFailed;
}

function startWebDictation(handlers: VoiceDictationHandlers, lang: string): VoiceDictationSession {
  const Ctor = speechCtor();
  const copy = getVoiceCopy(useLanguageStore.getState().locale);
  if (!Ctor) {
    throw new Error(copy.dictationUnavailableWeb);
  }

  let stopped = false;
  let recognition: InstanceType<SpeechRecognitionCtor> | null = null;
  let analyserStop = () => undefined;
  let finalText = '';

  const startRec = () => {
    if (stopped) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let finals = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const item = event.results[i];
        if (!item) continue;
        const piece = item[0]?.transcript ?? '';
        if (item.isFinal) finals += `${piece} `;
        else interimText += piece;
      }
      finals = finals.replace(/\s+/g, ' ').trim();
      interimText = interimText.replace(/\s+/g, ' ').trim();
      if (finals) finalText = `${finalText} ${finals}`.trim();
      handlers.onTranscript({ finalText, interimText });
      if (finals) handlers.onUtteranceFinal?.(finalText);
    };
    rec.onerror = (event) => {
      if (stopped) return;
      const code = event.error ?? '';
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed') {
        handlers.onError?.(copy.micPermission);
        return;
      }
      handlers.onError?.(copy.listenFailed);
    };
    rec.onend = () => {
      if (stopped) return;
      window.setTimeout(startRec, 180);
    };
    recognition = rec;
    try {
      rec.start();
      handlers.onStarted?.();
    } catch {
      // Already started.
    }
  };

  startRec();
  void startAnalyser((value) => handlers.onLevel?.(value))
    .then((analyser) => {
      if (stopped) {
        analyser.stop();
        return;
      }
      analyserStop = analyser.stop;
    })
    .catch(() => undefined);

  return {
    stop: () => {
      stopped = true;
      analyserStop();
      try {
        recognition?.abort();
      } catch {
        try {
          recognition?.stop();
        } catch {
          // ignore
        }
      }
      recognition = null;
    },
  };
}

async function ensureNativePermissions() {
  if (!Speech) {
    throw new Error(voiceDictationUnavailableMessage());
  }
  const copy = getVoiceCopy(useLanguageStore.getState().locale);
  const mic = await Speech.requestMicrophonePermissionsAsync();
  if (!mic.granted) {
    throw new Error(copy.micPermission);
  }
  // Prefer mic-only when possible; speech permission is still needed for cloud STT on iOS.
  const speech = await Speech.requestSpeechRecognizerPermissionsAsync();
  if (!speech.granted) {
    // Continue: on-device may still work with mic alone.
  }
}

function prepareIosAudioSession() {
  if (Platform.OS !== 'ios' || !Speech) return;
  try {
    Speech.setCategoryIOS({
      category: 'playAndRecord',
      categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
      mode: 'measurement',
    });
  } catch {
    // ignore
  }
  try {
    Speech.setAudioSessionActiveIOS(true, {
      notifyOthersOnDeactivation: false,
    });
  } catch {
    // ignore
  }
}

function releaseIosAudioSession() {
  if (Platform.OS !== 'ios' || !Speech) return;
  try {
    Speech.setAudioSessionActiveIOS(false, {
      notifyOthersOnDeactivation: true,
    });
  } catch {
    // ignore
  }
}

function buildStartOptions(lang: string, onDevice: boolean) {
  return {
    lang,
    interimResults: true,
    continuous: true,
    addsPunctuation: false,
    maxAlternatives: 1,
    requiresOnDeviceRecognition: onDevice,
    iosTaskHint: 'dictation' as const,
    iosCategory: {
      category: 'playAndRecord' as const,
      categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'] as const,
      mode: 'measurement' as const,
    },
    contextualStrings: [
      'añade',
      'agrega',
      'gasto',
      'gastos',
      'ingreso',
      'mil',
      'pesos',
      'add',
      'expense',
      'income',
      'dollars',
      'sports',
      'deporte',
      'comida',
      'transporte',
      'sobre',
      'envelope',
    ],
    volumeChangeEventOptions: { enabled: true, intervalMillis: 60 },
  };
}

async function startNativeDictation(
  handlers: VoiceDictationHandlers,
  lang: string,
): Promise<VoiceDictationSession> {
  if (!Speech || !isVoiceDictationSupported()) {
    throw new Error(voiceDictationUnavailableMessage());
  }

  const copy = getVoiceCopy(useLanguageStore.getState().locale);
  await ensureNativePermissions();

  if (!Speech.isRecognitionAvailable()) {
    throw new Error(copy.recognitionUnavailable);
  }

  await waitForAppActive();
  await delay(AppState.currentState !== 'active' ? 800 : 200);

  // Make sure nothing else owns the mic (prior TTS / previous session).
  try {
    Speech.abort();
  } catch {
    // ignore
  }
  releaseIosAudioSession();
  await delay(250);
  prepareIosAudioSession();
  await delay(150);

  let stopped = false;
  let finalText = '';
  let retries = 0;
  let startedNotified = false;
  let langIndex = 0;
  const langOptions = speechLangFallbacks(lang);
  let currentLang = langOptions[0] ?? lang;
  // Cloud STT first. Fall back to on-device if network fails.
  let preferOnDevice = false;
  const maxRetries = 3;

  const startEngine = () => {
    if (stopped) return;
    prepareIosAudioSession();
    try {
      Speech.start(buildStartOptions(currentLang, preferOnDevice));
    } catch {
      // Already started.
    }
  };

  const subs = [
    Speech.addListener('start', () => {
      if (stopped || startedNotified) return;
      startedNotified = true;
      retries = 0;
      handlers.onStarted?.();
    }),
    Speech.addListener(
      'result',
      (event: ExpoSpeechRecognitionResultEvent) => {
        if (stopped) return;
        const piece = (event.results ?? [])
          .map((item) => item.transcript)
          .join(' ')
          .trim();
        if (!piece) return;
        if (event.isFinal) {
          finalText = `${finalText} ${piece}`.trim();
          handlers.onTranscript({ finalText, interimText: '' });
          handlers.onUtteranceFinal?.(finalText);
        } else {
          // Live partial: keep accumulated finals + current interim.
          handlers.onTranscript({ finalText, interimText: piece });
        }
      },
    ),
    Speech.addListener(
      'error',
      (event: ExpoSpeechRecognitionErrorEvent) => {
        if (stopped) return;
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'not-allowed') {
          handlers.onError?.(copy.micPermission);
          return;
        }
        if (event.error === 'language-not-supported') {
          langIndex += 1;
          const nextLang = langOptions[langIndex];
          if (!nextLang) {
            handlers.onError?.(friendlySpeechError(event.error, event.message));
            return;
          }
          currentLang = nextLang;
          void delay(300).then(() => {
            if (!stopped) startEngine();
          });
          return;
        }
        if (
          preferOnDevice &&
          (event.error === 'service-not-allowed' || event.error === 'language-not-supported')
        ) {
          preferOnDevice = false;
          void delay(300).then(() => {
            if (!stopped) startEngine();
          });
          return;
        }
        if (!preferOnDevice && event.error === 'network') {
          if (Speech.supportsOnDeviceRecognition()) {
            preferOnDevice = true;
            void delay(300).then(() => {
              if (!stopped) startEngine();
            });
            return;
          }
        }
        if (isTransientSpeechError(event.error, event.message) && retries < maxRetries) {
          retries += 1;
          void delay(400 + retries * 300).then(() => {
            if (stopped) return;
            try {
              Speech.abort();
            } catch {
              // ignore
            }
            void delay(250).then(() => {
              if (!stopped) startEngine();
            });
          });
          return;
        }
        handlers.onError?.(friendlySpeechError(event.error, event.message));
      },
    ),
    Speech.addListener('end', () => {
      if (stopped) return;
      // Keep the session alive so live transcription continues.
      void delay(350).then(() => {
        if (!stopped) startEngine();
      });
    }),
    Speech.addListener('volumechange', (event) => {
      handlers.onLevel?.(Math.min(1, Math.max(0, ((event.value ?? -2) + 2) / 12)));
    }),
  ];

  startEngine();

  return {
    stop: () => {
      stopped = true;
      subs.forEach((item) => item.remove());
      try {
        Speech.stop();
      } catch {
        try {
          Speech.abort();
        } catch {
          // ignore
        }
      }
      releaseIosAudioSession();
    },
  };
}

export async function startVoiceDictation(
  handlers: VoiceDictationHandlers,
): Promise<VoiceDictationSession> {
  const lang = speechLanguageForLocale(useLanguageStore.getState().locale);
  if (Platform.OS === 'web') return startWebDictation(handlers, lang);
  return startNativeDictation(handlers, lang);
}
