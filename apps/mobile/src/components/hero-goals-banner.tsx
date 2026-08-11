import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppLinearGradient } from '@/components/app-linear-gradient';

type Props = {
  label: string;
  title: string;
  hint: string;
  style?: ViewStyle;
};

function SoftOrbs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.orb, styles.orbLarge]} />
      <View style={[styles.orb, styles.orbMid]} />
      <View style={[styles.orb, styles.orbSmall]} />
    </View>
  );
}

function TargetGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Circle cx="13" cy="15" r="9.5" stroke="#FFFFFF" strokeWidth="2" fill="none" />
      <Circle cx="13" cy="15" r="5.5" stroke="#FFFFFF" strokeWidth="2" fill="none" />
      <Circle cx="13" cy="15" r="2" fill="#FFFFFF" />
      <Path
        d="M17.5 6.5 L24 3.5 L21.2 10.2 Z"
        fill="#FFFFFF"
      />
      <Path
        d="M16.2 9.2 L21.8 5.6"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HeroGoalsBanner({ label, title, hint, style }: Props) {
  return (
    <View style={style}>
      <AppLinearGradient
        colors={['#E8890B', '#F59E0B', '#F7B84A']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.card}>
        <SoftOrbs />

        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <TargetGlyph />
          </View>
          <View style={styles.copy}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.hint} numberOfLines={2}>
              {hint}
            </Text>
          </View>
        </View>
      </AppLinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 20,
    overflow: 'hidden',
    minHeight: 112,
    justifyContent: 'center',
    shadowColor: '#C2410C',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orbLarge: {
    width: 160,
    height: 160,
    right: -48,
    top: -54,
  },
  orbMid: {
    width: 110,
    height: 110,
    right: 28,
    bottom: -58,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orbSmall: {
    width: 70,
    height: 70,
    left: -24,
    bottom: -30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    zIndex: 1,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  label: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
});
