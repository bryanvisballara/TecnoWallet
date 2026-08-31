import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppLinearGradient } from '@/components/app-linear-gradient';
import { AppIcon, ScalePressable, useAppTheme } from '@/components/ui';
import {
  calendarItemIcon,
  formatReminderLabel,
  typeLabels,
} from '@/data/calendar';
import {
  calendarIconLabel,
  calendarWhenLabel,
  shareCalendarItem,
  type CalendarSharePayload,
} from '@/lib/calendar-share';
import { isImageAttachment } from '@/lib/open-attachment';

export function CalendarShareSheet({
  visible,
  payload,
  onClose,
}: {
  visible: boolean;
  payload: CalendarSharePayload | null;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  const [sending, setSending] = useState(false);
  if (!visible || !payload) return null;
  const photo = payload.attachments.find(isImageAttachment);
  const files = payload.attachments.filter((item) => item !== photo);
  const accent = payload.color || theme.primary;

  const send = async () => {
    setSending(true);
    try {
      await shareCalendarItem(payload);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={onClose} style={styles.close}>
              <AppIcon name="xmark" color={theme.text} size={18} />
            </Pressable>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Vista previa</Text>
            <View style={styles.close} />
          </View>
          <ScrollView contentContainerStyle={styles.previewWrap} showsVerticalScrollIndicator={false}>
            <View style={styles.cardShadow}>
              <AppLinearGradient
                colors={[accent, '#0B1D3A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}>
                <Text style={styles.brand}>TECNOWALLET</Text>
                <Text style={styles.brandSub}>{payload.calendarName || 'Calendario'}</Text>
                <View style={styles.heroGold} />
              </AppLinearGradient>
              <View style={[styles.body, { backgroundColor: theme.surface }]}>
                <View style={styles.typeRow}>
                  <View style={[styles.iconBadge, { backgroundColor: `${accent}22` }]}>
                    <AppIcon name={calendarItemIcon(payload)} color={accent} size={22} />
                  </View>
                  <View style={styles.typeCopy}>
                    <Text style={[styles.typeLabel, { color: accent }]}>
                      {typeLabels[payload.type].toUpperCase()}
                    </Text>
                    <Text style={[styles.iconCaption, { color: theme.muted }]}>
                      {calendarIconLabel(payload.icon)}
                    </Text>
                    {payload.completed ? (
                      <View style={styles.donePill}>
                        <AppIcon name="checkmark" color="#FFFFFF" size={12} />
                        <Text style={styles.doneText}>Completado</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.title, { color: theme.text }]}>{payload.title}</Text>
                <View style={[styles.goldBar, { backgroundColor: '#F5C518' }]} />
                <Text style={[styles.when, { color: theme.muted }]}>{calendarWhenLabel(payload)}</Text>
                {payload.location ? (
                  <Text style={[styles.meta, { color: theme.muted }]}>{payload.location}</Text>
                ) : null}
                {payload.reminder ? (
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    {formatReminderLabel(payload.reminder)}
                  </Text>
                ) : null}
                {payload.assigneeName ? (
                  <Text style={[styles.meta, { color: theme.muted }]}>Con {payload.assigneeName}</Text>
                ) : null}
                {payload.meetingLink ? (
                  <Text style={[styles.meta, { color: theme.primary }]} numberOfLines={2}>
                    {payload.meetingLink}
                  </Text>
                ) : null}
                {payload.notes?.trim() ? (
                  <View style={[styles.notes, { backgroundColor: theme.surfaceSecondary }]}>
                    <Text style={[styles.notesText, { color: theme.text }]}>{payload.notes.trim()}</Text>
                  </View>
                ) : null}
                {photo ? (
                  <View>
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    <Text numberOfLines={1} style={[styles.photoName, { color: theme.muted }]}>
                      {photo.name}
                    </Text>
                  </View>
                ) : null}
                {files.length ? (
                  <View style={styles.files}>
                    {files.map((item) => (
                      <View
                        key={item.id}
                        style={[styles.fileRow, { backgroundColor: theme.primarySoft }]}>
                        <AppIcon
                          name={isImageAttachment(item) ? 'photo.fill' : 'doc.fill'}
                          color={theme.primary}
                          size={16}
                        />
                        <Text numberOfLines={1} style={[styles.fileName, { color: theme.text }]}>
                          {item.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.cardFooter}>Compartido desde TecnoWallet</Text>
              </View>
            </View>
          </ScrollView>
          <ScalePressable
            onPress={sending ? undefined : () => void send()}
            style={[styles.send, { backgroundColor: theme.primary, opacity: sending ? 0.7 : 1 }]}>
            <AppIcon name="square.and.arrow.up" color="#FFFFFF" size={18} />
            <Text style={styles.sendText}>{sending ? 'Preparando…' : 'Compartir PDF'}</Text>
          </ScalePressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 14, 28, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  previewWrap: { padding: 16, paddingBottom: 8 },
  cardShadow: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  hero: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 52 },
  brand: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  brandSub: { color: 'rgba(255,255,255,0.78)', marginTop: 6, fontSize: 14, fontWeight: '600' },
  heroGold: {
    marginTop: 16,
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F5C518',
  },
  body: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 8 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCopy: { flex: 1, gap: 6 },
  typeLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  iconCaption: { fontSize: 13, fontWeight: '600' },
  donePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0E9F6E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  doneText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 8 },
  goldBar: { width: 48, height: 4, borderRadius: 2, marginVertical: 8 },
  when: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 14, fontWeight: '500' },
  notes: { marginTop: 8, borderRadius: 16, padding: 14 },
  notesText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  photo: { width: '100%', height: 180, borderRadius: 18, marginTop: 8 },
  photoName: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  files: { gap: 8, marginTop: 8 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600' },
  cardFooter: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#8A94A6',
    textAlign: 'center',
  },
  send: {
    marginHorizontal: 16,
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});