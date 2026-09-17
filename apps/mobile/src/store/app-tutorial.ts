import { create } from 'zustand';

import { localStorage } from '@/services/persistence';

export type AppTutorialStep = 'idle' | 'mas' | 'video' | 'done';

type AppTutorialState = {
  step: AppTutorialStep;
  visible: boolean;
  hydrate: () => Promise<void>;
  startAfterTrial: () => Promise<void>;
  openMasStep: () => void;
  openVideoStep: () => void;
  complete: () => Promise<void>;
  dismiss: () => Promise<void>;
};

function doneKey(userId: string) {
  return `app-tutorial-done-${userId}`;
}

export const useAppTutorialStore = create<AppTutorialState>((set, get) => ({
  step: 'idle',
  visible: false,

  hydrate: async () => {
    const userId = await localStorage.get<string>('auth-user-id', '');
    if (!userId) {
      set({ step: 'idle', visible: false });
      return;
    }
    const done = await localStorage.get<boolean>(doneKey(userId), false);
    if (done) set({ step: 'done', visible: false });
  },

  startAfterTrial: async () => {
    const userId = await localStorage.get<string>('auth-user-id', '');
    if (!userId) return;
    const done = await localStorage.get<boolean>(doneKey(userId), false);
    if (done) return;
    set({ step: 'mas', visible: true });
  },

  openMasStep: () => set({ step: 'mas', visible: true }),

  openVideoStep: () => set({ step: 'video', visible: true }),

  complete: async () => {
    const userId = await localStorage.get<string>('auth-user-id', '');
    if (userId) await localStorage.set(doneKey(userId), true);
    set({ step: 'done', visible: false });
  },

  dismiss: async () => {
    await get().complete();
  },
}));
