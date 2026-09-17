import type { TutorialLocale, TutorialVideoKey } from '@/lib/tutorial-modules';

const VIDEO_KEYS: TutorialVideoKey[] = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'];

function envKey(locale: TutorialLocale, videoKey: TutorialVideoKey) {
  return `EXPO_PUBLIC_TUTORIAL_${locale.toUpperCase()}_${videoKey.toUpperCase()}` as const;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || '';
}

/** Build a Cloudinary MP4 URL from cloud name + public id, or pass through full https URLs. */
export function resolveTutorialVideoUrl(
  locale: TutorialLocale,
  videoKey: TutorialVideoKey,
): string {
  const direct = readEnv(envKey(locale, videoKey));
  if (direct.startsWith('http://') || direct.startsWith('https://')) {
    return direct;
  }

  const cloudName =
    readEnv('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME') ||
    readEnv('EXPO_PUBLIC_TUTORIAL_CLOUDINARY_CLOUD');
  const publicId = direct;
  if (!cloudName || !publicId) return '';

  const normalized = publicId.replace(/^\//, '').replace(/\.mp4$/i, '');
  return `https://res.cloudinary.com/${cloudName}/video/upload/${normalized}.mp4`;
}

export function tutorialVideosConfigured(locale: TutorialLocale) {
  return VIDEO_KEYS.some((key) => Boolean(resolveTutorialVideoUrl(locale, key)));
}

/** @deprecated Legacy single-video env; kept for backwards compatibility. */
export function tutorialVideoUrl() {
  const legacy = readEnv('EXPO_PUBLIC_TUTORIAL_VIDEO_URL');
  if (legacy) return legacy;
  return resolveTutorialVideoUrl('es', 'v1');
}

export function youtubeEmbedUrl(watchOrEmbedUrl: string) {
  const trimmed = watchOrEmbedUrl.trim();
  if (!trimmed) return '';
  if (trimmed.includes('/embed/')) return trimmed;
  const match = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (!match?.[1]) return trimmed;
  return `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0`;
}
