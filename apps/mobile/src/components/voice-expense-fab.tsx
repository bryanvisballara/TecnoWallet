import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { usePathname } from 'expo-router';

import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { toDateKey } from '@/data/calendar';
import { useSafeLayout } from '@/hooks/use-safe-layout';
import { isLiquidAccount } from '@/lib/accounts';
import {
  parseVoiceTransaction,
  type MissingVoiceEnvelope,
  type ParsedVoiceTransaction,
} from '@/lib/parse-voice-transaction';
import {
  friendlySpeechError,
  isVoiceDictationSupported,
  startVoiceDictation,
  voiceDictationUnavailableMessage,
  warmupVoiceDictation,
  type VoiceDictationSession,
} from '@/lib/voice-dictation';
import { speakVoice, spokenMoney, stopVoiceSpeech } from '@/lib/voice-speak';
import { useVoiceCopy } from '@/i18n/voice-copy';
import { useAuthStore } from '@/store/auth';
import { useFinanceStore } from '@/store/finance';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { subscribeVoiceDictation, consumeVoiceDictationRequest } from '@/lib/voice-intent';
import { useCalendarFabStore } from '@/store/calendar-fab';

const BAR_COUNT = 14;
const OTHER_FAB_ROUTES = /movimientos|recaudos|calendario|calendars/;

async function announce(message: string) {
  // Release mic audio session first so TTS can play.
  await speakVoice(message);
}

