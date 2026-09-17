import * as WebBrowser from 'expo-web-browser';
import { createElement, useMemo } from 'react';
import {
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ComponentType,
} from 'react-native';

import { AppIcon, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';

type TutorialVideoPlayerProps = {
  url: string;
  title: string;
  missingLabel: string;
};

type WebViewProps = {
  originWhitelist: string[];
  source: { html: string };
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  javaScriptEnabled?: boolean;
  scrollEnabled?: boolean;
  style?: object;
};

function nativeWebViewAvailable() {
  if (Platform.OS === 'web') return false;
  return Boolean(NativeModules.RNCWebViewModule);
}

function loadNativeWebView(): ComponentType<WebViewProps> | null {
  if (!nativeWebViewAvailable()) return null;
  try {
    return require('react-native-webview').WebView as ComponentType<WebViewProps>;
  } catch {
    return null;
  }
}

function NativeVideoFallback({ url, title }: { url: string; title: string }) {
  const theme = useAppTheme();
  const copy = useAppCopy();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.tutorial.videoOpen}
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      style={[styles.fallback, { backgroundColor: theme.surfaceSecondary }]}>
      <View style={[styles.playBadge, { backgroundColor: theme.primary }]}>
        <AppIcon name="play.rectangle.fill" color="#FFFFFF" size={22} />
      </View>
      <Text style={[styles.fallbackTitle, { color: theme.text }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.fallbackAction, { color: theme.primary }]}>
        {copy.tutorial.videoOpen}
      </Text>
    </Pressable>
  );
}

export function TutorialVideoPlayer({ url, title, missingLabel }: TutorialVideoPlayerProps) {
  const theme = useAppTheme();
  const html = useMemo(
    () =>
      url
        ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{margin:0;background:#000}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head><body><video src="${url.replace(/"/g, '&quot;')}" controls playsinline webkit-playsinline preload="metadata"></video></body></html>`
        : '',
    [url],
  );
  const WebView = useMemo(() => loadNativeWebView(), []);

  if (!url) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.surfaceSecondary }]}>
        <Text style={[styles.missingText, { color: theme.muted }]}>{missingLabel}</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.playerWrap}>
        {createElement('video', {
          key: url,
          title,
          src: url,
          controls: true,
          playsInline: true,
          preload: 'metadata',
          style: { width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
        })}
      </View>
    );
  }

  if (!WebView) {
    return <NativeVideoFallback url={url} title={title} />;
  }

  return (
    <View style={styles.playerWrap}>
      <WebView
        key={url}
        originWhitelist={['*']}
        source={{ html }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  missing: {
    borderRadius: 14,
    padding: 16,
  },
  missingText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  fallback: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  fallbackAction: {
    fontSize: 13,
    fontWeight: '700',
  },
});
