import { StyleSheet, Text, View } from 'react-native';

import { AppLinearGradient } from '@/components/app-linear-gradient';
import { AppIcon } from '@/components/ui';

export type RecaudoHeroPhase = 'unpaid' | 'unopened' | 'active';

type Props = {
  title?: string;
  categoryIcon: string;
  collectedMinor: number;
  targetMinor: number;
  percent: number;
  ratio: number;
  phase?: RecaudoHeroPhase;
};

const PHASE = {
  unpaid: {
    colors: ['#C45C5C', '#E08A8A'] as const,
    badge: 'Desactivada',
    ink: '#FFFFFF',
    muted: 'rgba(255,255,255,0.78)',
    markBg: 'rgba(255,255,255,0.22)',
    catBg: 'rgba(80, 20, 20, 0.28)',
    track: 'rgba(80, 16, 16, 0.28)',
    watermark: 'rgba(255,255,255,0.12)',
  },
  unopened: {
    colors: ['#E0B429', '#F2D56B'] as const,
    badge: 'Sin abrir',
    ink: '#3A2A00',
    muted: 'rgba(58,42,0,0.72)',
    markBg: 'rgba(58,42,0,0.14)',
    catBg: 'rgba(58,42,0,0.16)',
    track: 'rgba(58,42,0,0.18)',
    watermark: 'rgba(58,42,0,0.08)',
  },
  active: {
    colors: ['#0F8F62', '#2BB07A'] as const,
    badge: 'Activa',
    ink: '#FFFFFF',
    muted: 'rgba(255,255,255,0.78)',
    markBg: 'rgba(255,255,255,0.22)',
    catBg: 'rgba(8, 48, 32, 0.28)',
    track: 'rgba(8, 48, 32, 0.28)',
    watermark: 'rgba(255,255,255,0.10)',
  },
  classic: {
    colors: ['#0B4FD6', '#1B7BFF'] as const,
    badge: undefined as string | undefined,
    ink: '#FFFFFF',
    muted: 'rgba(255,255,255,0.78)',
    markBg: 'rgba(255,255,255,0.22)',
    catBg: 'rgba(8, 28, 88, 0.28)',
    track: 'rgba(8, 32, 96, 0.28)',
    watermark: 'rgba(255,255,255,0.10)',
  },
};

export function recaudoDigitalWalletReady(account?: {
  status?: string;
  walletId?: string;
  walletAddress?: string;
}) {
  return Boolean(
    account?.status === 'ready' &&
      account.walletId?.trim() &&
      account.walletAddress?.trim(),
  );
}

export function recaudoHeroPhase(input: {
  payoutMethod?: string;
  paid?: boolean;
  hasWallet?: boolean;
}): RecaudoHeroPhase | undefined {
  if (input.payoutMethod !== 'digital') return undefined;
  if (input.hasWallet) return 'active';
  if (input.paid) return 'unopened';
  return 'unpaid';
}

function usd(minor: number) {
  return `US$ ${(Math.max(0, minor) / 100).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function RecaudoHeroCard({
  title,
  categoryIcon,
  collectedMinor,
  targetMinor,
  percent,
  ratio,
  phase,
}: Props) {
  const remaining = Math.max(0, targetMinor - collectedMinor);
  const theme = phase ? PHASE[phase] : PHASE.classic;
  const badge = theme.badge ?? `${percent}%`;

  return (
    <AppLinearGradient
      colors={theme.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.inner}>
        <Text pointerEvents="none" style={[styles.watermark, { color: theme.watermark }]}>
          W
        </Text>

        <View style={styles.top}>
          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: theme.markBg }]}>
              <Text style={[styles.markW, { color: theme.ink }]}>W</Text>
            </View>
            <Text style={[styles.brandName, { color: theme.ink }]}>TecnoWallet</Text>
          </View>
          <View style={[styles.percentPill, { backgroundColor: theme.markBg }]}>
            <View style={[styles.percentDot, { backgroundColor: theme.ink }]} />
            <Text style={[styles.percentText, { color: theme.ink }]}>{badge}</Text>
          </View>
        </View>

        <View style={styles.kindRow}>
          <View style={[styles.catIcon, { backgroundColor: theme.catBg }]}>
            <AppIcon name={categoryIcon} color={theme.ink} size={13} />
          </View>
          <Text style={[styles.kind, { color: theme.ink }]} numberOfLines={1}>
            {title ? title : 'Recaudo'}
            <Text style={{ color: theme.muted, fontWeight: '600' }}> · USDc</Text>
          </Text>
        </View>

        <Text style={[styles.amount, { color: theme.ink }]}>{usd(collectedMinor)}</Text>
        <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={1}>
          de {usd(targetMinor)} · faltan {usd(remaining)}
        </Text>

        <View style={[styles.track, { backgroundColor: theme.track }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: theme.ink },
            ]}
          />
        </View>
      </View>
    </AppLinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  inner: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  watermark: {
    position: 'absolute',
    right: -4,
    bottom: -22,
    fontSize: 92,
    fontWeight: '800',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markW: { fontSize: 12, fontWeight: '800' },
  brandName: { fontSize: 13, fontWeight: '700' },
  percentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  percentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  percentText: { fontSize: 11, fontWeight: '700' },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    zIndex: 2,
  },
  catIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kind: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  amount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 6,
    zIndex: 2,
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    zIndex: 2,
  },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
    zIndex: 2,
  },
  fill: { height: 3, borderRadius: 2 },
});
