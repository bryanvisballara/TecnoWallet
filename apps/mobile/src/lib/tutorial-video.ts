const DEFAULT_TUTORIAL_VIDEO_URL =
  'https://www.youtube.com/watch?v=PLACEHOLDER';

export function tutorialVideoUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_TUTORIAL_VIDEO_URL?.trim();
  return fromEnv || DEFAULT_TUTORIAL_VIDEO_URL;
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
