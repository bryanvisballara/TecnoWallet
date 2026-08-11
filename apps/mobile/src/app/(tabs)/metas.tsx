import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeroGoalsBanner } from '@/components/hero-goals-banner';
import { AppIcon, Card, Pill, ScalePressable, Screen, useAppTheme } from '@/components/ui';
import { formatDayLabel, parseDateKey } from '@/data/calendar';
import { money } from '@/data/demo';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { goalPeriodLabels, useGoalsStore, type GoalPeriod, type UserGoal } from '@/store/goals';
import { useActiveLedger } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';

const periodOrder: GoalPeriod[] = ['week', 'month', 'year', 'date'];

function goalDeadlineLabel(goal: UserGoal, locale: string) {
  if (goal.period === 'date' && goal.targetDate) {
    return formatDayLabel(parseDateKey(goal.targetDate), locale);
  }
  return goalPeriodLabels[goal.period];
}

function GoalCard({ goal }: { goal: UserGoal }) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const toggleCompleted = useGoalsStore((state) => state.toggleCompleted);
  const activeColor = goal.completed ? theme.success : goal.color;
  const surface = goal.completed ? theme.successSoft : theme.surface;

  return (
    <Card
      style={[
        styles.goalCard,
        {
          backgroundColor: surface,
          borderColor: goal.completed ? theme.success : theme.border,
        },
      ]}>
      <View style={styles.goalTop}>
        <View style={[styles.goalIcon, { backgroundColor: `${activeColor}22` }]}>
          <AppIcon
            name={goal.completed ? 'checkmark' : 'target'}
            color={activeColor}
            size={20}
          />
        </View>
        <View style={styles.copy}>
          <Text
            style={[
              styles.goalTitle,
              {
                color: goal.completed ? theme.success : theme.text,
                textDecorationLine: goal.completed ? 'line-through' : 'none',
              },
            ]}>
            {goal.title}
          </Text>
          <Text style={[styles.goalMeta, { color: theme.muted }]}>
            {goalDeadlineLabel(goal, locale)}
            {goal.targetAmount ? ` · ${money(goal.targetAmount, true)}` : ''}
            {goal.envelopeId ? ' · Con sobre' : ''}
          </Text>
        </View>
        <Pill tone={goal.completed ? 'green' : 'neutral'}>
          {goal.completed ? copy.goals.completed : copy.goals.active}
        </Pill>
      </View>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={
          goal.completed
            ? `${copy.goals.markPending}: ${goal.title}`
            : `${copy.goals.markCompleted}: ${goal.title}`
        }
        onPress={() => void toggleCompleted(goal.id)}
        style={[
          styles.completeBtn,
          {
            backgroundColor: goal.completed ? '#FFFFFF' : `${activeColor}18`,
            borderColor: activeColor,
          },
        ]}>
        <AppIcon
          name={goal.completed ? 'arrow.left.arrow.right' : 'checkmark'}
          color={activeColor}
          size={16}
        />
        <Text style={{ color: activeColor, fontWeight: '700', fontSize: 13 }}>
          {goal.completed ? copy.goals.markPending : copy.goals.markCompleted}
        </Text>
      </ScalePressable>
    </Card>
  );
}

export default function MetasScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { ledger } = useActiveLedger();
  const goals = useGoalsStore((state) => state.goals);

  const grouped = useMemo(() => {
    return periodOrder.map((period) => ({
      period,
      label: goalPeriodLabels[period],
      items: goals.filter((item) => item.period === period),
    }));
  }, [goals]);

  const completedCount = goals.filter((item) => item.completed).length;
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';

  if (!ledger) {
    return <Screen withTabBar title={copy.goals.title} />;
  }

  return (
    <Screen
      withTabBar
      title={copy.goals.title}
      subtitle={copy.goals.book(ledgerLabel)}
      right={
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.replace('/(tabs)/inicio')}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Nueva meta"
            onPress={() => router.push('/add-goal')}
            style={[styles.back, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="plus" color={theme.primary} />
          </Pressable>
        </View>
      }>
      <HeroGoalsBanner
        label={copy.goals.yourGoals}
        title={
          goals.length === 0
            ? copy.goals.none
            : `${goals.length} meta${goals.length === 1 ? '' : 's'}`
        }
        hint={
          completedCount > 0
            ? `${completedCount} completada${completedCount === 1 ? '' : 's'}`
            : 'Metas con opcional sobre de ahorros'
        }
      />

      {goals.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={[styles.empty, { color: theme.muted }]}>
            {copy.goals.empty}
          </Text>
          <ScalePressable
            onPress={() => router.push('/add-goal')}
            style={[styles.createCta, { backgroundColor: theme.primary }]}>
            <View style={styles.createCtaIcon}>
              <AppIcon name="plus" color={theme.primary} size={14} />
            </View>
            <Text style={styles.createCtaText}>{copy.goals.create}</Text>
          </ScalePressable>
        </Card>
      ) : (
        grouped.map((group) =>
          group.items.length === 0 ? null : (
            <View key={group.period} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.muted }]}>
                {group.label.toUpperCase()}
              </Text>
              {group.items.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </View>
          ),
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { gap: 16, paddingVertical: 22 },
  empty: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  createCta: {
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  createCtaIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  section: { gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  goalCard: { gap: 12 },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  goalTitle: { fontSize: 15, fontWeight: '700' },
  goalMeta: { fontSize: 12 },
  completeBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
