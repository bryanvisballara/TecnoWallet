type VoiceIntentRequest = { text?: string };

type VoiceIntentListener = () => void;

const listeners = new Set<VoiceIntentListener>();
let pending: VoiceIntentRequest | null = null;
let lastEmptyRequestAt = 0;

export function requestVoiceDictation(text?: string) {
  const trimmed = text?.trim();
  if (trimmed) {
    pending = { text: trimmed };
  } else {
    const now = Date.now();
    // Consume happens immediately in the FAB, so debounce must not depend on `pending`.
    if (now - lastEmptyRequestAt < 1200) return;
    lastEmptyRequestAt = now;
    if (!pending?.text) pending = {};
  }
  listeners.forEach((listener) => listener());
}

export function consumeVoiceDictationRequest() {
  const request = pending;
  pending = null;
  return request;
}

export function subscribeVoiceDictation(listener: VoiceIntentListener) {
  listeners.add(listener);
  if (pending) listener();
  return () => {
    listeners.delete(listener);
  };
}

export function voiceTextFromUrl(url: string) {
  try {
    const parsed = new URL(url.replace(/^tecnowallet:\/\/\/?/i, 'https://tecnowallet.local/'));
    const value = parsed.searchParams.get('text');
    return value?.trim() || undefined;
  } catch {
    const match = /[?&]text=([^&]*)/i.exec(url);
    if (!match) return undefined;
    try {
      return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim() || undefined;
    } catch {
      return undefined;
    }
  }
}

export function isVoiceCommandUrl(url: string) {
  return (
    /tecnowallet:\/\/([^/?#]*\/)?voice(?:\?|#|$)/i.test(url) ||
    /[?&]voice=1(?:&|$)/i.test(url)
  );
}
