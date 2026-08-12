import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, useAppTheme } from '@/components/ui';
import {
  authenticateAppUnlock,
  getBiometricCapability,
  hasAppLockPin,
  verifyAppLockPin,
} from '@/services/biometrics';
import { useAuthStore } from '@/store/auth';
import { usePreferencesStore, type AutoLockDelay } from '@/store/preferences';

function delayMs(value: AutoLockDelay) {
  if (value === '1m') return 60_000;
  if (value === '5m') return 300_000;
  return 0;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve('timeout');
      });
  });
}

export function AppLockGate() {
  const theme = useAppTheme();
  const authenticated = useAuthStore((state) => state.authenticated);
  const prefsHydrated = usePreferencesStore((state) => state.hydrated);
  const lockEnabled = usePreferencesStore((state) => state.biometricsLockEnabled);
  const setBiometricsLockEnabled = usePreferencesStore(
    (state) => state.setBiometricsLockEnabled,
  );
  const autoLockDelay = usePreferencesStore((state) => state.autoLockDelay);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const [needsPin, setNeedsPin] = useState(Platform.OS === 'web');
  const [hasPin, setHasPin] = useState(false);
  const backgroundAt = useRef<number | null>(null);
  const unlockAttempted = useRef(false);

  const shouldGuard = authenticated && prefsHydrated && lockEnabled;

  useEffect(() => {
    if (!shouldGuard) {
      setLocked(false);
      unlockAttempted.current = false;
      return;
    }
    setLocked(true);
    void getBiometricCapability().then((cap) => {
      setBiometricLabel(cap.label);
      setNeedsPin(Platform.OS === 'web' || !cap.available);
    });
    void hasAppLockPin().then((stored) => {
      setHasPin(stored);
      if (stored) setNeedsPin(true);
    });
  }, [shouldGuard]);

  useEffect(() => {
    if (!shouldGuard) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        backgroundAt.current = Date.now();
        return;
      }
      if (next === 'active' && backgroundAt.current != null) {
        const elapsed = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (elapsed >= delayMs(autoLockDelay)) {
          setLocked(true);
          setPin('');
          setError(null);
          unlockAttempted.current = false;
        }
      }
    });
    return () => sub.remove();
  }, [shouldGuard, autoLockDelay]);

  const unlockWithBiometrics = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await withTimeout(
        authenticateAppUnlock('Desbloquea TecnoWallet'),
        12_000,
      );
      if (result === 'timeout') {
        setNeedsPin(true);
        setError('La verificación tardó demasiado. Usa tu clave.');
        return;
      }
      if (result.success) {
        setLocked(false);
        setPin('');
        return;
      }
      if (result.reason === 'web' || result.reason === 'unavailable') {
        setNeedsPin(true);
        return;
      }
      setNeedsPin(true);
      setError('No se pudo verificar. Usa tu clave o inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!locked || !shouldGuard || unlockAttempted.current || needsPin) return;
    unlockAttempted.current = true;
    void unlockWithBiometrics();
  }, [locked, shouldGuard, needsPin, unlockWithBiometrics]);

  const unlockWithPin = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!hasPin) {
        setError('No hay clave configurada. Desactiva el bloqueo o configura una clave.');
        return;
      }
      const ok = await verifyAppLockPin(pin);
      if (!ok) {
        setError('Clave incorrecta.');
        setPin('');
        return;
      }
      setLocked(false);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const skipLock = () => {
    void setBiometricsLockEnabled(false);
    setLocked(false);
    setPin('');
    setError(null);
  };

  if (!shouldGuard || !locked) return null;

  return (
    <View style={[styles.overlay, { backgroundColor: theme.background }]} pointerEvents="auto">
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name="lock.fill" color={theme.primary} size={28} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>TecnoWallet bloqueada</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Usa {biometricLabel.toLowerCase()} o tu clave para continuar.
        </Text>

        {!needsPin ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              void unlockWithBiometrics();
            }}
            style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryLabel}>Desbloquear con {biometricLabel}</Text>
            )}
          </Pressable>
        ) : null}

        <TextInput
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
          keyboardType="number-pad"
          secureTextEntry
          editable={!busy || needsPin}
          placeholder="Clave de 4 a 8 dígitos"
          placeholderTextColor={theme.muted}
          style={[
            styles.pinInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
          ]}
          onSubmitEditing={() => {
            if (pin.length >= 4) void unlockWithPin();
          }}
        />

        <Pressable
          accessibilityRole="button"
          disabled={pin.length < 4}
          onPress={() => {
            void unlockWithPin();
          }}
          style={[
            styles.secondaryBtn,
            {
              borderColor: theme.border,
              opacity: pin.length < 4 ? 0.5 : 1,
            },
          ]}>
          <Text style={[styles.secondaryLabel, { color: theme.text }]}>Entrar con clave</Text>
        </Pressable>

        {!hasPin ? (
          <Pressable accessibilityRole="button" onPress={skipLock} style={styles.escape}>
            <Text style={[styles.escapeLabel, { color: theme.primary }]}>
              Continuar sin bloqueo
            </Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 8 },
  primaryBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pinInput: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
  },
  secondaryBtn: {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 14, fontWeight: '600' },
  escape: { paddingVertical: 8 },
  escapeLabel: { fontSize: 14, fontWeight: '700' },
  error: { color: '#E5484D', fontSize: 13, textAlign: 'center' },
});
