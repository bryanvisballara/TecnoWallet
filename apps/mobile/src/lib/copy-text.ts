import { Platform, Share } from 'react-native';

export async function copyText(value: string): Promise<'copied' | 'shared'> {
  const text = value.trim();
  if (!text) throw new Error('Nada para copiar.');
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
  try {
    const Clipboard = await import('expo-clipboard');
    if (Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(text);
      return 'copied';
    }
  } catch {
    // Module may be missing in this binary.
  }
  await Share.share({ message: text });
  return 'shared';
}
