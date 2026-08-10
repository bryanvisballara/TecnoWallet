import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, Pill, ProgressBar, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money, type Envelope } from '@/data/demo';
import { filterTransactionsByMonth } from '@/lib/dates';
import { localStorage } from '@/services/persistence';
import { useActiveLedger } from '@/store/ledger';
import { usePeriodStore } from '@/store/period';

export default function EnvelopesScreen() {
  const theme = useAppTheme();
  const { envelopes, ledger, transactions } = useActiveLedger();
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const monthLabel = usePeriodStore((state) => state.label);
  const [hideNoBudgetBanner, setHideNoBudgetBanner] = useState(false);
  const period = useMemo(() => ({ year, month }), [year, month]);
  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, period),
    [transactions, period],
  );
  const spentByEnvelope = useMemo(() => {
    const map = new Map<string, number>();
    monthTransactions.forEach((tx) => {
      const key = tx.category.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount));
    });
    return map;
  }, [monthTransactions]);

  const withMonthSpent = (items: Envelope[]) =>
    items.map((item) => ({
      ...item,
      spent: spentByEnvelope.get(item.name.trim().toLowerCase()) ?? 0,
    }));

  const incomeEnvelopes = withMonthSpent(envelopes.filter((item) => item.kind === 'income'));
  const expenseEnvelopes = withMonthSpent(envelopes.filter((item) => item.kind === 'expense'));
  const savingsEnvelopes = withMonthSpent(envelopes.filter((item) => item.kind === 'savings'));

  const incomeExpected = incomeEnvelopes.reduce((sum, item) => sum + item.budget, 0);
  const incomeReceived = incomeEnvelopes.reduce((sum, item) => sum + item.spent, 0);
  const expenseBudget = expenseEnvelopes.reduce((sum, item) => sum + item.budget, 0);
  const expenseSpent = expenseEnvelopes.reduce((sum, item) => sum + item.spent, 0);
  const available = Math.max(expenseBudget - expenseSpent, 0);
  const usedRatio = expenseBudget > 0 ? expenseSpent / expenseBudget : 0;
  const showNoBudgetBanner = expenseBudget <= 0 && !hideNoBudgetBanner;

  useEffect(() => {
    if (!ledger?.id) return;
    let active = true;
    void localStorage
      .get(`sobres-no-budget-banner:${ledger.id}`, false)
      .then((hidden) => {
        if (active) setHideNoBudgetBanner(Boolean(hidden));
      });
    return () => {
      active = false;
    };
  }, [ledger?.id]);

  const dismissNoBudgetBanner = () => {
    if (!ledger?.id) return;
    setHideNoBudgetBanner(true);
    void localStorage.set(`sobres-no-budget-banner:${ledger.id}`, true);
  };

  if (!ledger) {
    return <Screen withTabBar title="Sobres" />;
  }

  return (
    <Screen withTabBar title="Sobres" subtitle={`Presupuesto · ${ledger.name}`}>
      <MonthSwitcher />
      <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
        <View style={uiStyles.between}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>
              {expenseBudget > 0 ? `Disponible · ${monthLabel}` : `Gastos · ${monthLabel}`}
            </Text>
            <Text style={styles.heroValue}>
              {money(expenseBudget > 0 ? available : expenseSpent)}
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <AppIcon name="wallet.pass.fill" color="#FFFFFF" size={28} />
          </View>
        </View>
        {expenseBudget > 0 ? (
          <>
            <View style={styles.heroProgress}>
              <View style={[styles.heroFill, { width: `${Math.min(usedRatio, 1) * 100}%` }]} />
            </View>
            <View style={uiStyles.between}>
              <Text style={styles.heroSmall}>{money(expenseSpent)} en gastos</Text>
              <Text style={styles.heroSmall}>{money(expenseBudget)} asignados</Text>
            </View>
          </>
        ) : showNoBudgetBanner ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sin presupuesto mensual. Ocultar este aviso"
            onPress={dismissNoBudgetBanner}
            style={({ pressed }) => [
              styles.noBudgetButton,
              { backgroundColor: pressed ? '#FFFFFF30' : '#FFFFFF20' },
            ]}>
            <View style={styles.noBudgetCopy}>
              <AppIcon name="circle" color="#FFFFFF" size={12} />
              <Text style={styles.noBudgetLabel}>Sin presupuesto mensual</Text>
            </View>
            <Text style={styles.noBudgetAction}>Ocultar</Text>
          </Pressable>
        ) : null}
      </Card>

      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { backgroundColor: theme.successSoft, borderWidth: 0 }]}>
          <View style={[styles.summaryIcon, { backgroundColor: '#FFFFFF' }]}>
            <AppIcon name="arrow.down.circle.fill" color={theme.success} />
          </View>
          <Text style={[styles.summaryLabel, { color: theme.muted }]}>Ingresos</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{money(incomeReceived, true)}</Text>
          <Text style={[styles.summaryHint, { color: theme.muted }]}>
            {incomeExpected > 0 ? `de ${money(incomeExpected, true)} esperados` : 'Sin meta de ingresos'}
          </Text>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: '#FDECEC', borderWidth: 0 }]}>
          <View style={[styles.summaryIcon, { backgroundColor: '#FFFFFF' }]}>
            <AppIcon name="arrow.up.circle.fill" color={theme.danger} />
          </View>
          <Text style={[styles.summaryLabel, { color: theme.muted }]}>Gastos</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{money(expenseSpent, true)}</Text>
          <Text style={[styles.summaryHint, { color: theme.muted }]}>
            {expenseBudget > 0 ? `de ${money(expenseBudget, true)} asignados` : 'Sin presupuesto'}
          </Text>
        </Card>
      </View>

      {expenseBudget > 0 ? (
        <Card style={[styles.tip, { backgroundColor: theme.successSoft }]}>
          <View style={[styles.tipIcon, { backgroundColor: '#FFFFFF' }]}>
            <AppIcon name="sparkles" color={theme.success} size={18} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.tipTitle, { color: theme.text }]}>Resumen del mes</Text>
            <Text style={[styles.small, { color: theme.muted }]}>
              Llevas {money(expenseSpent)} gastados de {money(expenseBudget)} asignados.
            </Text>
          </View>
          <Pill tone="green">{Math.round((1 - usedRatio) * 100)}%</Pill>
        </Card>
      ) : expenseEnvelopes.length > 0 || incomeEnvelopes.length > 0 ? (
        <Card style={[styles.tip, { backgroundColor: theme.surfaceSecondary }]}>
          <View style={[styles.tipIcon, { backgroundColor: '#FFFFFF' }]}>
            <AppIcon name="wallet.pass.fill" color={theme.primary} size={18} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.tipTitle, { color: theme.text }]}>Control sin límite mensual</Text>
            <Text style={[styles.small, { color: theme.muted }]}>
              Llevas {money(expenseSpent)} en gastos registrados sin un presupuesto asignado.
            </Text>
          </View>
          <Pill tone="neutral">Sin límite</Pill>
        </Card>
      ) : null}

      <EnvelopeSection
        title="Sobres de ingresos"
        subtitle={`${incomeEnvelopes.length} activos`}
        badge="Entradas"
        badgeTone="green"
        items={incomeEnvelopes}
        mode="income"
      />

      <EnvelopeSection
        title="Sobres de gastos"
        subtitle={`${expenseEnvelopes.length} activos`}
        badge="Salidas"
        badgeTone="orange"
        items={expenseEnvelopes}
        mode="expense"
      />

      <EnvelopeSection
        title="Sobres de ahorros"
        subtitle={
          savingsEnvelopes.length
            ? `${savingsEnvelopes.length} vinculados a metas`
            : 'Créalos desde Metas/Ahorros'
        }
        badge="Ahorro"
        badgeTone="blue"
        items={savingsEnvelopes}
        mode="savings"
        allowCreate={false}
      />
    </Screen>
  );
}

