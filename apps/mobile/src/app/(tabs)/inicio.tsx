import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buildWeeklySpend, DonutChart, WeeklyBars } from '@/components/charts';
import { HeroBalanceBanner } from '@/components/hero-balance-banner';
import { LedgerSwitcher } from '@/components/ledger-switcher';
import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, IconButton, ProgressBar, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { getActiveMoneyCurrency, money, moneyAmount } from '@/data/demo';
import {
  displayLedgerName,
  timeGreeting,
  useAppCopy,
  type MovementFilterKey,
} from '@/i18n/app-copy';
import { filterTransactionsByMonth, monthTotals } from '@/lib/dates';
import { isLiquidAccount, sumBalances } from '@/lib/accounts';
import { localStorage } from '@/services/persistence';
import { useAuthStore } from '@/store/auth';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { buildNotificationFeed, unreadCount, useNotificationsStore } from '@/store/notifications';
import { usePeriodStore } from '@/store/period';
import { usePreferencesStore } from '@/store/preferences';
import { hasPaidPlan, usePlusStore } from '@/store/plus';

const movementFilterKeys: MovementFilterKey[] = ['all', 'expenses', 'income', 'recurring'];

export default function DashboardScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const profile = useAuthStore((state) => state.profile);
  const openPaywall = usePlusStore((state) => state.openPaywall);
  const plusAccess = usePlusStore((state) => state.access);
  const [authUserId, setAuthUserId] = useState('');
  const { summary, transactions, upcoming, ledger, envelopes, accounts } = useActiveLedger();
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const readIds = useNotificationsStore((state) => state.readIds);
  const dismissedIds = useNotificationsStore((state) => state.dismissedIds);
  const activities = useNotificationsStore((state) => state.activities);

  useEffect(() => {
    void localStorage.get('auth-user-id', '').then((id) => setAuthUserId(id || ''));
  }, [profile?.name]);
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const monthLabel = usePeriodStore((state) => state.label);
  const isCurrentMonth = usePeriodStore((state) => state.isCurrentMonth);
  const hideBalances = usePreferencesStore((state) => state.hideBalances);
  const setHideBalances = usePreferencesStore((state) => state.setHideBalances);
  const [hidden, setHidden] = useState(hideBalances);
  const [movementFilter, setMovementFilter] = useState<MovementFilterKey>('all');
  const value = (amount: number, compact = false) => (hidden ? '••••••' : money(amount, compact));
  const amountOnly = (amount: number, compact = false) =>
    hidden ? '••••••' : moneyAmount(amount, compact);
  const moneyCurrency = getActiveMoneyCurrency();
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';

  useEffect(() => {
    setHidden(hideBalances);
  }, [hideBalances]);
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
  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const liquidezTotal = useMemo(() => sumBalances(liquidAccounts), [liquidAccounts]);

  const notificationBadge = useMemo(() => {
    if (!profile?.name) return 0;
    const feed = buildNotificationFeed({
      activities,
      ledgers,
      snapshots,
      selfName: profile.name,
      selfUserId: authUserId,
    });
    return unreadCount(feed, readIds, dismissedIds);
  }, [activities, ledgers, snapshots, profile?.name, authUserId, readIds, dismissedIds]);

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
        ? copy.home.budgetNone
        : ratio >= 0.4
          ? copy.home.budgetOk
          : ratio >= 0.15
            ? copy.home.budgetTight
            : copy.home.budgetLow;
    return { assigned, spent, available, ratio, daily, status };
  }, [envelopes, monthTransactions, isCurrentMonth, year, month, copy.home]);

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
      title: spentLess ? copy.home.weekGood : copy.home.weekMore,
      body: spentLess ? copy.home.weekLessBody(delta) : copy.home.weekMoreBody(delta),
    };
  }, [monthTransactions.length, weekTotal, summary.comparison, copy.home]);

  const filteredMovements = useMemo(
    () =>
      monthTransactions.filter((item) => {
        if (movementFilter === 'expenses') return item.amount < 0;
        if (movementFilter === 'income') return item.amount > 0;
        if (movementFilter === 'recurring') return Boolean(item.recurring);
        return true;
      }),
    [monthTransactions, movementFilter],
  );

  if (!profile || !ledger) {
    return <Screen withTabBar title={copy.common.loading} />;
  }

  const greeting = timeGreeting(copy);

  return (
    <Screen
      withTabBar
      title={<LedgerSwitcher />}
      subtitle={`${greeting}, ${profile.name.split(' ')[0]} · ${ledgerLabel}`}
      right={
        <View style={[uiStyles.row, uiStyles.gap8]}>
          <IconButton
            icon="person.badge.plus"
            label={copy.common.inviteTo(ledgerLabel)}
            onPress={() => {
              if (!hasPaidPlan(plusAccess)) {
                openPaywall('SHARING_REQUIRED');
                return;
              }
              router.push({
                pathname: '/(tabs)/ledgers',
                params: { focus: ledger.id, tab: 'share' },
              });
            }}
          />
          <IconButton
            icon="bell"
            label={copy.common.notifications}
            badge={notificationBadge}
            onPress={() => router.push('/(tabs)/notifications')}
          />
          <IconButton
            icon="person.crop.circle"
            label={copy.common.profile}
            onPress={() => router.push('/(tabs)/profile')}
          />
        </View>
      }>
      <MonthSwitcher />
      <HeroBalanceBanner
        label={copy.home.totalLiquidity}
        amount={liquidezTotal}
        hidden={hidden}
        onToggleHidden={() => {
          setHidden((prev) => {
            const next = !prev;
            void setHideBalances(next);
            return next;
          });
        }}
        toggleA11yLabel={copy.home.toggleBalances}
        ledgerLabel={ledgerLabel}
        ledgerIcon={ledger.icon || 'house.fill'}
        actionLabel={copy.home.liquidityFromAccounts(liquidAccounts.length)}
        accessibilityLabel={copy.home.liquidityA11y(
          money(liquidezTotal),
          liquidAccounts.length,
        )}
        onPress={() => router.push('/(tabs)/mis-cuentas')}
      />

      <View style={styles.metrics}>
        <View style={styles.metricSlot}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={copy.home.viewIncomeDetail}
            style={styles.metricPress}
            onPress={() => router.push({ pathname: '/(tabs)/cashflow/[type]', params: { type: 'ingresos' } })}>
            <Card style={styles.metric} delay={40}>
              <View style={[styles.metricIcon, { backgroundColor: theme.successSoft }]}>
                <AppIcon name="arrow.down.circle.fill" color={theme.success} />
              </View>
              <Text style={[styles.metricLabel, { color: theme.muted }]} numberOfLines={1}>
                {copy.home.income} ({moneyCurrency})
              </Text>
              <Text
                style={[styles.metricValue, { color: theme.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}>
                {amountOnly(cashflow.income, true)}
              </Text>
            </Card>
          </ScalePressable>
        </View>
        <View style={styles.metricSlot}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={copy.home.viewExpensesDetail}
            style={styles.metricPress}
            onPress={() => router.push({ pathname: '/(tabs)/cashflow/[type]', params: { type: 'gastos' } })}>
            <Card style={styles.metric} delay={80}>
              <View style={[styles.metricIcon, { backgroundColor: '#FDECEC' }]}>
                <AppIcon name="arrow.up.circle.fill" color={theme.danger} />
              </View>
              <Text style={[styles.metricLabel, { color: theme.muted }]} numberOfLines={1}>
                {copy.home.expenses} ({moneyCurrency})
              </Text>
              <Text
                style={[styles.metricValue, { color: theme.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}>
                {amountOnly(cashflow.expenses, true)}
              </Text>
            </Card>
          </ScalePressable>
        </View>
        <View style={styles.metricSlot}>
          <Card style={styles.metric} delay={120}>
            <View style={[styles.metricIcon, { backgroundColor: theme.primarySoft }]}>
              <AppIcon name="wallet.pass.fill" color={theme.primary} />
            </View>
            <Text style={[styles.metricLabel, { color: theme.muted }]} numberOfLines={1}>
              {copy.home.remaining} ({moneyCurrency})
            </Text>
            <Text
              style={[styles.metricValue, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}>
              {amountOnly(cashflow.remaining, true)}
            </Text>
          </Card>
        </View>
      </View>

      <Card>
        {budget.assigned > 0 ? (
          <>
            <View style={uiStyles.between}>
              <View style={styles.budgetCopy}>
                <Text style={[styles.cardLabel, { color: theme.muted }]}>
                  {copy.home.availableMonth(monthLabel)}
                </Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{budget.status}</Text>
                <Pill tone="blue">{copy.home.pctAvailable(Math.round(budget.ratio * 100))}</Pill>
              </View>
              <DonutChart value={budget.ratio} amount={budget.available} />
            </View>
            <View style={[styles.daily, { backgroundColor: theme.surfaceSecondary }]}>
              <View>
                <Text style={[styles.dailyLabel, { color: theme.muted }]}>{copy.home.dailySpend}</Text>
                <Text style={[styles.dailyValue, { color: theme.text }]}>{value(budget.daily)}</Text>
              </View>
              <AppIcon name="calendar" color={theme.primary} size={26} />
            </View>
          </>
        ) : (
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={copy.home.configureBudgetA11y}
            onPress={() => router.push('/(tabs)/sobres')}
            style={styles.noBudgetPress}>
            <View style={uiStyles.between}>
              <View style={styles.budgetCopy}>
                <Text style={[styles.cardLabel, { color: theme.muted }]}>
                  {copy.home.monthlyBudgetOptional}
                </Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{copy.home.noBudget}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>{copy.home.noBudgetHint}</Text>
              </View>
              <View style={[styles.noBudgetIcon, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name="wallet.pass.fill" color={theme.primary} size={28} />
              </View>
            </View>
            <View style={[styles.noBudgetAction, { backgroundColor: theme.surfaceSecondary }]}>
              <Text style={[styles.noBudgetActionText, { color: theme.text }]}>
                {copy.home.configureBudget}
              </Text>
              <Text style={[styles.optionalText, { color: theme.muted }]}>{copy.common.optional}</Text>
            </View>
          </ScalePressable>
        )}
      </Card>

      {summary.goal > 0 ? (
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={copy.home.viewGoalA11y}
          onPress={() => router.push({ pathname: '/(tabs)/goal/[id]', params: { id: 'agosto' } })}>
          <Card>
            <View style={uiStyles.between}>
              <View>
                <Text style={[styles.cardLabel, { color: theme.muted }]}>
                  {copy.home.goalMonth(monthLabel)}
                </Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {copy.home.saveGoal(value(summary.goal))}
                </Text>
              </View>
              <Text style={[styles.percent, { color: theme.success }]}>{Math.round(goalRatio * 100)}%</Text>
            </View>
            <ProgressBar value={goalRatio} color={theme.success} label={copy.home.goalProgress} />
            <View style={uiStyles.between}>
              <Text style={[styles.small, { color: theme.muted }]}>
                {copy.home.savedAmount(value(summary.goalCurrent))}
              </Text>
              <Text style={[styles.small, { color: theme.muted }]}>
                {copy.home.remainingAmount(value(Math.max(summary.goal - summary.goalCurrent, 0)))}
              </Text>
            </View>
          </Card>
        </ScalePressable>
      ) : (
        <Card>
          <Text style={[styles.cardLabel, { color: theme.muted }]}>{copy.home.goalMonth(monthLabel)}</Text>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{copy.home.noGoalTitle}</Text>
          <Text style={[styles.small, { color: theme.muted }]}>{copy.home.noGoalHint}</Text>
        </Card>
      )}

      <SectionTitle>{copy.home.weeklyActivity}</SectionTitle>
      <Card>
        <WeeklyBars
          transactions={monthTransactions}
          today={weekAnchor}
          resetKey={`${ledger.id}-${year}-${month}`}
        />
      </Card>

      <SectionTitle action={copy.common.viewAll} onAction={() => router.push('/(tabs)/movimientos')}>
        {copy.home.movementsMonth(monthLabel)}
      </SectionTitle>

      <View style={styles.filters}>
        {movementFilterKeys.map((key) => {
          const selected = movementFilter === key;
          const label = copy.home.filters[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setMovementFilter(key)}
              style={[
                styles.filter,
                {
                  backgroundColor: selected ? theme.primary : theme.surface,
                  borderColor: selected ? theme.primary : theme.border,
                },
              ]}>
              <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : theme.muted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={[styles.movementSummary, { backgroundColor: theme.primarySoft }]}>
        <View style={styles.movementSummaryCopy}>
          <Text style={[styles.small, { color: theme.muted }]}>{copy.home.balanceMonth(monthLabel)}</Text>
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
              ? copy.home.noMovements(monthLabel)
              : copy.home.noFiltered(copy.home.filters[movementFilter], monthLabel)}
          </Text>
        ) : (
          filteredMovements.slice(0, 4).map((item, index) => (
            <ScalePressable
              key={item.id}
              haptic={false}
              onPress={() =>
                router.push({
                  pathname: '/add-transaction',
                  params: { id: item.id },
                })
              }
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
            </ScalePressable>
          ))
        )}
      </Card>

      <SectionTitle action={copy.home.calendar} onAction={() => router.push('/(tabs)/calendario')}>
        {copy.home.upcomingPayments}
      </SectionTitle>
      {upcoming.length === 0 ? (
        <Card>
          <Text style={[styles.emptyList, { color: theme.muted }]}>{copy.home.noUpcoming}</Text>
        </Card>
      ) : (
      <View style={styles.upcomingRow}>
        {upcoming.map((bill) => (
          <ScalePressable
            key={bill.name}
            style={[styles.upcomingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/salud-financiera')}>
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
  metrics: { flexDirection: 'row', gap: 10 },
  metricSlot: { flex: 1, minWidth: 0 },
  metricPress: { flex: 1, width: '100%' },
  metric: { width: '100%', padding: 12, gap: 7, borderRadius: 18 },
  metricIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 12, fontWeight: '600' },
  metricValue: {
    width: '100%',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
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
