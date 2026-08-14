import { StyleSheet, Text, View } from 'react-native';

import { AppLinearGradient } from '@/components/app-linear-gradient';
import { AppIcon } from '@/components/ui';

type Props = {
  title?: string;
  categoryIcon: string;
  collectedMinor: number;
  targetMinor: number;
  percent: number;
  ratio: number;
};

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
}: Props) {
  const remaining = Math.max(0, targetMinor - collectedMinor);

  return (
    <AppLinearGradient
      colors={['#0B4FD6', '#1B7BFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.inner}>
        <Text pointerEvents="none" style={styles.watermark}>
          W
        </Text>

        <View style={styles.top}>
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markW}>W</Text>
            </View>
            <Text style={styles.brandName}>TecnoWallet</Text>
          </View>
          <View style={styles.percentPill}>
            <View style={styles.percentDot} />
            <Text style={styles.percentText}>{percent}%</Text>
          </View>
        </View>

        <View style={styles.kindRow}>
          <View style={styles.catIcon}>
            <AppIcon name={categoryIcon} color="#FFFFFF" size={13} />
          </View>
          <Text style={styles.kind} numberOfLines={1}>
            {title ? title : 'Recaudo'}
            <Text style={styles.kindMuted}> · USDc</Text>
          </Text>
        </View>

        <Text style={styles.amount}>{usd(collectedMinor)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          de {usd(targetMinor)} · faltan {usd(remaining)}
        </Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%` }]} />
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
    color: 'rgba(255,255,255,0.10)',
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
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markW: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  brandName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  percentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  percentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  percentText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
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
    backgroundColor: 'rgba(8, 28, 88, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kind: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  kindMuted: { color: 'rgba(255,255,255,0.72)', fontWeight: '600' },
  amount: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 6,
    zIndex: 2,
  },
  meta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    zIndex: 2,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(8, 32, 96, 0.28)',
    overflow: 'hidden',
    marginTop: 10,
    zIndex: 2,
  },
  fill: { height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
});