function EnvelopeSection({
  title,
  subtitle,
  badge,
  badgeTone,
  items,
  mode,
  allowCreate = true,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: 'green' | 'orange' | 'blue';
  items: Envelope[];
  mode: 'income' | 'expense' | 'savings';
  allowCreate?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={[uiStyles.row, uiStyles.gap8, styles.sectionTitleWrap]}>
          <Text style={[styles.section, { color: theme.text }]}>{title}</Text>
          <Pill tone={badgeTone}>{badge}</Pill>
          {allowCreate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'income' ? 'Agregar sobre de ingresos' : 'Agregar sobre de gastos'
              }
              onPress={() => router.push({ pathname: '/add-envelope', params: { kind: mode } })}
              style={[styles.addBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
              <AppIcon name="plus" color={theme.primary} size={16} />
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.small, { color: theme.muted }]}>{subtitle}</Text>
      </View>

      <View style={styles.list}>
        {items.length === 0 && mode === 'savings' ? (
          <Card>
            <Text style={[styles.small, { color: theme.muted, textAlign: 'center', lineHeight: 18 }]}>
              Los sobres de ahorros solo se crean al armar una meta en Finanzas → Metas/Ahorros.
            </Text>
          </Card>
        ) : null}
        {items.map((envelope, index) => {
          const hasBudget = envelope.budget > 0;
          const remaining = envelope.budget - envelope.spent;
          const ratio = hasBudget ? envelope.spent / envelope.budget : 0;
          const percent = Math.round(ratio * 100);
          const warning = hasBudget && mode === 'expense' && ratio > 0.85;
          const barColor = warning ? theme.warning : envelope.color;
          const amountLabel =
            mode === 'income'
              ? 'recibido'
              : mode === 'savings'
                ? 'ahorrado'
                : hasBudget
                  ? 'disponible'
                  : 'gastado';
          const amountValue =
            mode === 'income' || mode === 'savings' || !hasBudget ? envelope.spent : remaining;
          const progressLabel =
            mode === 'income'
              ? `${envelope.name}: ${percent} por ciento recibido`
              : mode === 'savings'
                ? `${envelope.name}: ${percent} por ciento ahorrado`
                : `${envelope.name}: ${percent} por ciento usado`;

          return (
            <ScalePressable
              key={envelope.id}
              accessibilityRole="button"
              accessibilityLabel={`${envelope.name}, ${money(amountValue)} ${amountLabel}`}
              onPress={() => router.push({ pathname: '/(tabs)/envelope/[id]', params: { id: envelope.id } })}>
              <Card style={styles.envelopeCard} delay={index * 35}>
                <View style={styles.envelopeTop}>
                  <View style={[styles.envelopeIcon, { backgroundColor: `${envelope.color}1A` }]}>
                    <AppIcon name={envelope.icon} color={envelope.color} size={22} />
                  </View>

                  <View style={styles.envelopeMeta}>
                    <View style={styles.nameRow}>
                      <Text numberOfLines={1} style={[styles.envelopeName, { color: theme.text }]}>
                        {envelope.name}
                      </Text>
                      {hasBudget && envelope.rollover ? (
                        <AppIcon name="repeat" color={theme.muted} size={14} />
                      ) : null}
                    </View>
                    <Text style={[styles.small, { color: theme.muted }]}>
                      {hasBudget
                        ? mode === 'income'
                          ? `${money(envelope.spent)} de ${money(envelope.budget)} esperados`
                          : mode === 'savings'
                            ? `${money(envelope.spent)} de ${money(envelope.budget)} meta`
                            : `${money(envelope.spent)} de ${money(envelope.budget)}`
                        : `${money(envelope.spent)} registrados · Sin presupuesto`}
                    </Text>
                  </View>

                  <View style={styles.envelopeAmount}>
                    <Text style={[styles.remaining, { color: warning ? theme.warning : theme.text }]}>
                      {money(amountValue, true)}
                    </Text>
                    <Text style={[styles.amountHint, { color: theme.muted }]}>{amountLabel}</Text>
                  </View>
                </View>

                {hasBudget ? (
                  <ProgressBar value={ratio} color={barColor} label={progressLabel} />
                ) : null}

                <View style={uiStyles.between}>
                  <Text style={[styles.used, { color: warning ? theme.warning : theme.muted }]}>
                    {hasBudget
                      ? mode === 'income'
                        ? `${percent}% recibido`
                        : mode === 'savings'
                          ? `${percent}% ahorrado`
                          : `${percent}% usado`
                      : 'Sin límite mensual'}
                  </Text>
                  {warning ? (
                    <Pill tone="orange">Casi agotado</Pill>
                  ) : (
                    <Text style={[styles.rule, { color: theme.muted }]} numberOfLines={1}>
                      {envelope.rule}
                    </Text>
                  )}
                </View>
              </Card>
            </ScalePressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 14, borderWidth: 0 },
  heroCopy: { flex: 1, paddingRight: 12 },
  heroLabel: { color: '#DCEBFF', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginTop: 3, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF24',
  },
  heroProgress: { height: 8, backgroundColor: '#FFFFFF30', borderRadius: 4, overflow: 'hidden' },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  heroSmall: { color: '#DCEBFF', fontSize: 12 },
  noBudgetButton: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  noBudgetCopy: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  noBudgetLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  noBudgetAction: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, gap: 6, padding: 14 },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: { fontSize: 12, fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryHint: { fontSize: 11 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0 },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  tipTitle: { fontSize: 14, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 17 },
  sectionBlock: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitleWrap: { flexShrink: 1, flexWrap: 'wrap' },
  section: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 10 },
  envelopeCard: { gap: 12, paddingVertical: 16 },
  envelopeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  envelopeIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelopeMeta: { flex: 1, gap: 3, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  envelopeName: { flexShrink: 1, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  envelopeAmount: { alignItems: 'flex-end', gap: 2 },
  remaining: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  amountHint: { fontSize: 11, fontWeight: '500' },
  used: { fontSize: 12, fontWeight: '600' },
  rule: { flex: 1, textAlign: 'right', fontSize: 11, marginLeft: 12 },
});
