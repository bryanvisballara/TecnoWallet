import { create } from 'zustand';
import { Alert, Platform } from 'react-native';

import {
  apiRequest,
  bumpAuthEpoch,
  ensureAuthSession,
  setSessionExpiredHandler,
} from '@/services/api';
import { clearBranchIdentity } from '@/services/branch';
import { claimPendingCollaborationInvite } from '@/services/collaboration-api';
import {
  localStorage,
  refreshTokenStorage,
  tokenStorage,
} from '@/services/persistence';
import {
  configurePurchases,
  resetPurchases,
} from '@/services/purchases';
import { useLedgerStore } from '@/store/ledger';
import { usePlusStore } from '@/store/plus';

export type UserProfile = {
  name: string;
  email: string;
  avatarUri?: string;
  platformRole?: 'user' | 'admin';
};

type AuthState = {
  hydrated: boolean;
  onboarded: boolean;
  authenticated: boolean;
  demo: boolean;
  profile: UserProfile;
  hydrate: () => Promise<void>;
  finishOnboarding: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ requiresVerification: true; email: string; devCode?: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (
    email: string,
  ) => Promise<{ delivered: boolean; devCode?: string }>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestDeleteAccountCode: () => Promise<{
    email: string;
    delivered: boolean;
    devCode?: string;
  }>;
  deleteAccount: (code: string) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{
    accepted: boolean;
    devResetLink?: string;
  }>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<void>;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    platformRole?: 'user' | 'admin';
  };
};

type RegisterResponse =
  | AuthResponse
  | {
      requiresVerification: true;
      email: string;
      delivered?: boolean;
      devCode?: string;
    };

const defaultProfile: UserProfile = {
  name: 'Alex Rivera',
  email: 'alex@tecnowallet.app',
};

async function readProfile(): Promise<UserProfile> {
  const [name, email, avatarUri, platformRole] = await Promise.all([
    localStorage.get('profile-name', defaultProfile.name),
    localStorage.get('profile-email', defaultProfile.email),
    localStorage.get<string | null>('profile-avatar', null),
    localStorage.get<'user' | 'admin'>('profile-platform-role', 'user'),
  ]);
  return {
    name: name || defaultProfile.name,
    email: email || defaultProfile.email,
    avatarUri: avatarUri ?? undefined,
    platformRole: platformRole === 'admin' ? 'admin' : 'user',
  };
}

async function writeProfile(profile: UserProfile) {
  await Promise.all([
    localStorage.set('profile-name', profile.name),
    localStorage.set('profile-email', profile.email),
    localStorage.set(
      'profile-platform-role',
      profile.platformRole === 'admin' ? 'admin' : 'user',
    ),
    profile.avatarUri
      ? localStorage.set('profile-avatar', profile.avatarUri)
      : localStorage.remove('profile-avatar'),
  ]);
}

async function persistAuthSession(
  auth: AuthResponse,
  options?: { freshAccount?: boolean },
) {
  const profile: UserProfile = {
    name: auth.user.name,
    email: auth.user.email.toLowerCase(),
    platformRole: auth.user.platformRole === 'admin' ? 'admin' : 'user',
  };
  bumpAuthEpoch();
  await Promise.all([
    tokenStorage.set(auth.accessToken),
    refreshTokenStorage.set(auth.refreshToken),
    localStorage.set('demo-session', false),
    localStorage.set('auth-user-id', String(auth.user.id)),
    writeProfile(profile),
  ]);
  await configurePurchases(String(auth.user.id)).catch(() => undefined);
  await claimPendingCollaborationInvite().catch(() => undefined);
  await usePlusStore.getState().hydrate();
  // Product data lives in Mongo. Reload books (and dependents) after auth.
  if (options?.freshAccount) {
    await useLedgerStore.getState().resetToDefaultHogar();
  } else {
    await useLedgerStore.getState().hydrate();
  }
  const { useGoalsStore } = await import('@/store/goals');
  const { useCalendarStore } = await import('@/store/calendar');
  const { useRecaudosStore } = await import('@/store/recaudos');
  await Promise.all([
    useGoalsStore.getState().hydrate(),
    useCalendarStore.getState().hydrate(),
    useRecaudosStore.getState().refresh(),
  ]);
  return profile;
}

async function clearLocalSession() {
  bumpAuthEpoch();
  await clearBranchIdentity().catch(() => undefined);
  await resetPurchases().catch(() => undefined);
  usePlusStore.getState().reset();
  await Promise.all([
    tokenStorage.clear(),
    refreshTokenStorage.clear(),
    localStorage.set('demo-session', false),
    localStorage.remove('auth-user-id'),
    localStorage.remove('profile-platform-role'),
  ]);
}

