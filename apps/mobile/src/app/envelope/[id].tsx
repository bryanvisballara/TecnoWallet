import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, ProgressBar, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useActiveLedger } from '@/store/ledger';

export default function EnvelopeDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { envelopes, transactions, ledger } = useActiveLedger();
  const envelope = envelopes.find((item) => item.id === id) ?? envelopes[0];
  const available = envelope.budget - envelope.spent;
  const ratio = envelope.spent / envelope.budget;

  return (
    <Screen title={envelope.name} subtitle={`${ledger.name} · Agosto 2026`} right={<Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}><AppIcon name="arrow.left" color={theme.text} /></Pressable>}>
      <Card style={[styles.hero, { backgroundColor: envelope.color }]}>
        <View style={uiStyles.between}><View style={styles.heroIcon}><AppIcon name={envelope.icon} color="#FFFFFF" size={28} /></View><Pill tone="neutral">{Math.round(ratio * 100)}% {envelope.kind === 'income' ? 'recibido' : 'usado'}</Pill></View>
        <Text style={styles.heroLabel}>{envelope.kind === 'income' ? 'Ingresos recibidos' : 'Saldo disponible'}</Text>
        <Text style={styles.heroValue}>{money(envelope.kind === 'income' ? envelope.spent : available)}</Text>
        <View style={styles.heroProgress}><View style={[styles.heroFill, { width: `${Math.min(100, ratio * 100)}%` }]} /></View>
        <View style={uiStyles.between}>
          <Text style={styles.heroSmall}>{money(envelope.spent)} {envelope.kind === 'income' ? 'recibidos' : 'gastados'}</Text>
          <Text style={styles.heroSmall}>{money(envelope.budget)} {envelope.kind === 'income' ? 'esperados' : 'asignados'}</Text>
        </View>
      </Card>
      <Card>
        <View style={styles.ruleRow}><View style={[styles.ruleIcon, { backgroundColor: theme.primarySoft }]}><AppIcon name="repeat" color={theme.primary} /></View><View style={styles.copy}><Text style={[styles.title, { color: theme.text }]}>Rollover mensual</Text><Text style={[styles.small, { color: theme.muted }]}>{envelope.rollover ? 'El saldo sobrante se acumula' : 'El saldo se reinicia'}</Text></View><Switch value={envelope.rollover} disabled /></View>
        <View style={[styles.ruleRow, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={[styles.ruleIcon, { backgroundColor: theme.successSoft }]}><AppIcon name="sparkles" color={theme.success} /></View><View style={styles.copy}><Text style={[styles.title, { color: theme.text }]}>Regla automática</Text><Text style={[styles.small, { color: theme.muted }]}>{envelope.rule}</Text></View></View>
        <View style={[styles.ruleRow, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={[styles.ruleIcon, { backgroundColor: envelope.kind === 'income' ? theme.successSoft : '#FDECEC' }]}>
            <AppIcon name={envelope.kind === 'income' ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill'} color={envelope.kind === 'income' ? theme.success : theme.danger} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.text }]}>Tipo de sobre</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{envelope.kind === 'income' ? 'Sobre de ingresos' : 'Sobre de gastos'}</Text>
          </View>
          <Pill tone={envelope.kind === 'income' ? 'green' : 'orange'}>{envelope.kind === 'income' ? 'Ingreso' : 'Gasto'}</Pill>
        </View>
      </Card>
      <SectionTitle>Meta del sobre</SectionTitle>
      <Card><View style={uiStyles.between}><Text style={[styles.title, { color: theme.text }]}>Reserva mensual</Text><Text style={[styles.title, { color: theme.text }]}>68%</Text></View><ProgressBar value={0.68} color={envelope.color} /><Text style={[styles.small, { color: theme.muted }]}>Faltan {money(192)} para completar la meta.</Text></Card>
      <SectionTitle>Movimientos</SectionTitle>
      <Card style={styles.list}>{transactions.slice(0, 4).map((item, index) => <View key={item.id} style={[styles.transaction, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={[styles.transactionIcon, { backgroundColor: theme.surfaceSecondary }]}><AppIcon name={item.icon} color={envelope.color} /></View><View style={styles.copy}><Text style={[styles.title, { color: theme.text }]}>{item.title}</Text><Text style={[styles.small, { color: theme.muted }]}>{item.date}</Text></View><Text style={[styles.amount, { color: theme.text }]}>{money(item.amount)}</Text></View>)}</Card>
      <PrimaryButton icon="plus" onPress={() => router.push('/add-transaction')}>
        {envelope.kind === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 12 }, heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#FFFFFF28', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { color: '#FFFFFFD0', fontSize: 12 }, heroValue: { color: '#FFFFFF', fontSize: 40, fontWeight: '700', letterSpacing: -1.5 },
  heroProgress: { height: 8, backgroundColor: '#FFFFFF35', borderRadius: 5, overflow: 'hidden' }, heroFill: { height: 8, backgroundColor: '#FFFFFF', borderRadius: 5 }, heroSmall: { color: '#FFFFFFD0', fontSize: 11 },
  ruleRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center' }, ruleIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  copy: { flex: 1, gap: 3 }, title: { fontSize: 14, fontWeight: '600' }, small: { fontSize: 11, lineHeight: 16 },
  list: { paddingVertical: 2 }, transaction: { minHeight: 70, flexDirection: 'row', alignItems: 'center' }, transactionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, amount: { fontSize: 13, fontWeight: '700' },
});
