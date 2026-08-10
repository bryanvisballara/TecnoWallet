import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppIcon, Card, Pill, PrimaryButton, ProgressBar, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';

export default function EnvelopeDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { envelopes, transactions, ledger } = useActiveLedger();
  const removeEnvelope = useLedgerStore((state) => state.removeEnvelope);
  const envelope = envelopes.find((item) => item.id === id) ?? envelopes[0];
  const hasBudget = envelope.budget > 0;
  const available = envelope.budget - envelope.spent;
  const ratio = hasBudget ? envelope.spent / envelope.budget : 0;
  const percent = Math.round(ratio * 100);
  const remainingToGoal = Math.max(0, envelope.budget - envelope.spent);
  const isSavings = envelope.kind === 'savings';
  const isIncome = envelope.kind === 'income';
  const [deleting, setDeleting] = useState(false);
  const openEdit = () =>
    router.push({ pathname: '/add-envelope', params: { id: envelope.id, kind: envelope.kind } });

  const confirmDelete = () => {
    Alert.alert(
      'Eliminar sobre',
      `¿Seguro que quieres eliminar "${envelope.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void runDelete(),
        },
      ],
    );
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      await removeEnvelope(envelope.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      safeGoBack('/(tabs)/sobres');
    } catch (error) {
      Alert.alert(
        'No se pudo eliminar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen
      title={envelope.name}
      subtitle={`${ledger.name} · Agosto 2026`}
      right={
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => safeGoBack('/(tabs)/sobres')}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Editar sobre"
            onPress={openEdit}
            style={[styles.back, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="paintbrush.fill" color={theme.primary} />
          </Pressable>
          <Pressable
            accessibilityLabel="Eliminar sobre"
            disabled={deleting}
            onPress={confirmDelete}
            style={[styles.back, { backgroundColor: '#FDECEC', opacity: deleting ? 0.6 : 1 }]}>
            <AppIcon name="trash" color={theme.danger} />
          </Pressable>
        </View>
      }>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={`Editar sobre ${envelope.name}`}
        onPress={openEdit}>
        <Card style={[styles.hero, { backgroundColor: envelope.color }]}>
          <View style={uiStyles.between}>
            <View style={styles.heroIcon}>
              <AppIcon name={envelope.icon} color="#FFFFFF" size={28} />
            </View>
            <Pill tone="neutral">
              {hasBudget
                ? `${percent}% ${isIncome ? 'recibido' : isSavings ? 'ahorrado' : 'usado'}`
                : 'Sin presupuesto'}
            </Pill>
          </View>
          <Text style={styles.heroLabel}>
            {isIncome
              ? 'Ingresos recibidos'
              : isSavings
                ? hasBudget
                  ? 'Ahorrado hacia la meta'
                  : 'Ahorros registrados'
                : hasBudget
                  ? 'Saldo disponible'
                  : 'Gastos registrados'}
          </Text>
          <Text style={styles.heroValue}>
            {money(isIncome || isSavings || !hasBudget ? envelope.spent : available)}
          </Text>
          {hasBudget ? (
            <View style={styles.heroProgress}>
              <View style={[styles.heroFill, { width: `${Math.min(100, ratio * 100)}%` }]} />
            </View>
          ) : null}
          <View style={uiStyles.between}>
            <Text style={styles.heroSmall}>
              {money(envelope.spent)}{' '}
              {isIncome ? 'recibidos' : isSavings ? 'ahorrados' : 'gastados'}
            </Text>
            <Text style={styles.heroSmall}>
              {hasBudget
                ? `${money(envelope.budget)} ${isIncome ? 'esperados' : isSavings ? 'meta' : 'asignados'}`
                : 'Toca para editar'}
            </Text>
          </View>
        </Card>
      </ScalePressable>
      <Card>
        {hasBudget && !isSavings ? (
          <View style={styles.ruleRow}>
            <View style={[styles.ruleIcon, { backgroundColor: theme.primarySoft }]}>
              <AppIcon name="repeat" color={theme.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.text }]}>Rollover mensual</Text>
              <Text style={[styles.small, { color: theme.muted }]}>
                {envelope.rollover ? 'El saldo sobrante se acumula' : 'El saldo se reinicia'}
              </Text>
            </View>
            <Switch value={envelope.rollover} disabled />
          </View>
        ) : null}
        <View
          style={[
            styles.ruleRow,
            !isSavings && hasBudget
              ? { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }
              : null,
          ]}>
          <View style={[styles.ruleIcon, { backgroundColor: theme.successSoft }]}>
            <AppIcon name="sparkles" color={theme.success} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.text }]}>Regla automática</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{envelope.rule}</Text>
          </View>
        </View>
        <View
          style={[
            styles.ruleRow,
            { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}>
          <View
            style={[
              styles.ruleIcon,
              {
                backgroundColor: isIncome
                  ? theme.successSoft
                  : isSavings
                    ? theme.primarySoft
                    : '#FDECEC',
              },
            ]}>
            <AppIcon
              name={
                isIncome
                  ? 'arrow.down.circle.fill'
                  : isSavings
                    ? 'leaf.fill'
                    : 'arrow.up.circle.fill'
              }
              color={isIncome ? theme.success : isSavings ? theme.primary : theme.danger}
            />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.text }]}>Tipo de sobre</Text>
            <Text style={[styles.small, { color: theme.muted }]}>
              {isIncome
                ? 'Sobre de ingresos'
                : isSavings
                  ? 'Sobre de ahorros · Creado desde Metas/Ahorros'
                  : 'Sobre de gastos'}
            </Text>
          </View>
          <Pill tone={isIncome ? 'green' : isSavings ? 'blue' : 'orange'}>
            {isIncome ? 'Ingreso' : isSavings ? 'Ahorro' : 'Gasto'}
          </Pill>
        </View>
      </Card>
      {hasBudget ? (
        <>
          <SectionTitle>{isSavings ? 'Progreso de ahorro' : 'Meta del sobre'}</SectionTitle>
          <Card>
            <View style={uiStyles.between}>
              <Text style={[styles.title, { color: theme.text }]}>
                {isSavings ? 'Meta de ahorro' : 'Reserva mensual'}
              </Text>
              <Text style={[styles.title, { color: theme.text }]}>{percent}%</Text>
            </View>
            <ProgressBar value={ratio} color={envelope.color} />
            <Text style={[styles.small, { color: theme.muted }]}>
              {remainingToGoal > 0
                ? `Faltan ${money(remainingToGoal)} para completar la meta.`
                : 'La meta está completa.'}
            </Text>
          </Card>
        </>
      ) : null}
      <SectionTitle>Movimientos</SectionTitle>
      <Card style={styles.list}>
        {transactions.slice(0, 4).map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.transaction,
              index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}>
            <View style={[styles.transactionIcon, { backgroundColor: theme.surfaceSecondary }]}>
              <AppIcon name={item.icon} color={envelope.color} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.small, { color: theme.muted }]}>{item.date}</Text>
            </View>
            <Text style={[styles.amount, { color: theme.text }]}>{money(item.amount)}</Text>
          </View>
        ))}
      </Card>
      <PrimaryButton icon="plus" onPress={() => router.push('/add-transaction')}>
        {isIncome ? 'Registrar ingreso' : isSavings ? 'Registrar aporte' : 'Registrar gasto'}
      </PrimaryButton>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Eliminar sobre"
        disabled={deleting}
        onPress={confirmDelete}
        style={[styles.deleteBtn, { borderColor: theme.danger, opacity: deleting ? 0.6 : 1 }]}>
        <AppIcon name="trash" color={theme.danger} size={16} />
        <Text style={[styles.deleteText, { color: theme.danger }]}>Eliminar sobre</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 12 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#FFFFFF28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { color: '#FFFFFFD0', fontSize: 12 },
  heroValue: { color: '#FFFFFF', fontSize: 40, fontWeight: '700', letterSpacing: -1.5 },
  heroProgress: { height: 8, backgroundColor: '#FFFFFF35', borderRadius: 5, overflow: 'hidden' },
  heroFill: { height: 8, backgroundColor: '#FFFFFF', borderRadius: 5 },
  heroSmall: { color: '#FFFFFFD0', fontSize: 11 },
  ruleRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center' },
  ruleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '600' },
  small: { fontSize: 11, lineHeight: 16 },
  list: { paddingVertical: 2 },
  transaction: { minHeight: 70, flexDirection: 'row', alignItems: 'center' },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  amount: { fontSize: 13, fontWeight: '700' },
  deleteBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: { fontSize: 15, fontWeight: '700' },
});
