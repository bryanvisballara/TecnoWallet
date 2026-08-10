import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, Pill, ScalePressable, Screen, useAppTheme } from '@/components/ui';
import { formatDayLabel, parseDateKey } from '@/data/calendar';
import { money } from '@/data/demo';
import { goalPeriodLabels, useGoalsStore, type GoalPeriod, type UserGoal } from '@/store/goals';
import { useActiveLedger } from '@/store/ledger';

const periodOrder: GoalPeriod[] = ['week', 'month', 'year', 'date'];

function goalDeadlineLabel(goal: UserGoal) {
  if (goal.period === 'date' && goal.targetDate) {
    return formatDayLabel(parseDateKey(goal.targetDate));
  }
  return goalPeriodLabels[goal.period];
}

function GoalCard({ goal }: { goal: UserGoal }) {
  const theme = useAppTheme();
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
            {goalDeadlineLabel(goal)}
            {goal.targetAmount ? ` · ${money(goal.targetAmount, true)}` : ''}
            {goal.envelopeId ? ' · Con sobre' : ''}
          </Text>
        </View>
        <Pill tone={goal.completed ? 'green' : 'neutral'}>
          {goal.completed ? 'Completada' : 'Activa'}
        </Pill>
      </View>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={
          goal.completed ? `Marcar ${goal.title} como pendiente` : `Completar ${goal.title}`
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
          {goal.completed ? 'Marcar pendiente' : 'Marcar completada'}
        </Text>
      </ScalePressable>
    </Card>
  );
}

export default function MetasScreen() {
  const theme = useAppTheme();
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

  if (!ledger) {
    return <Screen withTabBar title="Metas/Ahorros" />;
  }

  return (
    <Screen
      withTabBar
      title="Metas/Ahorros"
      subtitle={`Libro ${ledger.name}`}
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
      <Card style={[styles.hero, { backgroundColor: '#F79009' }]}>
        <Text style={styles.heroLabel}>Tus objetivos</Text>
        <Text style={styles.heroValue}>
          {goals.length === 0 ? 'Sin metas' : `${goals.length} meta${goals.length === 1 ? '' : 's'}`}
        </Text>
        <Text style={styles.heroHint}>
          {completedCount > 0
            ? `${completedCount} completada${completedCount === 1 ? '' : 's'}`
            : 'Metas con opcional sobre de ahorros'}
        </Text>
      </Card>

      {goals.length === 0 ? (
        <Card>
          <Text style={[styles.empty, { color: theme.muted }]}>
            Aún no hay metas. Usa + para crear la primera y, si quieres, su sobre de ahorros.
          </Text>
          <ScalePressable
            onPress={() => router.push('/add-goal')}
            style={[styles.createCta, { backgroundColor: theme.primary }]}>
            <Text style={styles.createCtaText}>Crear meta</Text>
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
  hero: { borderWidth: 0, gap: 6 },
  heroLabel: { color: '#FFF4E5', fontSize: 13 },
  heroValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', letterSpacing: -0.8 },
  heroHint: { color: '#FFF4E5', fontSize: 13 },
  empty: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  createCta: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
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
