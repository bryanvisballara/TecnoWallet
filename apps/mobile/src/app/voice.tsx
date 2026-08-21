import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { requestVoiceDictation } from '@/lib/voice-intent';

export default function VoiceRoute() {
  const params = useLocalSearchParams<{ text?: string | string[] }>();
  const text = Array.isArray(params.text) ? params.text[0] : params.text;

  useEffect(() => {
    // Deep links already trigger dictation from the root URL handler.
    // Only start here for in-app /voice?text=… to avoid a double start (error 209).
    if (text) requestVoiceDictation(text);
  }, [text]);

  return <Redirect href="/(tabs)/inicio" />;
}
