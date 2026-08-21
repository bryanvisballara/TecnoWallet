import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { HeroNetWorthBanner } from '@/components/hero-net-worth-banner';
import { SwipeEditDeleteRow } from '@/components/swipe-edit-delete-row';
import { AppIcon, Card, Pill, ProgressBar, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { getActiveMoneyCurrency, money, moneyAmount, type Account } from '@/data/demo';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import {
  isLiquidAccount,
  isWealthAsset,
  isWealthDebt,
  sumBalances,
} from '@/lib/accounts';
import { buildRecurringCashflow, type RecurringLine } from '@/lib/recurring-cashflow';
import { useFinanceStore } from '@/store/finance';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { usePeriodStore } from '@/store/period';
import { usePreferencesStore } from '@/store/preferences';

function AccountRow({ account }: { account: Account }) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const removeAccount = useLedgerStore((state) => state.removeAccount);
  const isDebt = isWealthDebt(account);
  const mode = isDebt ? 'debt' : 'asset';

  const openDetail = () =>
    router.push({ pathname: '/(tabs)/account/[id]', params: { id: account.id } });

  const openEdit = () =>
    router.push({ pathname: '/add-account', params: { id: account.id, mode } });

  const confirmDelete = () => {
    const label = isDebt ? 'deuda' : 'activo';
    const run = async () => {
      try {
        await removeAccount(account.id);
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        Alert.alert(
          'No se pudo eliminar',
          error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        );
      }
    };
    Alert.alert(
      `Eliminar ${label}`,
      `¿Seguro que quieres eliminar «${account.name}»?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void run() },
      ],
    );
  };

  return (
    <SwipeEditDeleteRow
      itemKey={account.id}
      onEdit={openEdit}
      onDelete={confirmDelete}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver detalle de ${account.name}. Desliza para editar o eliminar.`}
        onPress={openDetail}>
        <Card>
          <View style={[uiStyles.row, uiStyles.gap12]}>
            <View style={[styles.accountIcon, { backgroundColor: `${account.color}1A` }]}>
              <AppIcon name={account.icon} color={account.color} size={24} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.accountName, { color: theme.text }]}>{account.name}</Text>
              <Text style={[styles.small, { color: theme.muted }]}>{account.kind}</Text>
            </View>
            <View style={styles.balanceCopy}>
              <Text
                style={[
                  styles.balance,
                  { color: account.balance < 0 ? theme.danger : theme.text },
                ]}>
                {money(account.balance < 0 ? Math.abs(account.balance) : account.balance)}
              </Text>
              <Text style={[styles.sync, { color: account.balance < 0 ? theme.danger : theme.success }]}>
                {account.balance < 0 ? copy.health.badgeDebt : copy.health.badgeAsset}
              </Text>
            </View>
            <AppIcon name="chevron" color={theme.muted} size={15} />
          </View>
        </Card>
      </Pressable>
    </SwipeEditDeleteRow>
  );
}

