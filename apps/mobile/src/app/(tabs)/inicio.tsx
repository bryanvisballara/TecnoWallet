import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildWeeklySpend, DonutChart, WeeklyBars } from '@/components/charts';
import { LedgerSwitcher } from '@/components/ledger-switcher';
import { AppIcon, Card, IconButton, Pill, ProgressBar, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useAuthStore } from '@/store/auth';
import { useCalendarStore } from '@/store/calendar';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { buildNotificationFeed, unreadCount, useNotificationsStore } from '@/store/notifications';

const DEMO_TODAY = new Date(2026, 7, 5, 12, 0, 0);

export default function DashboardScreen() {
  const theme = useAppTheme();
  const profile = useAuthStore((state) => state.profile);
  const { summary, transactions, upcoming, ledger, accounts, envelopes } = useActiveLedger();
  const calendarItems = useCalendarStore((state) => state.items);
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const readIds = useNotificationsStore((state) => state.readIds);
  const [hidden, setHidden] = useState(false);
  const value = (amount: number, compact = false) => (hidden ? '••••••' : money(amount, compact));
  const goalRatio = summary.goal > 0 ? summary.goalCurrent / summary.goal : 0;
  const assets = accounts.filter((item) => item.balance > 0).reduce((sum, item) => sum + item.balance, 0);
  const debt = Math.abs(accounts.filter((item) => item.balance < 0).reduce((sum, item) => sum + item.balance, 0));
  const netWorth = assets - debt;

  const notificationBadge = useMemo(() => {
    const feed = buildNotificationFeed({
      calendarItems,
      ledgers,
      snapshots,
      selfName: profile.name,
    });
    return unreadCount(feed, readIds);
  }, [calendarItems, ledgers, snapshots, profile.name, readIds]);

  const budget = useMemo(() => {
    const expenseEnvelopes = envelopes.filter((item) => item.kind === 'expense');
    const assigned = expenseEnvelopes.reduce((sum, item) => sum + item.budget, 0);
    const spent = expenseEnvelopes.reduce((sum, item) => sum + item.spent, 0);
    const available = Math.max(assigned - spent, 0);
    const ratio = assigned > 0 ? available / assigned : 0;
    const day = DEMO_TODAY.getDate();
    const daysInMonth = new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(daysInMonth - day + 1, 1);
    const daily = available / daysLeft;
    const status =
      assigned <= 0
        ? 'Define tu presupuesto en Sobres'
        : ratio >= 0.4
          ? 'Tu presupuesto va bien'
          : ratio >= 0.15
            ? 'Vas justo este mes'
            : 'Presupuesto casi agotado';
    return { assigned, spent, available, ratio, daily, status };
  }, [envelopes]);

  const weekTotal = useMemo(
    () => buildWeeklySpend(transactions).reduce((sum, day) => sum + day.amount, 0),
    [transactions],
  );

  const weekInsight = useMemo(() => {
    if (transactions.length === 0 || weekTotal <= 0 || !summary.comparison) return null;
    const delta = Math.abs(Math.round(summary.comparison));
    const spentLess = summary.comparison < 0;
    return {
      title: spentLess ? 'Buen ritmo esta semana' : 'Esta semana gastaste más',
      body: spentLess
        ? `Gastaste ${delta}% menos. Mantén el rumbo.`
        : `Gastaste ${delta}% más que la semana anterior.`,
    };
  }, [transactions.length, weekTotal, summary.comparison]);

  return (
    <Screen
      withTabBar
      title={<LedgerSwitcher />}
      subtitle={`Buenos días, ${profile.name.split(' ')[0]} · ${ledger.name}`}
      right={
        <View style={[uiStyles.row, uiStyles.gap8]}>
          <IconButton
            icon="person.badge.plus"
            label={`Invitar a ${ledger.name}`}
            onPress={() =>
              router.push({ pathname: '/ledgers', params: { focus: ledger.id } })
            }
          />
          <IconButton
            icon="bell"
            label="Notificaciones"
            badge={notificationBadge}
            onPress={() => router.push('/notifications')}
          />
          <IconButton icon="person.crop.circle" label="Perfil" onPress={() => router.push('/profile')} />
        </View>
      }>
      <Card style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
        <View style={uiStyles.between}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={`Patrimonio total ${money(netWorth)}. Ver desglose`}
            style={styles.balancePress}
            onPress={() => router.push('/patrimonio')}>
            <Text style={styles.balanceLabel}>Patrimonio total</Text>
          </ScalePressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mostrar u ocultar saldos"
            hitSlop={12}
            onPress={() => setHidden((prev) => !prev)}>
            <AppIcon name={hidden ? 'eye.slash.fill' : 'eye.fill'} color="#FFFFFF" size={19} />
          </Pressable>
        </View>
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={`Patrimonio total ${money(netWorth)}. Ver desglose`}
          onPress={() => router.push('/patrimonio')}>
          <Text style={styles.balance}>{value(netWorth)}</Text>
          <View style={styles.balanceFooter}>
            <Pill tone="neutral">{ledger.name}</Pill>
            <Text style={styles.updated}>{accounts.length} cuenta{accounts.length === 1 ? '' : 's'}</Text>
          </View>
        </ScalePressable>
      </Card>

      <View style={styles.metrics}>
        <View style={styles.metricSlot}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Ver detalle de ingresos"
            style={styles.metricPress}
            onPress={() => router.push({ pathname: '/cashflow/[type]', params: { type: 'ingresos' } })}>
            <Card style={styles.metric} delay={40}>
              <View style={[styles.metricIcon, { backgroundColor: theme.successSoft }]}>
                <AppIcon name="arrow.down.circle.fill" color={theme.success} />
              </View>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Ingresos</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{value(summary.income, true)}</Text>
            </Card>
          </ScalePressable>
        </View>
        <View style={styles.metricSlot}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Ver detalle de gastos"
            style={styles.metricPress}
            onPress={() => router.push({ pathname: '/cashflow/[type]', params: { type: 'gastos' } })}>
            <Card style={styles.metric} delay={80}>
              <View style={[styles.metricIcon, { backgroundColor: '#FDECEC' }]}>
                <AppIcon name="arrow.up.circle.fill" color={theme.danger} />
              </View>
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Gastos</Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>{value(summary.expenses, true)}</Text>
            </Card>
          </ScalePressable>
        </View>
        <View style={styles.metricSlot}>
          <Card style={styles.metric} delay={120}>
            <View style={[styles.metricIcon, { backgroundColor: theme.primarySoft }]}>
              <AppIcon name="wallet.pass.fill" color={theme.primary} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>Restante</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{value(summary.remaining, true)}</Text>
          </Card>
        </View>
      </View>

      <Card>
        <View style={uiStyles.between}>
          <View style={styles.budgetCopy}>
            <Text style={[styles.cardLabel, { color: theme.muted }]}>Disponible este mes</Text>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{budget.status}</Text>
            <Pill tone={budget.assigned > 0 ? 'blue' : 'neutral'}>
              {budget.assigned > 0 ? `${Math.round(budget.ratio * 100)}% disponible` : 'Sin presupuesto'}
            </Pill>
          </View>
          <DonutChart value={budget.ratio} amount={budget.available} />
        </View>
        <View style={[styles.daily, { backgroundColor: theme.surfaceSecondary }]}>
          <View>
            <Text style={[styles.dailyLabel, { color: theme.muted }]}>Puedes gastar por día</Text>
            <Text style={[styles.dailyValue, { color: theme.text }]}>{value(budget.daily)}</Text>
          </View>
          <AppIcon name="calendar" color={theme.primary} size={26} />
        </View>
      </Card>

      {summary.goal > 0 ? (
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="Ver detalle de la meta de agosto"
          onPress={() => router.push({ pathname: '/goal/[id]', params: { id: 'agosto' } })}>
          <Card>
            <View style={uiStyles.between}>
              <View>
                <Text style={[styles.cardLabel, { color: theme.muted }]}>Meta de agosto</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Ahorrar {value(summary.goal)}</Text>
              </View>
              <Text style={[styles.percent, { color: theme.success }]}>{Math.round(goalRatio * 100)}%</Text>
            </View>
            <ProgressBar value={goalRatio} color={theme.success} label="Progreso de meta mensual" />
            <View style={uiStyles.between}>
              <Text style={[styles.small, { color: theme.muted }]}>{value(summary.goalCurrent)} ahorrados</Text>
              <Text style={[styles.small, { color: theme.muted }]}>Faltan {value(Math.max(summary.goal - summary.goalCurrent, 0))}</Text>
            </View>
          </Card>
        </ScalePressable>
      ) : (
        <Card>
          <Text style={[styles.cardLabel, { color: theme.muted }]}>Meta de agosto</Text>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Sin meta en este libro</Text>
          <Text style={[styles.small, { color: theme.muted }]}>
            Cuando definas una meta, verás el progreso aquí.
          </Text>
        </Card>
      )}

      <SectionTitle>Gasto semanal</SectionTitle>
      <Card>
        <View style={uiStyles.between}>
          <View>
            <Text style={[styles.cardLabel, { color: theme.muted }]}>Esta semana</Text>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{value(weekTotal)}</Text>
          </View>
          <Pill tone={weekTotal > 0 ? 'orange' : 'neutral'}>
            {weekTotal > 0 ? `${summary.comparison}% vs. anterior` : 'Sin gastos'}
          </Pill>
        </View>
        <WeeklyBars transactions={transactions} resetKey={ledger.id} />
      </Card>

      <SectionTitle action="Ver todos" onAction={() => router.push('/(tabs)/movimientos')}>
        Movimientos recientes
      </SectionTitle>
      <Card style={styles.listCard}>
        {transactions.length === 0 ? (
          <Text style={[styles.emptyList, { color: theme.muted }]}>
            Este libro todavía no tiene movimientos.
          </Text>
        ) : (
          transactions.slice(0, 4).map((item, index) => (
            <View
              key={item.id}
              style={[styles.transaction, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.transactionIcon, { backgroundColor: item.amount > 0 ? theme.successSoft : theme.surfaceSecondary }]}>
                <AppIcon name={item.icon} color={item.amount > 0 ? theme.success : theme.primary} />
              </View>
              <View style={styles.transactionCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  {item.category} · {item.date}
                </Text>
              </View>
              <Text style={[uiStyles.amount, { color: item.amount > 0 ? theme.success : theme.text }]}>
                {item.amount > 0 ? '+' : ''}
                {value(item.amount)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <SectionTitle action="Calendario" onAction={() => router.push('/(tabs)/calendario')}>
        Próximos pagos
      </SectionTitle>
      {upcoming.length === 0 ? (
        <Card>
          <Text style={[styles.emptyList, { color: theme.muted }]}>No hay pagos próximos en este libro.</Text>
        </Card>
      ) : (
      <View style={styles.upcomingRow}>
        {upcoming.map((bill) => (
          <ScalePressable
            key={bill.name}
            style={[styles.upcomingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/feature/facturas')}>
            <View style={[styles.billDot, { backgroundColor: bill.color }]} />
            <Text style={[styles.rowTitle, { color: theme.text }]}>{bill.name}</Text>
            <Text style={[styles.billAmount, { color: theme.text }]}>{value(bill.amount)}</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{bill.date}</Text>
          </ScalePressable>
        ))}
      </View>
      )}

      {weekInsight ? (
        <Card style={[styles.reminder, { backgroundColor: theme.primarySoft }]}>
          <View style={[styles.reminderIcon, { backgroundColor: theme.primary }]}>
            <AppIcon name="sparkles" color="#FFFFFF" />
          </View>
          <View style={styles.transactionCopy}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>{weekInsight.title}</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{weekInsight.body}</Text>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: { padding: 22, gap: 12, borderWidth: 0 },
  balancePress: { flex: 1 },
  balanceLabel: { color: '#DCEBFF', fontSize: 14, fontWeight: '600' },
  balance: { color: '#FFFFFF', fontSize: 40, fontWeight: '700', letterSpacing: -1.7, fontVariant: ['tabular-nums'] },
  balanceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  updated: { color: '#DCEBFF', fontSize: 11 },
  metrics: { flexDirection: 'row', gap: 10 },
  metricSlot: { flex: 1, minWidth: 0 },
  metricPress: { flex: 1, width: '100%' },
  metric: { width: '100%', padding: 12, gap: 7, borderRadius: 18 },
  metricIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 12, fontWeight: '600' },
  metricValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  budgetCopy: { flex: 1, gap: 8 },
  cardLabel: { fontSize: 12, fontWeight: '600' },
  cardTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  daily: { marginTop: 16, borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dailyLabel: { fontSize: 12, fontWeight: '600' },
  dailyValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  percent: { fontSize: 22, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 17 },
  emptyList: { fontSize: 13, lineHeight: 18, paddingVertical: 12, textAlign: 'center' },
  listCard: { paddingVertical: 4 },
  transaction: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  transactionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  transactionCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  upcomingRow: { flexDirection: 'row', gap: 10 },
  upcomingCard: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 13, gap: 6 },
  billDot: { width: 10, height: 10, borderRadius: 5 },
  billAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  reminder: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  reminderIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
