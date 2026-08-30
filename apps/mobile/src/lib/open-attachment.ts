import { Alert, Platform, Share } from 'react-native';

import type { CalendarAttachment } from '@/data/calendar';

function downloadOnWeb(uri: string, filename: string) {
  if (typeof document === 'undefined') return false;
  const anchor = document.createElement('a');
  anchor.href = uri;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.target = '_blank';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    document.body.removeChild(anchor);
  }, 500);
  return true;
}

export async function shareAttachment(item: CalendarAttachment) {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: item.name, url: item.uri });
        return;
      }
      downloadOnWeb(item.uri, item.name);
      return;
    }
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(item.uri, {
        mimeType: item.mimeType,
        dialogTitle: item.name,
      });
      return;
    }
    await Share.share({ url: item.uri, title: item.name });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo compartir el archivo.';
    if (/cancel|dismiss/i.test(message)) return;
    Alert.alert('No se pudo compartir', message);
  }
}

export async function downloadAttachment(item: CalendarAttachment) {
  try {
    if (Platform.OS === 'web') {
      if (item.uri.startsWith('blob:') || item.uri.startsWith('http') || item.uri.startsWith('data:')) {
        const response = await fetch(item.uri);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        downloadOnWeb(url, item.name);
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        return;
      }
      downloadOnWeb(item.uri, item.name);
      return;
    }
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(item.uri, {
        mimeType: item.mimeType,
        dialogTitle: `Guardar ${item.name}`,
      });
      return;
    }
    await Share.share({ url: item.uri, title: item.name });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo descargar el archivo.';
    if (/cancel|dismiss/i.test(message)) return;
    Alert.alert('No se pudo descargar', message);
  }
}