function RecurringGroup({
  title,
  total,
  items,
  empty,
  tapToAdd,
  tone,
  onAdd,
}: {
  title: string;
  total: number;
  items: RecurringLine[];
  empty: string;
  tapToAdd: string;
  tone: 'income' | 'expense';
  onAdd: () => void;
}) {
  const theme = useAppTheme();
  const removePlanningItem = useLedgerStore((state) => state.removePlanningItem);
  const voidTransaction = useFinanceStore((state) => state.voidTransaction);
  const amountColor = tone === 'income' ? theme.success : theme.danger;

  const openEdit = (item: RecurringLine) => {
    if (item.source === 'upcoming') {
      Alert.alert(
        'No editable',
        'Este ítem viene de una factura programada. Agrégalo como recurrente para poder editarlo.',
      );
      return;
    }
    if (item.source === 'transaction') {
      router.push({ pathname: '/add-transaction', params: { id: item.id } });
      return;
    }
    router.push({
      pathname: '/add-planning-item',
      params: {
        id: item.id,
        cashflow: item.bucket === 'income' ? 'income' : 'expense',
        bucket: item.bucket,
      },
    });
  };

  const confirmDelete = (item: RecurringLine) => {
    if (item.source === 'upcoming') {
      Alert.alert(
        'No se puede eliminar',
        'Este ítem es una factura programada. Agrégalo como recurrente para gestionarlo aquí.',
      );
      return;
    }
    const run = async () => {
      try {
        if (item.source === 'transaction') {
          await voidTransaction(item.id);
        } else {
          await removePlanningItem(item.id);
        }
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        Alert.alert(
          'No se pudo eliminar',
          error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        );
      }
    };
    Alert.alert(
      'Eliminar',
      `¿Seguro que quieres eliminar «${item.name}»?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void run() },
      ],
    );
  };

  return (
    <Card style={styles.recurringGroup}>
      <View style={uiStyles.between}>
        <View style={styles.recurringGroupHeader}>
          <Text style={[styles.recurringGroupTitle, { color: theme.text }]}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${tone === 'income' ? 'ingreso' : 'gasto'} recurrente`}
            onPress={onAdd}
            style={[styles.addBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
            <AppIcon name="plus" color={theme.primary} size={16} />
          </Pressable>
        </View>
        <Text style={[styles.recurringGroupTotal, { color: amountColor }]}>{money(total)}</Text>
      </View>
      {items.length === 0 ? (
        <Pressable accessibilityRole="button" onPress={onAdd}>
          <Text style={[styles.small, { color: theme.muted }]}>{empty}</Text>
          <Text style={[styles.addHint, { color: theme.primary }]}>{tapToAdd}</Text>
        </Pressable>
      ) : (
        items.map((item, index) => (
          <SwipeEditDeleteRow
            key={item.id}
            itemKey={item.id}
            disabled={item.source === 'upcoming'}
            onEdit={() => openEdit(item)}
            onDelete={() => confirmDelete(item)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}. Desliza para editar o eliminar.`}
              onPress={() => openEdit(item)}
              style={[
                styles.recurringRow,
                { backgroundColor: theme.surface },
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                },
              ]}>
              <View style={[styles.recurringIcon, { backgroundColor: `${amountColor}1A` }]}>
                <AppIcon name={item.icon} color={amountColor} size={18} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.accountName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.balance, { color: theme.text }]}>{money(item.amount)}</Text>
            </Pressable>
          </SwipeEditDeleteRow>
        ))
      )}
    </Card>
  );
}

export default function SaludFinancieraScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { accounts, ledger, transactions, upcoming, planning } = useActiveLedger();
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const moneyCurrency = (ledger?.baseCurrency || getActiveMoneyCurrency() || 'COP').toUpperCase();

  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const wealthAssets = useMemo(
    () => accounts.filter((item) => isWealthAsset(item)),
    [accounts],
  );
  const wealthDebts = useMemo(
    () => accounts.filter((item) => isWealthDebt(item)),
    [accounts],
  );

  const liquidez = sumBalances(liquidAccounts);
  const bienes = sumBalances(wealthAssets);
  const deudas = Math.abs(sumBalances(wealthDebts));
  const patrimonio = liquidez + bienes - deudas;
  const totalWealthBase = Math.max(liquidez, 0) + bienes + deudas;
  const creditUsage = totalWealthBase > 0 ? deudas / totalWealthBase : 0;

  const healthTone = creditUsage === 0 ? 'neutral' : creditUsage < 0.3 ? 'green' : creditUsage < 0.5 ? 'orange' : 'neutral';
  const healthColor = creditUsage === 0 ? theme.muted : creditUsage < 0.3 ? theme.success : theme.warning;
  const healthCopy =
    deudas === 0
      ? copy.health.noDebts
      : creditUsage < 0.3
        ? copy.health.debtOk
        : copy.health.debtHeavy;

  const recurring = useMemo(
    () => buildRecurringCashflow(transactions, { year, month }, upcoming, planning),
    [transactions, year, month, upcoming, planning],
  );

  const openPlanningAdd = (cashflow: 'income' | 'expense', bucket?: string) => {
    router.push({
      pathname: '/add-planning-item',
      params: bucket ? { cashflow, bucket } : { cashflow },
    });
  };
  const expenseLines = useMemo(
    () => [...recurring.bills, ...recurring.subscriptions, ...recurring.recurrings],
    [recurring.bills, recurring.subscriptions, recurring.recurrings],
  );
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';
  const hideBalances = usePreferencesStore((state) => state.hideBalances);
  const setHideBalances = usePreferencesStore((state) => state.setHideBalances);
  const [hidden, setHidden] = useState(hideBalances);

  useEffect(() => {
    setHidden(hideBalances);
  }, [hideBalances]);

  if (!ledger) {
    return <Screen withTabBar title={copy.health.title} />;
  }

  return (
    <Screen
      withTabBar
      title={copy.health.title}
      subtitle={`${copy.health.netWorth} · ${ledgerLabel}`}
      right={
        <Pressable
          onPress={() => router.replace('/(tabs)/inicio')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <HeroNetWorthBanner
        compact
        label={copy.health.netWorth}
        amount={patrimonio}
        formula={copy.health.netWorthHint}
        hidden={hidden}
        onToggleHidden={() => {
          setHidden((prev) => {
            const next = !prev;
            void setHideBalances(next);
            return next;
          });
        }}
        toggleA11yLabel={copy.home.toggleBalances}
        stats={[
          { label: copy.accounts.liquidity, amount: liquidez, tone: 'positive' },
          { label: copy.health.assets, amount: bienes, tone: 'positive', prefix: '+' },
          { label: copy.health.debts, amount: deudas, tone: 'negative', prefix: '−' },
        ]}
        currency={moneyCurrency}
      />

      <Card style={styles.health}>
        <View style={uiStyles.between}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{copy.health.debtWeight}</Text>
          <Text style={[styles.score, { color: healthColor }]}>{Math.round(creditUsage * 100)}%</Text>
        </View>
        <ProgressBar value={creditUsage} color={healthColor} label={copy.health.debtWeight} />
        <View style={uiStyles.between}>
          <Text style={[styles.small, { color: theme.muted, flex: 1 }]}>{healthCopy}</Text>
          {deudas > 0 ? (
            <Pill tone={healthTone === 'green' ? 'green' : 'orange'}>{money(deudas, true)}</Pill>
          ) : null}
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={[styles.subsection, { color: theme.muted }]}>{copy.health.sectionAssets}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar activo"
          onPress={() => router.push({ pathname: '/add-account', params: { mode: 'asset' } })}
          style={[styles.addBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <AppIcon name="plus" color={theme.primary} size={16} />
        </Pressable>
      </View>
      {wealthAssets.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            {copy.health.emptyAssets}
          </Text>
        </Card>
      ) : (
        wealthAssets.map((account) => <AccountRow key={account.id} account={account} />)
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.subsection, { color: theme.muted }]}>{copy.health.sectionDebts}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar deuda"
          onPress={() => router.push({ pathname: '/add-account', params: { mode: 'debt' } })}
          style={[styles.addBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <AppIcon name="plus" color={theme.primary} size={16} />
        </Pressable>
      </View>
      {wealthDebts.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            {copy.health.noDebts}
          </Text>
        </Card>
      ) : (
        wealthDebts.map((account) => <AccountRow key={account.id} account={account} />)
      )}

      <Text style={[styles.subsection, { color: theme.muted, marginTop: 8 }]}>
        {copy.health.sectionPlanning}
      </Text>
      <Text style={[styles.planCopy, { color: theme.muted }]}>
        {copy.health.planningBlurb}
      </Text>

      <Card style={styles.recurringSummary}>
        <View style={styles.recurringSummaryRow}>
          <View style={styles.recurringSummaryCell}>
            <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
              {copy.envelopes.income} ({moneyCurrency})
            </Text>
            <Text
              style={[styles.recurringSummaryValue, { color: theme.success }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}>
              {moneyAmount(recurring.incomeTotal)}
            </Text>
            <Text style={[styles.tiny, { color: theme.muted }]}>
              {copy.health.incomeHint(recurring.income.length)}
            </Text>
          </View>
          <View style={[styles.recurringSummaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.recurringSummaryCell}>
            <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
              {copy.envelopes.expenses} ({moneyCurrency})
            </Text>
            <Text
              style={[styles.recurringSummaryValue, { color: theme.danger }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}>
              {moneyAmount(recurring.expenseTotal)}
            </Text>
            <Text style={[styles.tiny, { color: theme.muted }]}>
              {copy.health.expensesHint(expenseLines.length)}
            </Text>
          </View>
          <View style={[styles.recurringSummaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.recurringSummaryCell}>
            <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
              {copy.health.result} ({moneyCurrency})
            </Text>
            <Text
              style={[
                styles.recurringSummaryValue,
                { color: recurring.net >= 0 ? theme.success : theme.danger },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}>
              {moneyAmount(recurring.net)}
            </Text>
            <Text style={[styles.tiny, { color: theme.muted }]}>
              {copy.health.incomeMinusExpenses}
            </Text>
          </View>
        </View>
        <View style={styles.bucketPills}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Agregar factura"
            onPress={() => openPlanningAdd('expense', 'bill')}>
            <Pill tone="neutral">{copy.health.bills} {recurring.bills.length}</Pill>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Agregar suscripción"
            onPress={() => openPlanningAdd('expense', 'subscription')}>
            <Pill tone="neutral">{copy.health.subscriptions} {recurring.subscriptions.length}</Pill>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Agregar gasto recurrente"
            onPress={() => openPlanningAdd('expense', 'recurring')}>
            <Pill tone="neutral">{copy.health.recurring} {recurring.recurrings.length}</Pill>
          </Pressable>
        </View>
      </Card>

      <RecurringGroup
        title={copy.health.recurringIncome}
        total={recurring.incomeTotal}
        items={recurring.income}
        empty={copy.health.emptyRecurringIncome}
        tapToAdd={copy.health.tapToAdd}
        tone="income"
        onAdd={() => openPlanningAdd('income')}
      />
      <RecurringGroup
        title={copy.health.recurringExpenses}
        total={recurring.expenseTotal}
        items={expenseLines}
        empty={copy.health.emptyRecurringExpense}
        tapToAdd={copy.health.tapToAdd}
        tone="expense"
        onAdd={() => openPlanningAdd('expense')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 17 },
  planCopy: { fontSize: 12, lineHeight: 18, marginTop: -2, marginBottom: 2 },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  accountName: { fontSize: 15, fontWeight: '600' },
  balanceCopy: { alignItems: 'flex-end', gap: 3 },
  balance: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sync: { fontSize: 10 },
  health: { gap: 13 },
  score: { fontSize: 18, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: -2,
  },
  subsection: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringSummary: { gap: 14 },
  recurringSummaryRow: { flexDirection: 'row', alignItems: 'stretch' },
  recurringSummaryCell: { flex: 1, minWidth: 0, gap: 4 },
  recurringSummaryDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 10 },
  recurringSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    width: '100%',
  },
  tiny: { fontSize: 10, lineHeight: 14 },
  bucketPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recurringGroup: { gap: 0, overflow: 'hidden', paddingTop: 12, paddingBottom: 4 },
  recurringGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8, marginBottom: 6 },
  recurringGroupTitle: { fontSize: 15, fontWeight: '700' },
  recurringGroupTotal: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 6 },
  addHint: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  recurringRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  recurringIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
