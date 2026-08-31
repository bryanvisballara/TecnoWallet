import { Alert, Linking, Platform } from 'react-native';

import type { CalendarAttachment } from '@/data/calendar';
import { presentLocalFile } from '@/lib/share-local-file';

export function isImageAttachment(item: CalendarAttachment) {
  if (item.kind === 'image' || item.mimeType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)$/i.test(item.name);
}

export function isPdfAttachment(item: CalendarAttachment) {
  return item.mimeType === 'application/pdf' || /\.pdf$/i.test(item.name);
}

export function attachmentKind(name: string, mimeType?: string): CalendarAttachment['kind'] {
  if (mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)$/i.test(name)) {
    return 'image';
  }
  return 'file';
}

function isCancel(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|dismiss|abort/i.test(message);
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message || /cannot find module|unable to resolve/i.test(message)) {
    return fallback;
  }
  return message;
}

function triggerWebDownload(href: string, filename: string) {
  if (typeof document === 'undefined') return false;
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.target = '_blank';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
  }, 500);
  return true;
}

async function blobFromUri(uri: string, mimeType?: string): Promise<Blob | null> {
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (mimeType && (!blob.type || blob.type === 'application/octet-stream')) {
      return new Blob([blob], { type: mimeType });
    }
    return blob;
  } catch {
    return null;
  }
}

async function shareOrDownloadOnWeb(
  item: CalendarAttachment,
  preferShare: boolean,
) {
  const blob = await blobFromUri(item.uri, item.mimeType);
  if (preferShare && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (blob && typeof File !== 'undefined') {
        const file = new File([blob], item.name, {
          type: blob.type || item.mimeType || 'application/octet-stream',
        });
        const payload = { title: item.name, files: [file] };
        if (!navigator.canShare || navigator.canShare(payload)) {
          await navigator.share(payload);
          return;
        }
      }
      if (/^https?:/i.test(item.uri)) {
        await navigator.share({ title: item.name, url: item.uri });
        return;
      }
    } catch (error) {
      if (isCancel(error)) return;
    }
  }
  if (blob) {
    const url = URL.createObjectURL(blob);
    triggerWebDownload(url, item.name);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return;
  }
  if (!triggerWebDownload(item.uri, item.name)) {
    throw new Error('No hay un visor para guardar este archivo.');
  }
}

async function shareNative(item: CalendarAttachment) {
  await presentLocalFile({
    uri: item.uri,
    filename: fileNameForShare(item),
    mime: mimeForShare(item),
  });
}

function fileNameForShare(item: CalendarAttachment) {
  const name = item.name.trim() || 'archivo';
  if (/\.[a-z0-9]+$/i.test(name)) return name;
  if (isImageAttachment(item)) {
    if (item.mimeType?.includes('png') || /\.png$/i.test(item.uri)) return `${name}.png`;
    return `${name}.jpg`;
  }
  if (isPdfAttachment(item)) return `${name}.pdf`;
  return name;
}

function mimeForShare(item: CalendarAttachment) {
  if (item.mimeType?.trim()) return item.mimeType;
  if (isPdfAttachment(item)) return 'application/pdf';
  if (item.mimeType?.includes('png') || /\.png$/i.test(item.name) || /\.png$/i.test(item.uri)) {
    return 'image/png';
  }
  if (isImageAttachment(item)) return 'image/jpeg';
  return 'application/octet-stream';
}

export async function openAttachment(item: CalendarAttachment) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        throw new Error('No hay un visor para este archivo.');
      }
      const blob = await blobFromUri(item.uri, item.mimeType);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      window.open(item.uri, '_blank', 'noopener');
      return;
    }
    if (/^https?:/i.test(item.uri)) {
      await Linking.openURL(item.uri);
      return;
    }
    await shareNative(item);
  } catch (error) {
    if (isCancel(error)) return;
    Alert.alert('No se pudo abrir', friendlyError(error, 'No se pudo abrir el archivo.'));
  }
}

export async function shareAttachment(item: CalendarAttachment) {
  try {
    if (Platform.OS === 'web') {
      await shareOrDownloadOnWeb(item, true);
      return;
    }
    await shareNative(item);
  } catch (error) {
    if (isCancel(error)) return;
    Alert.alert('No se pudo compartir', friendlyError(error, 'No se pudo compartir el archivo.'));
  }
}

export async function persistCalendarAttachments(items: CalendarAttachment[]) {
  if (Platform.OS === 'web' || !items.length) return items;
  const FileSystem = await import('expo-file-system/legacy');
  const root = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!root) return items;
  const dir = `${root}calendar-attachments/`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // Directory may already exist.
  }
  const next: CalendarAttachment[] = [];
  for (const item of items) {
    next.push(await persistOne(item, dir, FileSystem));
  }
  return next;
}

async function persistOne(
  item: CalendarAttachment,
  dir: string,
  FileSystem: typeof import('expo-file-system/legacy'),
): Promise<CalendarAttachment> {
  const uri = item.uri?.trim();
  if (!uri || /^(https?:|data:|blob:)/i.test(uri)) return item;
  if (uri.includes('/calendar-attachments/')) return item;
  const ext =
    item.name.match(/\.[a-z0-9]+$/i)?.[0] ||
    (item.kind === 'image' || item.mimeType?.includes('png') ? '.jpg' : '') ||
    (item.kind === 'image' ? '.jpg' : '');
  const dest = `${dir}${item.id}${ext}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return { ...item, uri: dest };
  } catch {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      await FileSystem.writeAsStringAsync(dest, base64, { encoding: 'base64' });
      return { ...item, uri: dest };
    } catch {
      return item;
    }
  }
}

export async function downloadAttachment(item: CalendarAttachment) {
  try {
    if (Platform.OS === 'web') {
      await shareOrDownloadOnWeb(item, false);
      return;
    }
    await shareNative(item);
  } catch (error) {
    if (isCancel(error)) return;
    Alert.alert('No se pudo descargar', friendlyError(error, 'No se pudo descargar el archivo.'));
  }
}
