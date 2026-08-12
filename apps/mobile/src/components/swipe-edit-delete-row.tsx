import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { AppIcon, useAppTheme } from '@/components/ui';

type Props = {
  itemKey: string;
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  disabled?: boolean;
};

/**
 * Right-swipe actions: Editar / Eliminar.
 * Ignores the press that ends the open-swipe gesture (same pattern as envelope txs).
 */
export function SwipeEditDeleteRow({
  itemKey,
  children,
  onEdit,
  onDelete,
  editLabel = 'Editar',
  deleteLabel = 'Eliminar',
  disabled = false,
}: Props) {
  const theme = useAppTheme();
  const swipeRef = useRef<Swipeable | null>(null);
  const ignoreUntil = useRef(0);

  const markGesture = () => {
    ignoreUntil.current = Date.now() + 450;
  };

  const canAccept = () => Date.now() >= ignoreUntil.current;

  const close = () => swipeRef.current?.close();

  if (disabled) return <>{children}</>;

  return (
    <Swipeable
      ref={(ref) => {
        swipeRef.current = ref;
      }}
      overshootRight={false}
      friction={0.35}
      overshootFriction={8}
      rightThreshold={8}
      dragOffsetFromRightEdge={12}
      onSwipeableWillOpen={markGesture}
      onSwipeableOpen={markGesture}
      onSwipeableClose={markGesture}
      renderRightActions={() => (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${editLabel} ${itemKey}`}
            onPress={() => {
              if (!canAccept()) return;
              close();
              onEdit();
            }}
            style={[styles.action, { backgroundColor: theme.primary }]}>
            <AppIcon name="paintbrush.fill" color="#FFFFFF" size={18} />
            <Text style={styles.actionText}>{editLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${deleteLabel} ${itemKey}`}
            onPress={() => {
              if (!canAccept()) return;
              close();
              onDelete();
            }}
            style={[styles.action, { backgroundColor: theme.danger }]}>
            <AppIcon name="trash" color="#FFFFFF" size={18} />
            <Text style={styles.actionText}>{deleteLabel}</Text>
          </Pressable>
        </View>
      )}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', width: 140 },
  action: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