/** Best-effort read of JWT `sub` (user id) without verifying signature. */
function decodeJwtSub(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    if (typeof globalThis.atob !== 'function') return null;
    const payload = JSON.parse(globalThis.atob(padded)) as { sub?: string };
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  onboarded: false,
  authenticated: false,
  demo: false,
  profile: defaultProfile,
  hydrate: async () => {
    setSessionExpiredHandler(() => {
      void (async () => {
        await clearLocalSession();
        useLedgerStore.setState({
          ledgers: [],
          activeLedgerId: '',
          snapshots: {},
          clearingIds: {},
          pendingIds: [],
          hydrated: true,
        });
        set({ authenticated: false, demo: false });
        const message =
          'Iniciaste sesión en otro dispositivo. Esta sesión se cerró por seguridad.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(message);
        } else {
          Alert.alert('Sesión cerrada', message);
        }
      })();
    });

    const [onboarded, token, refreshToken, demo, storedProfile] = await Promise.all([
      localStorage.get('onboarded', false),
      tokenStorage.get(),
      refreshTokenStorage.get(),
      localStorage.get('demo-session', false),
      readProfile(),
    ]);
    let profile = storedProfile;

    let stillAuthed = demo;
    if (!demo && (token || refreshToken)) {
      if (refreshToken) {
        // Renew on launch; 401/403 clears tokens inside ensureAuthSession.
        await ensureAuthSession();
      }
      const [nextAccess, nextRefresh] = await Promise.all([
        tokenStorage.get(),
        refreshTokenStorage.get(),
      ]);
      stillAuthed = Boolean(nextAccess || nextRefresh);

      // Access token without refresh (or refresh already wiped) — probe once.
      if (stillAuthed && nextAccess && !nextRefresh) {
        try {
          await apiRequest('/workspaces');
        } catch {
          await clearLocalSession();
          stillAuthed = false;
        }
      }

      if (!stillAuthed) {
        await clearLocalSession();
      } else {
        const access = (await tokenStorage.get()) || nextAccess;
        const userId = decodeJwtSub(access);
        if (userId) await localStorage.set('auth-user-id', userId);
        else {
          await clearLocalSession();
          stillAuthed = false;
        }
        if (stillAuthed) {
          try {
            const me = await apiRequest<{
              id: string;
              email: string;
              name: string;
              platformRole?: 'user' | 'admin';
            }>('/auth/me');
            profile.name = me.name;
            profile.email = me.email.toLowerCase();
            profile.platformRole =
              me.platformRole === 'admin' ? 'admin' : 'user';
            await writeProfile(profile);
          } catch {
            // Keep cached profile if /me is unavailable.
          }
        }
      }
    }

    set({
      hydrated: true,
      onboarded,
      authenticated: stillAuthed,
      demo,
      profile,
    });
  },
  finishOnboarding: async () => {
    await localStorage.set('onboarded', true);
    set({ onboarded: true });
  },
  signIn: async (email, password) => {
    if (!email.trim() || password.length < 8) {
      throw new Error('Revisa tu correo y contraseña (mínimo 8 caracteres).');
    }
    await clearLocalSession();
    set({ authenticated: false, demo: false });
    const auth = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });
    const profile = await persistAuthSession(auth);
    set({ authenticated: true, demo: false, profile });
  },
  signUp: async (name, email, password) => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      throw new Error(
        'Revisa tu nombre, correo y contraseña (mínimo 8 caracteres).',
      );
    }
    // Prevent entering the app with a previous session while verifying email.
    await clearLocalSession();
    set({ authenticated: false, demo: false });
    const result = await apiRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      }),
    });
    if ('accessToken' in result && result.accessToken) {
      throw new Error(
        'El servidor aún no exige verificación de correo. Actualiza/redeploy del API.',
      );
    }
    if ('requiresVerification' in result && result.requiresVerification) {
      if (!result.devCode && result.delivered === false) {
        throw new Error(
          'No pudimos enviar el código al correo. Revisa Brevo o intenta reenviar.',
        );
      }
      return {
        requiresVerification: true as const,
        email: result.email,
        devCode: result.devCode,
      };
    }
    throw new Error('Respuesta inesperada del registro.');
  },
  verifyEmail: async (email, code) => {
    const normalized = code.replace(/\D/g, '');
    if (!/^\d{6}$/.test(normalized)) {
      throw new Error('El código debe tener 6 dígitos.');
    }
    const auth = await apiRequest<AuthResponse>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: normalized,
      }),
    });
    const profile = await persistAuthSession(auth, { freshAccount: true });
    set({ authenticated: true, demo: false, profile });
  },
  resendVerification: async (email) => {
    const result = await apiRequest<{
      accepted: boolean;
      delivered?: boolean;
      devCode?: string;
    }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (!result.devCode && result.delivered === false) {
      throw new Error(
        'No pudimos reenviar el código. Revisa la configuración de correo.',
      );
    }
    return {
      delivered: Boolean(result.delivered),
      devCode: result.devCode,
    };
  },
  signInWithGoogle: async (idToken) => {
    if (!idToken?.trim()) {
      throw new Error('No recibimos el token de Google. Inténtalo de nuevo.');
    }
    await clearLocalSession();
    set({ authenticated: false, demo: false });
    const auth = await apiRequest<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    const profile = await persistAuthSession(auth);
    set({ authenticated: true, demo: false, profile });
  },
  signOut: async () => {
    const refreshToken = await refreshTokenStorage.get();
    if (refreshToken && !get().demo) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Local sign-out must still finish when the API is unavailable.
      }
    }
    await clearLocalSession();
    await useLedgerStore.getState().hydrate();
    set({ authenticated: false, demo: false });
  },
  requestDeleteAccountCode: async () => {
    if (get().demo) {
      throw new Error('La cuenta demo no se puede eliminar.');
    }
    const result = await apiRequest<{
      requiresCode: true;
      email: string;
      delivered?: boolean;
      devCode?: string;
    }>('/auth/account/deletion-code', { method: 'POST' });
    if (!result.devCode && result.delivered === false) {
      throw new Error(
        'No pudimos enviar el código al correo. Revisa Brevo o intenta de nuevo.',
      );
    }
    return {
      email: result.email,
      delivered: Boolean(result.delivered),
      devCode: result.devCode,
    };
  },
  deleteAccount: async (code) => {
    if (get().demo) {
      throw new Error('La cuenta demo no se puede eliminar.');
    }
    const normalized = code.replace(/\D/g, '');
    if (!/^\d{6}$/.test(normalized)) {
      throw new Error('El código debe tener 6 dígitos.');
    }
    await apiRequest('/auth/account/delete', {
      method: 'POST',
      body: JSON.stringify({ code: normalized }),
    });
    await clearLocalSession();
    await useLedgerStore.getState().hydrate();
    set({ authenticated: false, demo: false });
  },
  updateProfile: async (patch) => {
    const current = get().profile;
    const nextName = (patch.name ?? current.name).trim() || current.name;
    const nextEmail =
      (patch.email ?? current.email).trim().toLowerCase() || current.email;
    const profile = {
      ...current,
      ...patch,
      name: nextName,
      email: nextEmail,
    };

    // Avatar stays device-local; name/email must live in Mongo.
    if (!get().demo && (patch.name !== undefined || patch.email !== undefined)) {
      const me = await apiRequest<{
        id: string;
        email: string;
        name: string;
        platformRole?: 'user' | 'admin';
      }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          ...(patch.name !== undefined ? { name: nextName } : {}),
          ...(patch.email !== undefined ? { email: nextEmail } : {}),
        }),
      });
      profile.name = me.name;
      profile.email = me.email.toLowerCase();
      profile.platformRole =
        me.platformRole === 'admin' ? 'admin' : profile.platformRole;
    }

    await writeProfile(profile);
    set({ profile });
  },
  changePassword: async (current, next) => {
    if (current.length < 6) throw new Error('La contraseña actual no es válida.');
    if (next.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    if (current === next) throw new Error('La nueva contraseña debe ser distinta.');
    if (get().demo) {
      await localStorage.set('password-updated-at', Date.now());
      return;
    }
    await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: current,
        newPassword: next,
      }),
    });
  },
  requestPasswordReset: async (email) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) {
      throw new Error('Revisa el correo electrónico.');
    }
    return apiRequest<{ accepted: boolean; devResetLink?: string }>(
      '/auth/password/forgot',
      {
        method: 'POST',
        body: JSON.stringify({ email: normalized }),
      },
    );
  },
  resetPasswordWithToken: async (token, newPassword) => {
    if (token.trim().length < 32) {
      throw new Error('El enlace no es válido.');
    }
    if (newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    }
    await apiRequest('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({
        token: token.trim(),
        newPassword,
      }),
    });
  },
}));
