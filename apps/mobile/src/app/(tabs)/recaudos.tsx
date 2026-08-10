import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppIcon,
  Card,
  Pill,
  ProgressBar,
  ScalePressable,
  Screen,
  useAppTheme,
} from '@/components/ui';
import { isZeroDecimalCurrency } from '@/lib/currencies';
import {
  useRecaudosStore,
  type Recaudo,
  type RecaudoCategory,
  type RecaudoParticipant,
} from '@/store/recaudos';

const categoryInfo: Record<RecaudoCategory, { label: string; icon: string; color: string }> = {
  travel: { label: 'Viaje', icon: 'airplane', color: '#0878F9' },
  gift: { label: 'Regalo', icon: 'gift.fill', color: '#EE46BC' },
  event: { label: 'Evento', icon: 'ticket.fill', color: '#7F56D9' },
  purchase: { label: 'Compra', icon: 'cart.fill', color: '#F79009' },
  other: { label: 'Otro', icon: 'sparkles', color: '#0E9F6E' },
};

function formatMinor(value: number, currency: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: isZeroDecimalCurrency(currency) ? 0 : 2,
  }).format(value / 100);
}

function frequencyDays(frequency: RecaudoParticipant['frequency']) {
  if (frequency === 'daily') return 1;
  if (frequency === 'weekly') return 7;
  if (frequency === 'biweekly') return 14;
  return 30;
}

function nextContributionLabel(recaudo: Recaudo) {
  const enabled = recaudo.participants.filter(
    (participant) => participant.remindersEnabled && participant.monthlyCommitmentMinor > 0,
  );
  if (!enabled.length) return 'Sin próximo aporte';
  const participant = enabled.reduce((nearest, item) =>
    frequencyDays(item.frequency) < frequencyDays(nearest.frequency) ? item : nearest,
  );
  const next = new Date();
  next.setDate(next.getDate() + frequencyDays(participant.frequency));
  return `Próximo aporte · ${new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
  }).format(next)}`;
}

function RecaudoCard({ recaudo }: { recaudo: Recaudo }) {
  const theme = useAppTheme();
  const category = categoryInfo[recaudo.category];
  const ratio = recaudo.targetMinor > 0 ? recaudo.collectedMinor / recaudo.targetMinor : 0;
  const percent = Math.min(100, Math.round(ratio * 100));

  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir recaudo ${recaudo.title}`}
      onPress={() =>
        router.push({ pathname: '/(tabs)/recaudo/[id]', params: { id: recaudo.id } })
      }>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.categoryIcon, { backgroundColor: `${category.color}1F` }]}>
            <AppIcon name={category.icon} color={category.color} size={21} />
          </View>
          <View style={styles.cardCopy}>
            <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>
              {recaudo.title}
            </Text>
            <Text style={[styles.cardMeta, { color: theme.muted }]}>{category.label}</Text>
          </View>
          <Pill tone={recaudo.status === 'completed' ? 'green' : 'blue'}>
            {recaudo.status === 'completed' ? 'Completado' : `${percent}%`}
          </Pill>
        </View>

        <View style={styles.amounts}>
          <View>
            <Text style={[styles.amountLabel, { color: theme.muted }]}>Recaudado</Text>
            <Text style={[styles.amount, { color: theme.text }]}>
              {formatMinor(recaudo.collectedMinor, recaudo.currency)}
            </Text>
          </View>
          <View style={styles.target}>
            <Text style={[styles.amountLabel, { color: theme.muted }]}>Objetivo</Text>
            <Text style={[styles.targetAmount, { color: theme.muted }]}>
              {formatMinor(recaudo.targetMinor, recaudo.currency)}
            </Text>
          </View>
        </View>
        <ProgressBar
          value={ratio}
          color={category.color}
          label={`Progreso de ${recaudo.title}: ${percent}%`}
        />
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <AppIcon name="person.2.fill" color={theme.muted} size={15} />
            <Text style={[styles.footerText, { color: theme.muted }]}>
              {recaudo.participants.length}{' '}
              {recaudo.participants.length === 1 ? 'participante' : 'participantes'}
            </Text>
          </View>
          <Text style={[styles.footerText, { color: theme.muted }]}>
            {nextContributionLabel(recaudo)}
          </Text>
        </View>
      </Card>
    </ScalePressable>
  );
}

export default function RecaudosScreen() {
  const theme = useAppTheme();
  const recaudos = useRecaudosStore((state) => state.recaudos);
  const hydrated = useRecaudosStore((state) => state.hydrated);
  const loading = useRecaudosStore((state) => state.loading);
  const hydrate = useRecaudosStore((state) => state.hydrate);
  const refresh = useRecaudosStore((state) => state.refresh);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);

  const active = useMemo(
    () => recaudos.filter((item) => item.status !== 'closed'),
    [recaudos],
  );
  return (
    <Screen
      withTabBar
      title="Mis recaudos"
      subtitle={
        active.length
          ? `${active.length} ${active.length === 1 ? 'recaudo activo' : 'recaudos activos'}`
          : 'Organiza aportes con otras personas'
      }
      refreshing={loading}
      onRefresh={() => void refresh()}
      floating={
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="Crear recaudo"
          onPress={() => router.push('/add-recaudo')}
          style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.shadow }]}>
          <AppIcon name="plus" color="#FFFFFF" size={28} />
        </ScalePressable>
      }>
      {active.length > 0 ? (
        <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
          <Text style={styles.heroLabel}>Pozos compartidos</Text>
          <Text style={styles.heroValue}>
            {active.length} {active.length === 1 ? 'recaudo' : 'recaudos'}
          </Text>
          <Text style={styles.heroHint}>Sigue el progreso y los próximos aportes</Text>
        </Card>
      ) : null}

      {!hydrated ? (
        <Text style={[styles.empty, { color: theme.muted }]}>Cargando recaudos…</Text>
      ) : active.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="person.2.fill" color={theme.primary} size={28} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Crea tu primer recaudo</Text>
          <Text style={[styles.empty, { color: theme.muted }]}>
            Define un objetivo, invita participantes y lleven juntos el progreso.
          </Text>
        </Card>
      ) : (
        <View style={styles.list}>
          {active.map((recaudo) => (
            <RecaudoCard key={recaudo.id} recaudo={recaudo} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderWidth: 0, gap: 5 },
  heroLabel: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroHint: { color: '#FFFFFFCC', fontSize: 12 },
  list: { gap: 12 },
  card: { gap: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 12 },
  amounts: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  amountLabel: { fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  target: { alignItems: 'flex-end' },
  targetAmount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 11 },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 104,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  emptyCard: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
