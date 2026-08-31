import { Platform, Share } from 'react-native';

export function asFileUri(uri: string) {
  const value = uri.trim();
  if (!value) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (value.startsWith('/')) return `file://${value}`;
  return value;
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim() || 'archivo';
  return trimmed.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
}

function utiForMime(mime: string) {
  if (mime === 'application/pdf') return 'com.adobe.pdf';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'public.jpeg';
  if (mime === 'image/png') return 'public.png';
  if (mime.startsWith('image/')) return 'public.image';
  if (mime === 'application/zip') return 'com.pkware.zip-archive';
  return 'public.data';
}

export async function presentLocalFile(input: {
  uri: string;
  filename: string;
  mime: string;
}) {
  const filename = sanitizeFileName(input.filename);
  const FileSystem = await import('expo-file-system/legacy');
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No hay almacenamiento disponible para el archivo.');
  }

  let url = asFileUri(input.uri);
  const dest = `${directory}${filename}`;
  try {
    if (asFileUri(dest) !== url) {
      await FileSystem.copyAsync({ from: url, to: dest });
      url = asFileUri(dest);
    }
  } catch {
    // Share the original location if copy fails.
  }

  try {
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(url, {
        mimeType: input.mime,
        dialogTitle: filename,
        UTI: utiForMime(input.mime),
      });
      return;
    }
  } catch {
    // expo-sharing is optional in this binary.
  }

  await Share.share(
    Platform.OS === 'ios'
      ? { url, title: filename }
      : { url, title: filename, message: filename },
  );
}
