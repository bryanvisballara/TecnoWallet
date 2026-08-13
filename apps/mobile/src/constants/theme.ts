import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1220',
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceSecondary: '#E8EEF6',
    backgroundElement: '#E8EEF6',
    backgroundSelected: '#D9E2EC',
    textSecondary: '#3E4C59',
    border: '#D9E2EC',
    muted: '#3E4C59',
    primary: '#0878F9',
    primarySoft: '#EAF3FF',
    success: '#0E9F6E',
    successSoft: '#E8F8F0',
    danger: '#E02424',
    dangerSoft: '#FDECEC',
    warning: '#C27803',
    purple: '#7F56D9',
    cyan: '#0891B2',
    shadow: '#0B1D3A',
  },
  dark: {
    text: '#F8FAFC',
    background: '#080B12',
    surface: '#131824',
    surfaceSecondary: '#1B2230',
    backgroundElement: '#1B2230',
    backgroundSelected: '#283142',
    textSecondary: '#CBD5E1',
    border: '#283142',
    muted: '#94A3B8',
    primary: '#4DA3FF',
    primarySoft: '#102B4F',
    success: '#32D583',
    successSoft: '#0B3527',
    danger: '#FF6B62',
    dangerSoft: '#3A1616',
    warning: '#FDB022',
    purple: '#B692F6',
    cyan: '#22CCEE',
    shadow: '#000000',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const Radius = { sm: 12, md: 18, lg: 24, pill: 999 } as const;
export const BottomTabInset = 96;
export const MaxContentWidth = 720;
