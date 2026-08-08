import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, Pill, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';
import {
  buildNotificationFeed,
  notificationToneColors,
  useNotificationsStore,
} from '@/store/notifications';

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const profile = useAuthStore((state) => state.profile);
  const calendarItems = useCalendarStore((state) => state.items);
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const readIds = useNotificationsStore((state) => state.readIds);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const markRead = useNotificationsStore((state) => state.markRead);

  const feed = useMemo(
    () =>
      buildNotificationFeed({
        calendarItems,
        ledgers,
        snapshots,
        selfName: profile.name,
      }),
    [calendarItems, ledgers, snapshots, profile.name],
  );

  useEffect(() => {
    if (feed.length) void markAllRead(feed.map((item) => item.id));
  }, [feed, markAllRead]);

  return (
    <Screen
      title="Notificaciones"
      subtitle="Calendario y actividad del equipo"
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      {!feed.length ? (
        <Card>
          <View style={styles.empty}>
            <AppIcon name="bell" color={theme.muted} size={28} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin novedades</Text>
            <Text style={[styles.emptyBody, { color: theme.muted }]}>
              Aquí verás eventos del calendario e ingresos o gastos que registre tu equipo en libros compartidos.
            </Text>
          </View>
        </Card>
      ) : (
        <Card style={styles.list}>
          {feed.map((item, index) => {
            const colors = notificationToneColors(item.tone, theme);
            const unread = !readIds.includes(item.id);
            return (
              <ScalePressable
                key={item.id}
                haptic={false}
                onPress={() => {
                  void markRead(item.id);
                  if (item.kind === 'calendar') router.push('/(tabs)/calendario');
                  else router.push('/(tabs)/movimientos');
                }}>
                <View
                  style={[
                    styles.row,
                    index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}>
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
                        {item.kind === 'calendar' ? 'Calendario' : item.kind === 'income' ? 'Ingreso' : 'Gasto'}
                      </Pill>
                      <Text style={[styles.when, { color: theme.muted }]}>{item.when}</Text>
                    </View>
                  </View>
                </View>
              </ScalePressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, alignItems: 'flex-start' },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 8 },
  body: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  when: { fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyBody: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