function Waveform({ level }: { level: number }) {
  const theme = useAppTheme();
  const speaking = level >= 0.16;
  const heights = useMemo(() => {
    if (!speaking) return Array.from({ length: BAR_COUNT }, () => 0);
    return Array.from({ length: BAR_COUNT }, (_, index) => {
      const wave = 0.22 + Math.sin(index * 0.85) * 0.18;
      return Math.max(0.08, Math.min(1, wave + level * (0.5 + (index % 4) * 0.07)));
    });
  }, [level, speaking]);

  return (
    <View style={styles.wave}>
      {heights.map((value, index) => (
        <View
          key={index}
          style={[
            styles.waveBar,
            {
              height: speaking ? 10 + value * 36 : 3,
              backgroundColor: theme.primary,
              opacity: speaking ? 0.5 + value * 0.5 : 0.28,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function VoiceExpenseFab() {
  const theme = useAppTheme();
  const pathname = usePathname();
  const { fabBottom } = useSafeLayout();
  const { ledger, accounts, envelopes } = useActiveLedger();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const addEnvelope = useLedgerStore((state) => state.addEnvelope);
  const profile = useAuthStore((state) => state.profile);
  const voice = useVoiceCopy();
  const sessionRef = useRef<VoiceDictationSession | null>(null);
  const beginListeningRef = useRef<() => Promise<void>>(async () => undefined);
  const submitSpokenRef = useRef<(spoken: string) => Promise<void>>(async () => undefined);
  const startingRef = useRef(false);
  const autoSubmitLock = useRef(false);
  const latestSpokenRef = useRef('');
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [level, setLevel] = useState(0);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [statusLine, setStatusLine] = useState(voice.listening);
  const sheet = useSharedValue(0);

  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const displayText = [finalText, interimText].filter(Boolean).join(' ').trim();
  latestSpokenRef.current = displayText;
  const stacked = OTHER_FAB_ROUTES.test(pathname);
  const calendarMenuOpen = useCalendarFabStore((state) => state.open);
  const besideCalendarClose = /calendario|calendars/.test(pathname) && calendarMenuOpen;
  const bottom = fabBottom + (besideCalendarClose ? 0 : stacked ? 68 : 0);
  const right = besideCalendarClose ? 18 + 58 + 10 : 18;

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheet.value) * 24 }],
    opacity: sheet.value,
  }));

  const stopSession = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setListening(false);
    setLevel(0);
  };

  const close = () => {
    autoSubmitLock.current = false;
    stopSession();
    stopVoiceSpeech();
    setOpen(false);
    setFinalText('');
    setInterimText('');
    setSaving(false);
    setStatusLine(voice.listening);
    sheet.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
  };

  useEffect(() => {
    warmupVoiceDictation();
    return () => {
      stopSession();
      stopVoiceSpeech();
    };
  }, []);

  const beginListening = async () => {
    if (startingRef.current) return;
    if (!isVoiceDictationSupported()) {
      const msg = voiceDictationUnavailableMessage();
      Alert.alert('Dictado no disponible', msg);
      return;
    }
    startingRef.current = true;
    autoSubmitLock.current = false;
    stopVoiceSpeech();
    if (sessionRef.current) {
      stopSession();
    }
    setOpen(true);
    setFinalText('');
    setInterimText('');
    setListening(true);
    setLevel(0);
    setStatusLine(voice.speakNow);
    sheet.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    try {
      sessionRef.current = await startVoiceDictation({
        onTranscript: ({ finalText: nextFinal, interimText: nextInterim }) => {
          setFinalText(nextFinal);
          setInterimText(nextInterim);
          if (nextFinal || nextInterim) {
            setStatusLine('Escuchando…');
          }
        },
        onLevel: setLevel,
        onStarted: () => setStatusLine(voice.speakNow),
        onUtteranceFinal: (fullText) => {
          if (autoSubmitLock.current || saving) return;
          const spoken = fullText.trim();
          if (!spoken) return;
          // Auto-act when the phrase already looks like a movimiento.
          const probe = parseVoiceTransaction(spoken, envelopes);
          const ready =
            !('error' in probe) || 'missingEnvelope' in probe;
          if (!ready) return;
          autoSubmitLock.current = true;
          void submitSpokenRef.current(spoken);
        },
        onError: (message) => {
          stopSession();
          const friendly = friendlySpeechError(undefined, message);
          setStatusLine(friendly);
          void announce(friendly);
          Alert.alert(voice.listenFailed, friendly);
        },
      });
    } catch (error) {
      stopSession();
      setOpen(false);
      const friendly = friendlySpeechError(
        undefined,
        error instanceof Error ? error.message : undefined,
      );
      void announce(friendly);
      Alert.alert(voice.listenFailed, friendly);
    } finally {
      startingRef.current = false;
    }
  };

  beginListeningRef.current = beginListening;

  const submitSpokenText = async (spoken: string) => {
    if (saving) return;
    stopSession();
    if (!spoken.trim()) {
      const msg = voice.noSpeech;
      setStatusLine(msg);
      await announce(msg);
      autoSubmitLock.current = false;
      void beginListening();
      return;
    }
    const parsed = parseVoiceTransaction(spoken, envelopes);
    if ('error' in parsed) {
      setStatusLine(parsed.error);
      await announce(parsed.error);
      Alert.alert(voice.parseTitle, parsed.error);
      autoSubmitLock.current = false;
      // Keep sheet open and listen again so the user can correct.
      void beginListening();
      return;
    }
    if ('missingEnvelope' in parsed) {
      const msg = voice.missingEnvelope(parsed.missingEnvelope);
      setStatusLine(msg);
      await announce(msg);
      Alert.alert(
        voice.envelopeMissingTitle,
        voice.missingEnvelopeBody(parsed.missingEnvelope),
        [
          {
            text: voice.cancel,
            style: 'cancel',
            onPress: () => {
              autoSubmitLock.current = false;
              void beginListening();
            },
          },
          {
            text: voice.createAndSave,
            onPress: () => void createEnvelopeAndSave(parsed),
          },
        ],
      );
      return;
    }
    await persistMovement(parsed);
  };

  submitSpokenRef.current = submitSpokenText;

  const applySpokenCommand = async (spoken: string) => {
    stopSession();
    setOpen(true);
    setFinalText(spoken);
    setInterimText('');
    setListening(false);
    sheet.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    await submitSpokenText(spoken);
  };

  useEffect(() => {
    return subscribeVoiceDictation(() => {
      const request = consumeVoiceDictationRequest();
      if (!request) return;
      if (request.text) {
        void applySpokenCommand(request.text);
        return;
      }
      void beginListeningRef.current();
    });
  }, []);

  const persistMovement = async (parsed: ParsedVoiceTransaction) => {
    const account = liquidAccounts[0];
    if (!account) {
      const msg = voice.needAccount(ledger?.name ?? '');
      await announce(msg);
      Alert.alert(voice.needAccountTitle, msg);
      autoSubmitLock.current = false;
      return;
    }
    setSaving(true);
    setStatusLine(voice.saving);
    try {
      await addTransaction({
        title: parsed.title,
        category: parsed.envelopeName,
        envelopeId: parsed.envelopeId,
        account: account.name,
        amount: parsed.kind === 'income' ? parsed.amount : -parsed.amount,
        date: toDateKey(new Date()),
        createdBy: ledger?.type === 'shared' ? profile?.name || undefined : undefined,
      });
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // web
      }
      const spoken = voice.recorded(parsed.kind, spokenMoney(parsed.amount), parsed.envelopeName);
      setStatusLine(spoken);
      await announce(spoken);
      close();
    } catch (error) {
      const msg =
        error instanceof Error && error.message.trim()
          ? error.message
          : voice.saveFailed;
      setStatusLine(msg);
      await announce(msg);
      Alert.alert(voice.saveFailed, msg);
      autoSubmitLock.current = false;
    } finally {
      setSaving(false);
    }
  };

  const createEnvelopeAndSave = async (parsed: MissingVoiceEnvelope) => {
    setSaving(true);
    try {
      const envelope = await addEnvelope({
        name: parsed.missingEnvelope,
        kind: parsed.kind,
        budget: 0,
      });
      setSaving(false);
      await persistMovement({
        kind: parsed.kind,
        amount: parsed.amount,
        title: parsed.title,
        envelopeName: envelope.name,
        envelopeId: envelope.id,
      });
    } catch (error) {
      setSaving(false);
      autoSubmitLock.current = false;
      const msg =
        error instanceof Error && error.message.trim()
          ? error.message
          : voice.createEnvelopeFailed;
      await announce(msg);
      Alert.alert(voice.createEnvelopeFailed, msg);
    }
  };

  const submit = async () => {
    if (saving) return;
    autoSubmitLock.current = true;
    await submitSpokenText(displayText.trim() || latestSpokenRef.current.trim());
  };

  return (
    <>
      {open ? null : (
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={voice.micA11y}
        onPress={() => void beginListening()}
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            shadowColor: theme.shadow,
            bottom,
            right,
          },
        ]}>
        <AppIcon name="mic.fill" color="#FFFFFF" size={24} />
      </ScalePressable>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable style={styles.scrim} onPress={close} accessibilityLabel={voice.close} />
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              { backgroundColor: theme.surface, borderColor: theme.border, bottom: bottom + 72 },
            ]}>
            <Text style={[styles.kicker, { color: theme.primary }]}>
              {saving ? voice.saving : statusLine}
            </Text>
            <Waveform level={listening ? level : 0} />
            <Text
              style={[
                styles.transcript,
                { color: displayText ? theme.text : theme.muted },
              ]}>
              {displayText || voice.speakHint}
            </Text>
            {listening && displayText ? (
              <Text style={[styles.hint, { color: theme.muted }]}>
                {voice.listeningHint}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={[styles.actionBtn, { backgroundColor: theme.surfaceSecondary }]}>
                <Text style={[styles.actionText, { color: theme.text }]}>{voice.cancel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void submit()}
                disabled={saving}
                style={[styles.actionBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}>
                <Text style={[styles.actionText, { color: '#FFFFFF' }]}>
                  {saving ? voice.saving : voice.done}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    zIndex: 60,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 18, 32, 0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
    shadowColor: '#0B1D3A',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  wave: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  waveBar: {
    width: 5,
    borderRadius: 99,
  },
  transcript: {
    minHeight: 56,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
