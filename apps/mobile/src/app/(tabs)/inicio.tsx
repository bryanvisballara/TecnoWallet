import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildWeeklySpend, DonutChart, WeeklyBars } from '@/components/charts';
import { LedgerSwitcher } from '@/components/ledger-switcher';
import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, IconButton, Pill, ProgressBar, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { filterTransactionsByMonth, monthTotals } from '@/lib/dates';
import { useAuthStore } from '@/store/auth';
import { useActiveCalendar } from '@/store/calendar';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { buildNotificationFeed, unreadCount, useNotificationsStore } from '@/store/notifications';
import { usePeriodStore } from '@/store/period';

const movementFilters = ['Todos', 'Gastos', 'Ingresos', 'Recurrentes'] as const;
type MovementFilter = (typeof movementFilters)[number];

export default function DashboardScreen() {
  const theme = useAppTheme();
  const profile = useAuthStore((state) => state.profile);
  const { summary, transactions, upcoming, ledger, envelopes } = useActiveLedger();
  const { items: calendarItems } = useActiveCalendar();
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const readIds = useNotificationsStore((state) => state.readIds);
  const dismissedIds = useNotificationsStore((state) => state.dismissedIds);
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const monthLabel = usePeriodStore((state) => state.label);
  const isCurrentMonth = usePeriodStore((state) => state.isCurrentMonth);
  const [hidden, setHidden] = useState(false);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('Todos');
  const value = (amount: number, compact = false) => (hidden ? '••••••' : money(amount, compact));
  const goalRatio = summary.goal > 0 ? summary.goalCurrent / summary.goal : 0;
  const period = useMemo(() => ({ year, month }), [year, month]);
  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, period),
    [transactions, period],
  );
  const cashflow = useMemo(() => {
    const totals = monthTotals(monthTransactions);
    return { ...totals, remaining: totals.income - totals.expenses };
  }, [monthTransactions]);
  const liquidezTotal = cashflow.remaining;

  const notificationBadge = useMemo(() => {
    const feed = buildNotificationFeed({
      calendarItems,
      ledgers,
      snapshots,
      selfName: profile.name,
    });
    return unreadCount(feed, readIds, dismissedIds);
  }, [calendarItems, ledgers, snapshots, profile.name, readIds, dismissedIds]);

  const budget = useMemo(() => {
    const expenseEnvelopes = envelopes.filter((item) => item.kind === 'expense');
    const assigned = expenseEnvelopes.reduce((sum, item) => sum + item.budget, 0);
    const spent = monthTransactions
      .filter((item) => item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const available = Math.max(assigned - spent, 0);
    const ratio = assigned > 0 ? available / assigned : 0;
    const today = new Date();
    const reference =
      isCurrentMonth
        ? today
        : new Date(year, month + 1, 0);
    const day = reference.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysLeft = isCurrentMonth ? Math.max(daysInMonth - day + 1, 1) : 1;
    const daily = available / daysLeft;
    const status =
      assigned <= 0
        ? 'Sin presupuesto mensual'
        : ratio >= 0.4
          ? 'Tu presupuesto va bien'
          : ratio >= 0.15
            ? 'Vas justo este mes'
            : 'Presupuesto casi agotado';
    return { assigned, spent, available, ratio, daily, status };
  }, [envelopes, monthTransactions, isCurrentMonth, year, month]);

  const weekAnchor = useMemo(
    () => (isCurrentMonth ? new Date() : new Date(year, month + 1, 0, 12, 0, 0)),
    [isCurrentMonth, year, month],
  );
  const weekTotal = useMemo(
    () =>
      buildWeeklySpend(monthTransactions, weekAnchor).reduce(
        (sum, day) => sum + day.expenseTotal,
        0,
      ),
    [monthTransactions, weekAnchor],
  );

  const weekInsight = useMemo(() => {
    if (monthTransactions.length === 0 || weekTotal <= 0 || !summary.comparison) return null;
    const delta = Math.abs(Math.round(summary.comparison));
    const spentLess = summary.comparison < 0;
    return {
      title: spentLess ? 'Buen ritmo esta semana' : 'Esta semana gastaste más',
      body: spentLess
        ? `Gastaste ${delta}% menos. Mantén el rumbo.`
        : `Gastaste ${delta}% más que la semana anterior.`,
    };
  }, [monthTransactions.length, weekTotal, summary.comparison]);

  const filteredMovements = useMemo(
    () =>
      monthTransactions.filter((item) => {
        if (movementFilter === 'Gastos') return item.amount < 0;
        if (movementFilter === 'Ingresos') return item.amount > 0;
        if (movementFilter === 'Recurrentes') return Boolean(item.recurring);
        return true;
      }),
    [monthTransactions, movementFilter],
  );

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
      <MonthSwitcher />
      <Card style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
        <View style={uiStyles.between}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={`Liquidez total ${money(liquidezTotal)}. Ingresos menos gastos de ${monthLabel}`}
            style={styles.balancePress}
            onPress={() => router.push('/(tabs)/movimientos')}>
            <Text style={styles.balanceLabel}>Liquidez total</Text>
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
          accessibilityLabel={`Liquidez total ${money(liquidezTotal)}. Ingresos menos gastos de ${monthLabel}`}
          onPress={() => router.push('/(tabs)/movimientos')}>
          <Text style={styles.balance}>{value(liquidezTotal)}</Text>
          <View style={styles.balanceFooter}>
            <Pill tone="neutral">{monthLabel}</Pill>
            <Text style={styles.updated}>Ingresos − gastos</Text>
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
              <Text style={[styles.metricValue, { color: theme.text }]}>{value(cashflow.income, true)}</Text>
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
              <Text style={[styles.metricValue, { color: theme.text }]}>{value(cashflow.expenses, true)}</Text>
            </Card>
          </ScalePressable>
        </View>
        <View style={styles.metricSlot}>
          <Card style={styles.metric} delay={120}>
            <View style={[styles.metricIcon, { backgroundColor: theme.primarySoft }]}>
              <AppIcon name="wallet.pass.fill" color={theme.primary} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>Restante</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>{value(cashflow.remaining, true)}</Text>
          </Card>
        </View>
      </View>

      <Card>
        {budget.assigned > 0 ? (
          <>
            <View style={uiStyles.between}>
              <View style={styles.budgetCopy}>
                <Text style={[styles.cardLabel, { color: theme.muted }]}>Disponible · {monthLabel}</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{budget.status}</Text>
                <Pill tone="blue">{Math.round(budget.ratio * 100)}% disponible</Pill>
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
          </>
        ) : (
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Sin presupuesto mensual. Configurar presupuesto opcional"
            onPress={() => router.push('/(tabs)/sobres')}
            style={styles.noBudgetPress}>
            <View style={uiStyles.between}>
              <View style={styles.budgetCopy}>
                <Text style={[styles.cardLabel, { color: theme.muted }]}>Presupuesto mensual · Opcional</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Sin presupuesto</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  Puedes registrar y controlar gastos sin establecer un límite.
                </Text>
              </View>
              <View style={[styles.noBudgetIcon, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name="wallet.pass.fill" color={theme.primary} size={28} />
              </View>
            </View>
            <View style={[styles.noBudgetAction, { backgroundColor: theme.surfaceSecondary }]}>
              <Text style={[styles.noBudgetActionText, { color: theme.text }]}>
                Configurar presupuesto
              </Text>
              <Text style={[styles.optionalText, { color: theme.muted }]}>Opcional</Text>
            </View>
          </ScalePressable>
        )}
      </Card>

      {summary.goal > 0 ? (
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="Ver detalle de la meta de agosto"
          onPress={() => router.push({ pathname: '/goal/[id]', params: { id: 'agosto' } })}>
          <Card>
            <View style={uiStyles.between}>
              <View>
                <Text style={[styles.cardLabel, { color: theme.muted }]}>Meta · {monthLabel}</Text>
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
          <Text style={[styles.cardLabel, { color: theme.muted }]}>Meta · {monthLabel}</Text>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Sin meta en este libro</Text>
          <Text style={[styles.small, { color: theme.muted }]}>
            Cuando definas una meta, verás el progreso aquí.
          </Text>
        </Card>
      )}

      <SectionTitle>Actividad semanal</SectionTitle>
      <Card>
        <WeeklyBars
          transactions={monthTransactions}
          today={weekAnchor}
          resetKey={`${ledger.id}-${year}-${month}`}
        />
      </Card>

      <SectionTitle action="Ver todos" onAction={() => router.push('/(tabs)/movimientos')}>
        Movimientos · {monthLabel}
      </SectionTitle>

      <View style={styles.filters}>
        {movementFilters.map((item) => {
          const selected = movementFilter === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setMovementFilter(item)}
              style={[
                styles.filter,
                {
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderColor: selected ? theme.primary : theme.border,
                },
              ]}>
              <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : theme.muted }]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={[styles.movementSummary, { backgroundColor: theme.primarySoft }]}>
        <View style={styles.movementSummaryCopy}>
          <Text style={[styles.small, { color: theme.muted }]}>Balance · {monthLabel}</Text>
          <Text style={[styles.movementSummaryValue, { color: theme.text }]}>
            {value(cashflow.remaining)}
          </Text>
        </View>
        <View style={styles.movementSummarySides}>
          <Text style={[styles.small, { color: theme.success }]}>
            +{value(cashflow.income, true)}
          </Text>
          <Text style={[styles.small, { color: theme.danger }]}>
            −{value(cashflow.expenses, true)}
          </Text>
        </View>
      </Card>

      <Card style={styles.listCard}>
        {filteredMovements.length === 0 ? (
          <Text style={[styles.emptyList, { color: theme.muted }]}>
            {monthTransactions.length === 0
              ? `No hay movimientos en ${monthLabel}.`
              : `No hay ${movementFilter.toLowerCase()} en ${monthLabel}.`}
          </Text>
        ) : (
          filteredMovements.slice(0, 4).map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.transaction,
                index > 0 && {
                  borderTopColor: theme.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <View
                style={[
                  styles.transactionIcon,
                  {
                    backgroundColor:
                      item.amount > 0 ? theme.successSoft : theme.surfaceSecondary,
                  },
                ]}>
                <AppIcon
                  name={item.icon}
                  color={item.amount > 0 ? theme.success : theme.primary}
                />
              </View>
              <View style={styles.transactionCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  {item.category} · {item.date}
                </Text>
              </View>
              <Text
                style={[
                  uiStyles.amount,
                  { color: item.amount > 0 ? theme.success : theme.text },
                ]}>
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
  noBudgetPress: { gap: 16 },
  noBudgetIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 14 },
  noBudgetAction: { minHeight: 48, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noBudgetActionText: { fontSize: 13, fontWeight: '700' },
  optionalText: { fontSize: 11, fontWeight: '600' },
  percent: { fontSize: 22, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 17 },
  emptyList: { fontSize: 13, lineHeight: 18, paddingVertical: 12, textAlign: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterText: { fontSize: 12, fontWeight: '600' },
  movementSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0,
  },
  movementSummaryCopy: { flex: 1, paddingRight: 12 },
  movementSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  movementSummarySides: { alignItems: 'flex-end', gap: 6 },
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
