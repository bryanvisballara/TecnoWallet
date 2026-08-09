import { create } from 'zustand';

import { apiRequest } from '@/services/api';
import {
  localStorage,
  refreshTokenStorage,
  tokenStorage,
} from '@/services/persistence';

export type UserProfile = {
  name: string;
  email: string;
  avatarUri?: string;
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
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  enterDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string };
};

const defaultProfile: UserProfile = {
  name: 'Alex Rivera',
  email: 'alex@tecnowallet.app',
};

async function readProfile(): Promise<UserProfile> {
  const [name, email, avatarUri] = await Promise.all([
    localStorage.get('profile-name', defaultProfile.name),
    localStorage.get('profile-email', defaultProfile.email),
    localStorage.get<string | null>('profile-avatar', null),
  ]);
  return {
    name: name || defaultProfile.name,
    email: email || defaultProfile.email,
    avatarUri: avatarUri ?? undefined,
  };
}

async function writeProfile(profile: UserProfile) {
  await Promise.all([
    localStorage.set('profile-name', profile.name),
    localStorage.set('profile-email', profile.email),
    profile.avatarUri
      ? localStorage.set('profile-avatar', profile.avatarUri)
      : localStorage.remove('profile-avatar'),
  ]);
}

async function persistAuthSession(auth: AuthResponse) {
  const profile: UserProfile = {
    name: auth.user.name,
    email: auth.user.email.toLowerCase(),
  };
  await Promise.all([
    tokenStorage.set(auth.accessToken),
    refreshTokenStorage.set(auth.refreshToken),
    localStorage.set('demo-session', false),
    localStorage.set('auth-user-id', auth.user.id),
    writeProfile(profile),
  ]);
  return profile;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  onboarded: false,
  authenticated: false,
  demo: false,
  profile: defaultProfile,
  hydrate: async () => {
    const [onboarded, token, refreshToken, demo, profile] = await Promise.all([
      localStorage.get('onboarded', false),
      tokenStorage.get(),
      refreshTokenStorage.get(),
      localStorage.get('demo-session', false),
      readProfile(),
    ]);
    set({
      hydrated: true,
      onboarded,
      authenticated: Boolean(token || refreshToken) || demo,
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
    const auth = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      }),
    });
    const profile = await persistAuthSession(auth);
    set({ authenticated: true, demo: false, profile });
  },
  signInWithGoogle: async (idToken) => {
    if (!idToken?.trim()) {
      throw new Error('No recibimos el token de Google. Inténtalo de nuevo.');
    }
    const auth = await apiRequest<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    const profile = await persistAuthSession(auth);
    set({ authenticated: true, demo: false, profile });
  },
  enterDemo: async () => {
    await localStorage.set('demo-session', true);
    const profile = defaultProfile;
    await writeProfile(profile);
    set({ authenticated: true, demo: true, profile });
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
    await Promise.all([
      tokenStorage.clear(),
      refreshTokenStorage.clear(),
      localStorage.set('demo-session', false),
      localStorage.remove('auth-user-id'),
    ]);
    set({ authenticated: false, demo: false });
  },
  updateProfile: async (patch) => {
    const profile = {
      ...get().profile,
      ...patch,
      name: (patch.name ?? get().profile.name).trim() || get().profile.name,
      email: (patch.email ?? get().profile.email).trim().toLowerCase() || get().profile.email,
    };
    await writeProfile(profile);
    set({ profile });
  },
  changePassword: async (current, next) => {
    if (current.length < 6) throw new Error('La contraseña actual no es válida.');
    if (next.length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    if (current === next) throw new Error('La nueva contraseña debe ser distinta.');
    // Demo: no server round-trip; password is never persisted locally.
    await localStorage.set('password-updated-at', Date.now());
  },
}));
