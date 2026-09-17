import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import { createElement, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, PrimaryButton, Screen, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import { safeGoBack } from '@/lib/navigation';
import { tutorialVideoUrl, youtubeEmbedUrl } from '@/lib/tutorial-video';
import { useAppTutorialStore } from '@/store/app-tutorial';

export default function VideoTutorialScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const videoUrl = tutorialVideoUrl();
  const embedUrl = youtubeEmbedUrl(videoUrl);

  useFocusEffect(
    useCallback(() => {
      useAppTutorialStore.setState({ visible: false });
    }, []),
  );

  const finish = async () => {
    await useAppTutorialStore.getState().complete();
    safeGoBack('/(tabs)/mas');
  };

  const openExternal = async () => {
    await WebBrowser.openBrowserAsync(videoUrl);
    await finish();
  };

  return (
    <Screen title={copy.tutorial.videoTitle} subtitle={copy.tutorial.videoSubtitle}>
      <Card style={styles.card}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name="video.fill" color={theme.primary} size={28} />
        </View>
        <Text style={[styles.body, { color: theme.muted }]}>{copy.tutorial.videoBody}</Text>
        {Platform.OS === 'web' && embedUrl ? (
          <View style={styles.playerWrap}>
            {createElement('iframe', {
              title: copy.tutorial.videoTitle,
              src: embedUrl,
              style: { width: '100%', height: '100%', border: 0 },
              allow:
                'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
              allowFullScreen: true,
            })}
          </View>
        ) : null}
        <PrimaryButton onPress={() => void (Platform.OS === 'web' ? finish() : openExternal())}>
          {Platform.OS === 'web' ? copy.tutorial.videoDone : copy.tutorial.videoOpen}
        </PrimaryButton>
        {Platform.OS !== 'web' ? (
          <Pressable onPress={() => void finish()} hitSlop={8}>
            <Text style={[styles.doneLink, { color: theme.muted }]}>
              {copy.tutorial.videoDone}
            </Text>
          </Pressable>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 20 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { fontSize: 14, lineHeight: 21 },
  playerWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  doneLink: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
});
