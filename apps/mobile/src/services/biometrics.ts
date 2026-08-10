import { Platform } from 'react-native';

import { localStorage } from '@/services/persistence';

const PIN_KEY = 'prefs-app-lock-pin';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  label: string;
  supportsHardware: boolean;
};

async function localAuth() {
  if (Platform.OS === 'web') return null;
  return import('expo-local-authentication');
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const Auth = await localAuth();
  if (!Auth) {
    return {
      available: true,
      enrolled: true,
      label: 'Clave de la app',
      supportsHardware: false,
    };
  }

  const hasHardware = await Auth.hasHardwareAsync();
  const enrolled = hasHardware ? await Auth.isEnrolledAsync() : false;
  const types = hasHardware ? await Auth.supportedAuthenticationTypesAsync() : [];
  const hasFace = types.includes(Auth.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(Auth.AuthenticationType.FINGERPRINT);
  const label = hasFace
    ? 'Face ID'
    : hasFingerprint
      ? 'Huella'
      : Platform.OS === 'ios'
        ? 'Face ID / código'
        : 'Biometría / PIN';

  return {
    available: hasHardware && enrolled,
    enrolled,
    label,
    supportsHardware: hasHardware,
  };
}

export async function authenticateAppUnlock(promptMessage = 'Desbloquea TecnoWallet') {
  const Auth = await localAuth();
  if (!Auth) {
    return { success: false, reason: 'web' as const };
  }

  const capability = await getBiometricCapability();
  if (!capability.supportsHardware) {
    return { success: false, reason: 'unavailable' as const };
  }

  const result = await Auth.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
    fallbackLabel: 'Usar clave',
  });

  return {
    success: result.success,
    reason: result.success ? ('ok' as const) : ('failed' as const),
  };
}

export async function hasAppLockPin() {
  const pin = await localStorage.get<string>(PIN_KEY, '');
  return Boolean(pin && pin.length >= 4);
}

export async function setAppLockPin(pin: string) {
  const cleaned = pin.replace(/\D/g, '');
  if (cleaned.length < 4 || cleaned.length > 8) {
    throw new Error('La clave debe tener entre 4 y 8 dígitos.');
  }
  await localStorage.set(PIN_KEY, cleaned);
}

export async function clearAppLockPin() {
  await localStorage.remove(PIN_KEY);
}

export async function verifyAppLockPin(pin: string) {
  const stored = await localStorage.get<string>(PIN_KEY, '');
  return Boolean(stored) && stored === pin.replace(/\D/g, '');
}
