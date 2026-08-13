import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppIcon, Card, Pill, ProgressBar, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money, type Envelope } from '@/data/demo';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { filterTransactionsByMonth } from '@/lib/dates';
import { useActiveLedger } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { usePeriodStore } from '@/store/period';

export default function EnvelopesScreen() {
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { envelopes, ledger, transactions } = useActiveLedger();
  const year = usePeriodStore((state) => state.year);
  const month = usePeriodStore((state) => state.month);
  const period = useMemo(() => ({ year, month }), [year, month]);
  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, period),
    [transactions, period],
  );
  const spentByEnvelope = useMemo(() => {
    const map = new Map<string, number>();
    monthTransactions.forEach((tx) => {
      const key = (tx.envelopeId || tx.category).trim().toLowerCase();
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount));
    });
    return map;
  }, [monthTransactions]);

  const withMonthSpent = (items: Envelope[]) =>
    items.map((item) => ({
      ...item,
      spent:
        spentByEnvelope.get(item.id.toLowerCase()) ??
        spentByEnvelope.get(item.name.trim().toLowerCase()) ??
        0,
    }));

  const incomeEnvelopes = withMonthSpent(envelopes.filter((item) => item.kind === 'income'));
  const expenseEnvelopes = withMonthSpent(envelopes.filter((item) => item.kind === 'expense'));
  const savingsEnvelopes = withMonthSpent(envelopes.filter((item) => item.kind === 'savings'));
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';

  if (!ledger) {
    return <Screen withTabBar title={copy.envelopes.title} />;
  }

  return (
    <Screen withTabBar title={copy.envelopes.title} subtitle={copy.envelopes.budgetMonth(ledgerLabel)}>
      <MonthSwitcher />

      <EnvelopeSection
        title={copy.envelopes.incomeEnvelopes}
        subtitle={`${incomeEnvelopes.length} activos`}
        badge={copy.envelopes.badgeIn}
        badgeTone="green"
        items={incomeEnvelopes}
        mode="income"
      />

      <EnvelopeSection
        title={copy.envelopes.expenseEnvelopes}
        subtitle={`${expenseEnvelopes.length} activos`}
        badge={copy.envelopes.badgeOut}
        badgeTone="orange"
        items={expenseEnvelopes}
        mode="expense"
      />

      <EnvelopeSection
        title={copy.envelopes.savingsEnvelopes}
        subtitle={
          savingsEnvelopes.length
            ? `${savingsEnvelopes.length} vinculados a metas`
            : copy.envelopes.createFromGoals
        }
        badge={copy.envelopes.badgeSave}
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
  const copy = useAppCopy();
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
              {copy.envelopes.emptySavings}
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
              ? copy.envelopes.received
              : mode === 'savings'
                ? copy.envelopes.saved
                : hasBudget
                  ? copy.envelopes.available
                  : copy.envelopes.spent;
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
                        ? `${percent}% ${copy.envelopes.received}`
                        : mode === 'savings'
                          ? `${percent}% ${copy.envelopes.saved}`
                          : `${percent}% usado`
                      : copy.envelopes.noMonthlyLimit}
                  </Text>
                  {warning ? (
                    <Pill tone="orange">{copy.envelopes.almostEmpty}</Pill>
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
