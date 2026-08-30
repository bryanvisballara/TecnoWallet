import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, useAppTheme } from '@/components/ui';
import type { CalendarAttachment } from '@/data/calendar';
import { downloadAttachment, shareAttachment } from '@/lib/open-attachment';

export function AttachmentPreview({
  item,
  onClose,
}: {
  item: CalendarAttachment | null;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  if (!item) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <AppIcon name="xmark" color="#FFFFFF" size={18} />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>
            {item.name}
          </Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.stage} pointerEvents="box-none">
          {item.kind === 'image' ? (
            <Image
              source={{ uri: item.uri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={item.name}
            />
          ) : (
            <View style={[styles.fileCard, { backgroundColor: theme.surface }]}>
              <AppIcon name="doc.fill" color={theme.primary} size={36} />
              <Text style={[styles.fileName, { color: theme.text }]}>{item.name}</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void shareAttachment(item)}
            style={[styles.action, { backgroundColor: theme.primary }]}>
            <AppIcon name="square.and.arrow.up" color="#FFFFFF" size={16} />
            <Text style={styles.actionText}>Compartir</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void downloadAttachment(item)}
            style={[styles.action, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
            <AppIcon name="square.and.arrow.down" color="#FFFFFF" size={16} />
            <Text style={styles.actionText}>Descargar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 14, 28, 0.94)',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fileCard: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingVertical: 32,
    borderRadius: 20,
    maxWidth: 320,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
