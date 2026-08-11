import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppLinearGradient } from '@/components/app-linear-gradient';
import { AppIcon } from '@/components/ui';
import { getActiveMoneyCurrency, moneyAmount } from '@/data/demo';

type Stat = {
  label: string;
  amount: number;
  tone?: 'default' | 'positive' | 'negative';
  /** Operator shown before this cell in the breakdown (not for the first). */
  prefix?: '+' | '−';
};

type Props = {
  label: string;
  amount: number;
  formula: string;
  stats: [Stat, Stat, Stat];
  hidden?: boolean;
  onToggleHidden?: () => void;
  toggleA11yLabel?: string;
  style?: ViewStyle;
};

function WealthWatermark() {
  return (
    <View pointerEvents="none" style={styles.watermark}>
      <Svg width={148} height={118} viewBox="0 0 148 118">
        <Circle cx="98" cy="42" r="36" fill="rgba(255,255,255,0.08)" />
        <Circle cx="98" cy="42" r="22" fill="rgba(255,255,255,0.06)" />
        <Path
          d="M28 86 C48 54, 72 96, 96 62 C110 44, 124 52, 138 38"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M28 96 C52 70, 70 102, 96 78 C112 64, 126 70, 138 58"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function formatStat(amount: number, hidden: boolean) {
  if (hidden) return '••••';
  return moneyAmount(amount, true);
}

export function HeroNetWorthBanner({
  label,
  amount,
  formula,
  stats,
  hidden = false,
  onToggleHidden,
  toggleA11yLabel,
  style,
}: Props) {
  const currency = getActiveMoneyCurrency();
  const amountText = hidden ? '••••••' : moneyAmount(amount);

  return (
    <View style={style}>
      <AppLinearGradient
        colors={['#3B8BFF', '#1E6FE8', '#0A3A9C']}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <WealthWatermark />

        <View style={styles.topRow}>
          <Text style={styles.label}>{label}</Text>
          {onToggleHidden ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toggleA11yLabel ?? 'Mostrar u ocultar saldos'}
              hitSlop={8}
              onPress={onToggleHidden}
              style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.75 }]}>
              <AppIcon
                name={hidden ? 'eye.slash.fill' : 'eye.fill'}
                color="#FFFFFF"
                size={17}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.heroBlock}>
          <View style={styles.amountRow}>
            <Text
              style={styles.amount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}>
              {amountText}
            </Text>
            <Text style={styles.currency}>{currency}</Text>
          </View>
          <Text style={styles.formula}>{formula}</Text>
        </View>

        <View style={styles.breakdown}>
          {stats.map((stat, index) => (
            <View key={stat.label} style={styles.statCell}>
              {index > 0 ? (
                <Text style={styles.statOp}>{stat.prefix ?? '·'}</Text>
              ) : null}
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text
                  style={[
                    styles.statValue,
                    stat.tone === 'negative' && styles.statNegative,
                    stat.tone === 'positive' && styles.statPositive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}>
                  {formatStat(stat.amount, hidden)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </AppLinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: 'hidden',
    shadowColor: '#0A3A9C',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },
  watermark: {
    position: 'absolute',
    right: -6,
    top: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroBlock: {
    marginTop: 20,
    marginBottom: 22,
    gap: 8,
    zIndex: 1,
    paddingRight: 28,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.7,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  currency: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  formula: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  breakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  statCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  statOp: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
    width: 14,
    textAlign: 'center',
    marginRight: 2,
  },
  statCopy: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
    minWidth: 0,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
    width: '100%',
    textAlign: 'center',
  },
  statPositive: {
    color: '#D8FFE8',
  },
  statNegative: {
    color: '#FFD4D0',
  },
});
