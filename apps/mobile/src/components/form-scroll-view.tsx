import { forwardRef, type PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';

type FormScrollViewProps = PropsWithChildren<
  Omit<ScrollViewProps, 'keyboardShouldPersistTaps'> & {
    contentContainerStyle?: ViewStyle | ViewStyle[];
  }
>;

/**
 * ScrollView for amount/text forms: keeps fields visible above the keyboard.
 */
export const FormScrollView = forwardRef<ScrollView, FormScrollViewProps>(
  function FormScrollView({ children, contentContainerStyle, ...rest }, ref) {
    return (
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        {...rest}>
        {children}
      </ScrollView>
    );
  },
);

/** Call from TextInput onFocus so amount fields scroll into view. */
export function focusScrollToEnd(scrollRef: { current: ScrollView | null }, delayMs = 80) {
  return () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delayMs);
  };
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 36,
    flexGrow: 1,
  },
});
