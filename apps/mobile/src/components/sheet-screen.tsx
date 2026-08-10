import { safeGoBack } from '@/lib/navigation';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';

import { useAppTheme } from '@/components/ui';

type Props = PropsWithChildren<{
  /** Alto de la hoja (0–1). Por defecto 75%. */
  heightRatio?: number;
  fallback?: Href;
}>;

export function SheetScreen({ children, heightRatio = 0.75, fallback = '/(tabs)/inicio' }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * heightRatio);

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={() => safeGoBack(fallback)}
          style={[styles.backdrop, { backgroundColor: '#0B1D3A66' }]}
        />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.springify().damping(22).stiffness(220)}
        exiting={SlideOutDown.duration(180)}
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            backgroundColor: theme.surface,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0B1D3A',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 4,
  },
  content: {
    flex: 1,
  },
});
