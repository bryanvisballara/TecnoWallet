import { Platform } from 'react-native';

import { presentLocalFile } from '@/lib/share-local-file';

function bytesToBase64(bytes: Uint8Array) {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += table[(triple >> 18) & 63] + table[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? table[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? table[triple & 63] : '=';
  }
  return out;
}

function downloadOnWeb(bytes: Uint8Array, filename: string, mime: string) {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 1500);
  return true;
}

export async function saveExportFile(input: {
  bytes: Uint8Array;
  filename: string;
  mime: string;
}) {
  if (Platform.OS === 'web' && downloadOnWeb(input.bytes, input.filename, input.mime)) {
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No hay almacenamiento disponible para el archivo.');
  }
  const filename = input.filename.replace(/[/\\]/g, '-');
  const uri = `${directory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(input.bytes), {
    encoding: 'base64',
  });
  await presentLocalFile({
    uri,
    filename,
    mime: input.mime,
  });
}
