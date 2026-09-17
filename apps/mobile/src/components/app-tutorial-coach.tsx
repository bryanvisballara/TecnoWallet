import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, PrimaryButton, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import { useAppTutorialStore } from '@/store/app-tutorial';

export function AppTutorialCoach({
  visible,
  title,
  body,
  actionLabel,
  onAction,
  onDismiss,
  anchor = 'bottom',
}: {
  visible: boolean;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss?: () => void;
  anchor?: 'bottom' | 'top';
}) {
  const theme = useAppTheme();

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar tutorial"
          style={styles.backdrop}
          onPress={onDismiss}
        />
        <View
          style={[
            styles.cardWrap,
            anchor === 'bottom' ? styles.cardBottom : styles.cardTop,
          ]}>
          {anchor === 'bottom' ? (
            <View style={[styles.arrowDown, { borderTopColor: theme.surface }]} />
          ) : null}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.text,
              },
            ]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.primarySoft }]}>
              <AppIcon name="sparkles" color={theme.primary} size={22} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.body, { color: theme.muted }]}>{body}</Text>
            <PrimaryButton onPress={onAction}>{actionLabel}</PrimaryButton>
            {onDismiss ? (
              <Pressable onPress={onDismiss} hitSlop={8} style={styles.skip}>
                <Text style={[styles.skipText, { color: theme.muted }]}>
                  Omitir
                </Text>
              </Pressable>
            ) : null}
          </View>
          {anchor === 'top' ? (
            <View style={[styles.arrowUp, { borderBottomColor: theme.surface }]} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function AppTutorialMasLayer() {
  const copy = useAppCopy();
  const step = useAppTutorialStore((state) => state.step);
  const visible = useAppTutorialStore((state) => state.visible);
  const dismiss = useAppTutorialStore((state) => state.dismiss);

  return (
    <AppTutorialCoach
      visible={visible && step === 'mas'}
      title={copy.tutorial.masTitle}
      body={copy.tutorial.masBody}
      actionLabel={copy.tutorial.masAction}
      onAction={() => {
        router.push('/(tabs)/mas');
      }}
      onDismiss={() => void dismiss()}
      anchor="bottom"
    />
  );
}

export function AppTutorialVideoLayer() {
  const copy = useAppCopy();
  const step = useAppTutorialStore((state) => state.step);
  const visible = useAppTutorialStore((state) => state.visible);
  const dismiss = useAppTutorialStore((state) => state.dismiss);

  return (
    <AppTutorialCoach
      visible={visible && step === 'video'}
      title={copy.tutorial.videoCoachTitle}
      body={copy.tutorial.videoCoachBody}
      actionLabel={copy.tutorial.videoCoachAction}
      onAction={() => {
        useAppTutorialStore.setState({ visible: false });
        router.push('/(tabs)/video-tutorial');
      }}
      onDismiss={() => void dismiss()}
      anchor="top"
    />
  );
}

export function MasTabTutorialPulse({ visible }: { visible: boolean }) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.pulseInner}>
      <View style={[styles.pulseRing, { borderColor: theme.primary }]} />
      <View style={[styles.pulseLabel, { backgroundColor: theme.primary }]}>
        <Text style={styles.pulseLabelText}>{copy.tutorial.masTabHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 16, 32, 0.58)',
  },
  cardWrap: {
    paddingHorizontal: 20,
  },
  cardBottom: {
    paddingBottom: 112,
  },
  cardTop: {
    paddingTop: 120,
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  skip: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  arrowDown: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },
  arrowUp: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  pulseInner: {
    alignItems: 'center',
    gap: 6,
  },
  pulseRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
  },
  pulseLabel: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pulseLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
