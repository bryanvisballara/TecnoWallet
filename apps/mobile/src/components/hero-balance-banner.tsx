import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { AppLinearGradient } from '@/components/app-linear-gradient';
import { AppIcon, ScalePressable } from '@/components/ui';
import { getActiveMoneyCurrency, moneyAmount } from '@/data/demo';
import { useLedgerStore } from '@/store/ledger';

type Props = {
  label: string;
  amount: number;
  hidden?: boolean;
  onToggleHidden?: () => void;
  toggleA11yLabel?: string;
  ledgerLabel: string;
  ledgerIcon?: string;
  actionLabel: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  compact?: boolean;
  currency?: string;
};

function CardsWatermark() {
  return (
    <View pointerEvents="none" style={styles.watermark}>
      <Svg width={140} height={110} viewBox="0 0 140 110">
        <Rect
          x="48"
          y="8"
          width="82"
          height="54"
          rx="11"
          fill="rgba(255,255,255,0.11)"
          transform="rotate(13 89 35)"
        />
        <Rect
          x="24"
          y="28"
          width="82"
          height="54"
          rx="11"
          fill="rgba(255,255,255,0.17)"
          transform="rotate(-10 65 55)"
        />
      </Svg>
    </View>
  );
}

function BannerBody({
  amountText,
  currency,
  ledgerLabel,
  ledgerIcon,
  actionLabel,
  compact,
}: {
  amountText: string;
  currency: string;
  ledgerLabel: string;
  ledgerIcon: string;
  actionLabel: string;
  compact?: boolean;
}) {
  return (
    <>
      <View style={[styles.amountBlock, compact && styles.amountBlockCompact]}>
        <View style={styles.amountRow}>
          <Text
            style={[styles.amount, compact && styles.amountCompact]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}>
            {amountText}
          </Text>
          <Text style={[styles.currency, compact && styles.currencyCompact]}>{currency}</Text>
        </View>
        <View style={[styles.vDivider, compact && styles.vDividerCompact]} />
      </View>

      <View style={styles.footer}>
        <View style={[styles.ledgerPill, compact && styles.ledgerPillCompact]}>
          <View style={[styles.ledgerIcon, compact && styles.ledgerIconCompact]}>
            <AppIcon name={ledgerIcon} color="#FFFFFF" size={compact ? 11 : 13} />
          </View>
          <Text style={[styles.ledgerText, compact && styles.ledgerTextCompact]} numberOfLines={1}>
            {ledgerLabel}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Text style={[styles.actionText, compact && styles.actionTextCompact]}>{actionLabel}</Text>
          <AppIcon name="chevron" color="#FFFFFF" size={compact ? 12 : 13} />
        </View>
      </View>
    </>
  );
}

export function HeroBalanceBanner({
  label,
  amount,
  hidden = false,
  onToggleHidden,
  toggleA11yLabel,
  ledgerLabel,
  ledgerIcon = 'house.fill',
  actionLabel,
  onPress,
  accessibilityLabel,
  style,
  compact = false,
  currency: currencyProp,
}: Props) {
  const ledgerCurrency = useLedgerStore((state) => {
    const active = state.ledgers.find((item) => item.id === state.activeLedgerId);
    return (active?.baseCurrency || '').toUpperCase();
  });
  const currency = (currencyProp || ledgerCurrency || getActiveMoneyCurrency() || 'COP').toUpperCase();
  const amountText = hidden ? '••••••' : moneyAmount(amount);
  const body = (
    <BannerBody
      amountText={amountText}
      currency={currency}
      ledgerLabel={ledgerLabel}
      ledgerIcon={ledgerIcon}
      actionLabel={actionLabel}
      compact={compact}
    />
  );

  return (
    <View style={style}>
      <AppLinearGradient
        colors={['#3B8BFF', '#1E6FE8', '#0A3A9C']}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact && styles.cardCompact]}>
        <CardsWatermark />

        <View style={styles.topRow}>
          <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
          {onToggleHidden ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toggleA11yLabel ?? 'Mostrar u ocultar saldos'}
              hitSlop={8}
              onPress={onToggleHidden}
              style={({ pressed }) => [
                styles.eyeBtn,
                compact && styles.eyeBtnCompact,
                pressed && { opacity: 0.75 },
              ]}>
              <AppIcon
                name={hidden ? 'eye.slash.fill' : 'eye.fill'}
                color="#FFFFFF"
                size={compact ? 15 : 17}
              />
            </Pressable>
          ) : null}
        </View>

        {onPress ? (
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            style={styles.bodyPress}>
            {body}
          </ScalePressable>
        ) : (
          <View
            accessible={Boolean(accessibilityLabel)}
            accessibilityLabel={accessibilityLabel}
            style={styles.bodyPress}>
            {body}
          </View>
        )}
      </AppLinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: 'hidden',
    minHeight: 172,
    justifyContent: 'space-between',
    shadowColor: '#0A3A9C',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 7,
  },
  cardCompact: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 128,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  watermark: {
    position: 'absolute',
    right: -8,
    bottom: 8,
    opacity: 1,
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
  labelCompact: { fontSize: 13 },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  eyeBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  bodyPress: {
    zIndex: 1,
  },
  amountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 26,
    gap: 16,
  },
  amountBlockCompact: {
    marginTop: 10,
    marginBottom: 12,
    gap: 12,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.7,
    fontVariant: ['tabular-nums'],
  },
  amountCompact: {
    fontSize: 28,
    letterSpacing: -1,
  },
  currency: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  currencyCompact: { fontSize: 12 },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  vDividerCompact: { height: 28 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ledgerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2F4F7',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 999,
    maxWidth: '52%',
  },
  ledgerPillCompact: {
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    gap: 6,
  },
  ledgerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0878F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerIconCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  ledgerText: {
    color: '#0A2A6B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  ledgerTextCompact: { fontSize: 12 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  actionTextCompact: { fontSize: 12 },
});
