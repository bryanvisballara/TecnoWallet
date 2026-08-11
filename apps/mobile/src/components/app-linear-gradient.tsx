import { useId, useState, type PropsWithChildren } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

type Props = PropsWithChildren<{
  colors: readonly string[];
  locations?: readonly number[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Cross-platform gradient that does not depend on the native
 * ExpoLinearGradient view manager (unimplemented in some Expo clients).
 * Web uses CSS; native uses react-native-svg.
 */
export function AppLinearGradient({
  colors,
  locations,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
  children,
}: Props) {
  const reactId = useId().replace(/:/g, '');
  const gradientId = `appGrad-${reactId}`;
  const [size, setSize] = useState({ width: 0, height: 0 });

  const stops = colors.map((color, index) => {
    const offset =
      locations?.[index] ?? (colors.length <= 1 ? 0 : index / (colors.length - 1));
    return { color, offset };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  if (Platform.OS === 'web') {
    const angle =
      (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI + 90;
    const gradient = `linear-gradient(${angle}deg, ${stops
      .map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`)
      .join(', ')})`;
    return (
      <View
        // RN web accepts CSS background via these style keys.
        style={[
          { backgroundColor: colors[0] },
          style,
          {
            // @ts-expect-error RN web CSS gradient
            backgroundImage: gradient,
            experimental_backgroundImage: gradient,
          },
        ]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.host, style]} onLayout={onLayout}>
      {size.width > 0 && size.height > 0 ? (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}>
          <Defs>
            <SvgLinearGradient
              id={gradientId}
              x1={`${start.x * 100}%`}
              y1={`${start.y * 100}%`}
              x2={`${end.x * 100}%`}
              y2={`${end.y * 100}%`}>
              {stops.map((stop, index) => (
                <Stop
                  key={`${stop.color}-${index}`}
                  offset={`${stop.offset * 100}%`}
                  stopColor={stop.color}
                  stopOpacity="1"
                />
              ))}
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${gradientId})`} />
        </Svg>
      ) : (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors[0] }]}
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    zIndex: 1,
  },
});
