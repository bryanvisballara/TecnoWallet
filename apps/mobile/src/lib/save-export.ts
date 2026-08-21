import { Platform, Share } from 'react-native';

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  const BufferCtor = (globalThis as { Buffer?: { from: (value: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
  if (BufferCtor) return BufferCtor.from(binary, 'binary').toString('base64');
  throw new Error('No hay codificador base64 en este entorno.');
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
  const uri = `${directory}${input.filename}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(input.bytes), {
    encoding: 'base64',
  });

  try {
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: input.mime,
        dialogTitle: input.filename,
        UTI: input.mime === 'application/pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
      });
      return;
    }
  } catch {
    // Sharing module may be missing in this binary.
  }

  await Share.share({ url: uri, title: input.filename });
}
