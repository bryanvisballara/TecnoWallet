import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, ProgressBar, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useActiveLedger } from '@/store/ledger';

const contributions = [
  { id: '1', title: 'Ahorro automático', date: '1 ago', amount: 350 },
  { id: '2', title: 'Traspaso manual', date: 'Hoy', amount: 120 },
  { id: '3', title: 'Sobrante semanal', date: 'Ayer', amount: 85 },
];

export default function GoalDetailScreen() {
  const theme = useAppTheme();
  const { summary, ledger } = useActiveLedger();
  const { id = 'agosto' } = useLocalSearchParams<{ id: string }>();
  const goals = [
    {
      id: 'agosto',
      title: 'Ahorrar en agosto',
      target: summary.goal,
      current: summary.goalCurrent,
      deadline: '31 ago 2026',
      icon: 'leaf.fill',
      color: '#12B76A',
      note: `Meta mensual del libro ${ledger.name}.`,
    },
    {
      id: 'emergencia',
      title: 'Fondo de emergencia',
      target: 10000,
      current: 7400,
      deadline: 'dic 2026',
      icon: 'shield.fill',
      color: '#0878F9',
      note: '6 meses de gastos esenciales.',
    },
    {
      id: 'japon',
      title: 'Viaje a Japón',
      target: 6000,
      current: 2760,
      deadline: 'abr 2027',
      icon: 'airplane',
      color: '#7F56D9',
      note: 'Vuelos y alojamiento.',
    },
  ];
  const goal = goals.find((item) => item.id === id) ?? goals[0];
  const ratio = goal.target > 0 ? goal.current / goal.target : 0;
  const percent = Math.round(ratio * 100);
  const remaining = Math.max(0, goal.target - goal.current);

  return (
    <Screen
      title={goal.title}
      subtitle={`Meta · ${goal.deadline}`}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => safeGoBack('/(tabs)/metas')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={[styles.hero, { backgroundColor: goal.color }]}>
        <View style={uiStyles.between}>
          <View style={styles.heroIcon}>
            <AppIcon name={goal.icon} color="#FFFFFF" size={26} />
          </View>
          <Pill tone="green">{percent}%</Pill>
        </View>
        <Text style={styles.heroLabel}>Progreso actual</Text>
        <Text style={styles.heroValue}>{money(goal.current)}</Text>
        <Text style={styles.heroHint}>de {money(goal.target)} · faltan {money(remaining)}</Text>
        <View style={styles.heroTrack}>
          <View style={[styles.heroFill, { width: `${Math.min(percent, 100)}%` }]} />
        </View>
      </Card>

      <Card>
        <Text style={[styles.section, { color: theme.text }]}>Resumen</Text>
        <Text style={[styles.body, { color: theme.muted }]}>{goal.note}</Text>
        <View style={styles.stats}>
          <View style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Aportado</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{money(goal.current, true)}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Objetivo</Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{money(goal.target, true)}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.successSoft }]}>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Restante</Text>
            <Text style={[styles.statValue, { color: theme.success }]}>{money(remaining, true)}</Text>
          </View>
        </View>
        <ProgressBar value={ratio} color={goal.color} label={`Progreso ${percent}%`} />
      </Card>

      <Text style={[styles.section, { color: theme.text }]}>Aportes recientes</Text>
      <Card style={styles.listCard}>
        {contributions.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            ]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.successSoft }]}>
              <AppIcon name="arrow.down.circle.fill" color={theme.success} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>{item.date}</Text>
            </View>
            <Text style={[styles.rowAmount, { color: theme.success }]}>+{money(item.amount)}</Text>
          </View>
        ))}
      </Card>

      <Text style={[styles.section, { color: theme.text }]}>Otras metas</Text>
      {goals.filter((item) => item.id !== goal.id).map((item) => {
        const itemRatio = item.current / item.target;
        return (
          <ScalePressable
            key={item.id}
            onPress={() => router.replace({ pathname: '/(tabs)/goal/[id]', params: { id: item.id } })}>
            <Card style={styles.otherCard}>
              <View style={uiStyles.between}>
                <View style={[uiStyles.row, uiStyles.gap8]}>
                  <View style={[styles.otherIcon, { backgroundColor: `${item.color}1A` }]}>
                    <AppIcon name={item.icon} color={item.color} size={18} />
                  </View>
                  <View>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.rowMeta, { color: theme.muted }]}>{item.deadline}</Text>
                  </View>
                </View>
                <Text style={[styles.otherPercent, { color: item.color }]}>{Math.round(itemRatio * 100)}%</Text>
              </View>
              <ProgressBar value={itemRatio} color={item.color} />
            </Card>
          </ScalePressable>
        );
      })}

      <PrimaryButton icon="plus" onPress={() => router.push('/add-transaction')}>
        Aportar a esta meta
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 10 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroHint: { color: '#FFFFFFCC', fontSize: 13 },
  heroTrack: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF30', overflow: 'hidden', marginTop: 4 },
  heroFill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  section: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  body: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  listCard: { paddingVertical: 4 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowMeta: { fontSize: 11 },
  rowAmount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  otherCard: { gap: 10 },
  otherIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  otherPercent: { fontSize: 16, fontWeight: '700' },
});
