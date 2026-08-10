import { create } from 'zustand';

type AffiliateWelcome = {
  affiliateId: string;
  code: string;
  name: string;
};

type AffiliateState = {
  welcome: AffiliateWelcome | null;
  showWelcome: (affiliate: AffiliateWelcome) => void;
  dismissWelcome: () => void;
};

export const useAffiliateStore = create<AffiliateState>((set) => ({
  welcome: null,
  showWelcome: (welcome) => set({ welcome }),
  dismissWelcome: () => set({ welcome: null }),
}));
