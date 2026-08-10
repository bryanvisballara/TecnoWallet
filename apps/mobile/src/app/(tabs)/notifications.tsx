import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { AppIcon, Card, Pill, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import { useAuthStore } from '@/store/auth';
import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';
import {
  buildNotificationFeed,
  notificationToneColors,
  useNotificationsStore,
  visibleNotifications,
  type AppNotification,
} from '@/store/notifications';

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const profile = useAuthStore((state) => state.profile);
  const calendarItems = useCalendarStore((state) => state.items);
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const readIds = useNotificationsStore((state) => state.readIds);
  const dismissedIds = useNotificationsStore((state) => state.dismissedIds);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const markRead = useNotificationsStore((state) => state.markRead);
  const dismiss = useNotificationsStore((state) => state.dismiss);
  const dismissMany = useNotificationsStore((state) => state.dismissMany);
  const [selected, setSelected] = useState<string[]>([]);
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});

  const feed = useMemo(
    () =>
      visibleNotifications(
        buildNotificationFeed({
          calendarItems,
          ledgers,
          snapshots,
          selfName: profile.name,
        }),
        dismissedIds,
      ),
    [calendarItems, ledgers, snapshots, profile.name, dismissedIds],
  );

  const allSelected = feed.length > 0 && selected.length === feed.length;

  useEffect(() => {
    if (feed.length) void markAllRead(feed.map((item) => item.id));
  }, [feed, markAllRead]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => feed.some((item) => item.id === id)));
  }, [feed]);

  const toggleSelectAll = () => {
    setSelected(allSelected ? [] : feed.map((item) => item.id));
  };

  const toggleOne = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const deleteOne = async (id: string) => {
    swipeRefs.current[id]?.close();
    await dismiss(id);
    setSelected((current) => current.filter((item) => item !== id));
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteSelected = () => {
    if (!selected.length) return;
    const run = async () => {
      await dismissMany(selected);
      setSelected([]);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    if (Platform.OS === 'web') {
      void run();
      return;
    }
    Alert.alert(copy.notifications.deleteTitle, copy.notifications.deleteConfirm(selected.length), [
      { text: copy.common.cancel, style: 'cancel' },
      { text: copy.common.delete, style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <Screen
      title={copy.notifications.title}
      subtitle={copy.notifications.subtitle}
      right={
        <View style={uiStyles.row}>
          {selected.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.notifications.deleteSelectedA11y(selected.length)}
              onPress={deleteSelected}
              style={[styles.headerBtn, { backgroundColor: theme.danger }]}>
              <AppIcon name="trash" color="#FFFFFF" size={18} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.common.back}
            onPress={() => safeGoBack('/(tabs)/inicio')}
            style={[styles.headerBtn, { backgroundColor: theme.surfaceSecondary, marginLeft: 8 }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
        </View>
      }>
      {!feed.length ? (
        <Card>
          <View style={styles.empty}>
            <AppIcon name="bell" color={theme.muted} size={28} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{copy.notifications.emptyTitle}</Text>
            <Text style={[styles.emptyBody, { color: theme.muted }]}>{copy.notifications.emptyBody}</Text>
          </View>
        </Card>
      ) : (
        <>
          <View style={[styles.toolbar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
              accessibilityLabel={
                allSelected ? copy.notifications.deselectAllA11y : copy.notifications.selectAllA11y
              }
              onPress={toggleSelectAll}
              style={styles.selectAll}>
              <AppIcon
                name={allSelected ? 'checkmark.circle.fill' : 'circle'}
                color={allSelected ? theme.primary : theme.muted}
                size={24}
              />
              <Text style={[styles.selectAllText, { color: theme.text }]}>
                {allSelected ? copy.notifications.allSelected : copy.notifications.selectAll}
              </Text>
            </Pressable>
            {selected.length > 0 ? (
              <Pressable onPress={deleteSelected} accessibilityRole="button">
                <Text style={[styles.deleteLink, { color: theme.danger }]}>
                  {copy.notifications.deleteCount(selected.length)}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.hint, { color: theme.muted }]}>{copy.notifications.swipeHint}</Text>
            )}
          </View>

          <Card style={styles.list}>
            {feed.map((item, index) => (
              <NotificationRow
                key={item.id}
                item={item}
                index={index}
                selected={selected.includes(item.id)}
                unread={!readIds.includes(item.id)}
                onToggle={() => toggleOne(item.id)}
                onOpen={() => {
                  void markRead(item.id);
                  if (item.kind === 'calendar') router.push('/(tabs)/calendario');
                  else router.push('/(tabs)/movimientos');
                }}
                onDelete={() => void deleteOne(item.id)}
                swipeRef={(ref) => {
                  swipeRefs.current[item.id] = ref;
                }}
              />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function NotificationRow({
  item,
  index,
  selected,
  unread,
  onToggle,
  onOpen,
  onDelete,
  swipeRef,
}: {
  item: AppNotification;
  index: number;
  selected: boolean;
  unread: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDelete: () => void;
  swipeRef: (ref: Swipeable | null) => void;
}) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const colors = notificationToneColors(item.tone, theme);
  const kindLabel =
    item.kind === 'calendar'
      ? copy.notifications.kindCalendar
      : item.kind === 'income'
        ? copy.notifications.kindIncome
        : copy.notifications.kindExpense;

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.notifications.deleteItemA11y(item.title)}
          onPress={onDelete}
          style={[styles.swipeDelete, { backgroundColor: theme.danger }]}>
          <AppIcon name="trash" color="#FFFFFF" size={22} />
          <Text style={styles.swipeDeleteText}>{copy.notifications.delete}</Text>
        </Pressable>
      )}>
      <View
        style={[
          styles.row,
          { backgroundColor: theme.surface },
          index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        ]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={copy.notifications.selectItemA11y(item.title)}
          onPress={onToggle}
          hitSlop={8}
          style={styles.checkHit}>
          <AppIcon
            name={selected ? 'checkmark.circle.fill' : 'circle'}
            color={selected ? theme.primary : theme.muted}
            size={22}
          />
        </Pressable>
        <ScalePressable haptic={false} onPress={onOpen} style={styles.rowPress}>
          <View style={[styles.icon, { backgroundColor: colors.bg }]}>
            <AppIcon name={item.icon} color={colors.fg} size={20} />
          </View>
          <View style={styles.copy}>
            <View style={uiStyles.between}>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              {unread ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
            </View>
            <Text style={[styles.body, { color: theme.muted }]}>{item.body}</Text>
            <View style={styles.meta}>
              <Pill tone={item.kind === 'income' ? 'green' : item.kind === 'expense' ? 'orange' : 'blue'}>
                {kindLabel}
              </Pill>
              <Text style={[styles.when, { color: theme.muted }]}>{item.when}</Text>
            </View>
          </View>
        </ScalePressable>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  selectAllText: { fontSize: 14, fontWeight: '700' },
  deleteLink: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12 },
  list: { paddingVertical: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 14, paddingHorizontal: 4, alignItems: 'flex-start' },
  checkHit: { paddingTop: 10, paddingHorizontal: 4 },
  rowPress: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 8 },
  body: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  when: { fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  swipeDelete: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeDeleteText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyBody: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
