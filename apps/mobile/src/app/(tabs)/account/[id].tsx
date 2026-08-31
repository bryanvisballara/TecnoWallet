import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppIcon, Card, Pill, PrimaryButton, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { isWealthAsset, isWealthDebt } from '@/lib/accounts';
import { resolveEnvelopeForTransaction } from '@/lib/envelope-match';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';

export default function AccountDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, transactions, ledger, envelopes } = useActiveLedger();
  const removeAccount = useLedgerStore((state) => state.removeAccount);
  const account = accounts.find((item) => item.id === id) ?? accounts[0];
  const accountTx = transactions.filter((item) => item.account === account.name);
  const isAsset = isWealthAsset(account);
  const isDebt = isWealthDebt(account);
  const isWealthItem = isAsset || isDebt;
  const masked = account.lastFour === '—' ? 'Sin número' : `•••• ${account.lastFour}`;
  const [deleting, setDeleting] = useState(false);
  const openEdit = () =>
    router.push({
      pathname: '/add-account',
      params: {
        id: account.id,
        ...(isAsset ? { mode: 'asset' } : isDebt ? { mode: 'debt' } : {}),
      },
    });

  const entityLabel = isDebt ? 'deuda' : isAsset ? 'activo' : 'cuenta';
  const fallback = isWealthItem ? '/(tabs)/salud-financiera' : '/(tabs)/mis-cuentas';
  const heroLabel = isDebt
    ? 'Saldo pendiente'
    : isAsset
      ? 'Valor del activo'
      : 'Saldo disponible';
  const heroBadge = isDebt ? 'Deuda' : isAsset ? 'Activo' : 'Cuenta';
  const heroBadgeTone = isDebt ? 'orange' : isAsset ? 'blue' : 'neutral';

  // Wealth detail sits in the tabs stack; router.back() often lands on Inicio
  // (last focused tab) instead of Salud financiera — always replace for assets/debts.
  const goBack = () => {
    if (isWealthItem) {
      router.replace('/(tabs)/salud-financiera');
      return;
    }
    safeGoBack(fallback);
  };

  const confirmDelete = () => {
    Alert.alert(
      `Eliminar ${entityLabel}`,
      `¿Seguro que quieres eliminar "${account.name}"? Esta acción no se puede deshacer.`,
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
      await removeAccount(account.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack();
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
      title={account.name}
      subtitle={`${account.kind} · ${ledger.name}`}
      right={
        <View style={styles.headerActions}>
          <Pressable
            onPress={goBack}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Editar cuenta"
            onPress={openEdit}
            style={[styles.back, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="paintbrush.fill" color={theme.primary} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Eliminar ${entityLabel}`}
            disabled={deleting}
            onPress={confirmDelete}
            style={[styles.back, { backgroundColor: '#FDECEC', opacity: deleting ? 0.6 : 1 }]}>
            <AppIcon name="trash" color={theme.danger} />
          </Pressable>
        </View>
      }>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={`Editar ${entityLabel} ${account.name}`}
        onPress={openEdit}>
        <Card style={[styles.hero, { backgroundColor: account.color }]}>
          <View style={uiStyles.between}>
            <View style={styles.heroIcon}>
              <AppIcon name={account.icon} color="#FFFFFF" size={28} />
            </View>
            <Pill tone={heroBadgeTone}>{heroBadge}</Pill>
          </View>
          <Text style={styles.heroLabel}>{heroLabel}</Text>
          <Text style={styles.heroValue}>{money(Math.abs(account.balance))}</Text>
          <Text style={styles.heroSmall}>
            {isWealthItem ? 'Toca para editar' : `${masked} · Toca para editar`}
          </Text>
        </Card>
      </ScalePressable>

      <Card>
        <View style={styles.metaRow}>
          <View style={[styles.metaIcon, { backgroundColor: `${account.color}1A` }]}>
            <AppIcon
              name={isAsset ? 'house.fill' : 'creditcard.fill'}
              color={account.color}
            />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.text }]}>Tipo</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{account.kind}</Text>
          </View>
        </View>
        {!isWealthItem ? (
          <View
            style={[
              styles.metaRow,
              { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}>
            <View style={[styles.metaIcon, { backgroundColor: theme.successSoft }]}>
              <AppIcon name="arrow.left.arrow.right" color={theme.success} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.text }]}>Sincronización</Text>
              <Text style={[styles.small, { color: theme.muted }]}>
                Actualizada hoy · conexión activa
              </Text>
            </View>
            <Pill tone="green">OK</Pill>
          </View>
        ) : null}
      </Card>

      {!isWealthItem ? (
        <>
          <SectionTitle action="Ver todos" onAction={() => router.push('/(tabs)/movimientos')}>
            Movimientos
          </SectionTitle>
          <Card style={styles.list}>
            {accountTx.length > 0 ? (
              accountTx.map((item, index) => {
                const envelope = resolveEnvelopeForTransaction(item, envelopes);
                const envelopeLabel = envelope?.name.trim() || item.category.trim();
                return (
                  <ScalePressable
                    key={item.id}
                    haptic={false}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver ${item.title}${envelopeLabel ? `, sobre ${envelopeLabel}` : ', sin sobre'}`}
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
                    <View style={[styles.transactionIcon, { backgroundColor: theme.surfaceSecondary }]}>
                      <AppIcon name={item.icon} color={account.color} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
                      <Text style={[styles.small, { color: theme.muted }]}>
                        {envelopeLabel ? `Sobre ${envelopeLabel}` : 'Sin sobre'} · {item.date}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.amount,
                        { color: item.amount > 0 ? theme.success : theme.text },
                      ]}>
                      {item.amount > 0 ? '+' : ''}
                      {money(item.amount)}
                    </Text>
                    <AppIcon name="chevron.right" color={theme.muted} size={14} />
                  </ScalePressable>
                );
              })
            ) : (
              <Text style={[styles.small, { color: theme.muted, paddingVertical: 12 }]}>
                Aún no hay movimientos en esta cuenta.
              </Text>
            )}
          </Card>

          <PrimaryButton
            icon="plus"
            onPress={() =>
              router.push({ pathname: '/add-transaction', params: { accountId: account.id } })
            }>
            Registrar movimiento
          </PrimaryButton>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${entityLabel}`}
        disabled={deleting}
        onPress={confirmDelete}
        style={[styles.deleteBtn, { borderColor: theme.danger, opacity: deleting ? 0.6 : 1 }]}>
        <AppIcon name="trash" color={theme.danger} size={16} />
        <Text style={[styles.deleteText, { color: theme.danger }]}>
          {`Eliminar ${entityLabel}`}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 10 },
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
  heroSmall: { color: '#FFFFFFD0', fontSize: 12 },
  metaRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  metaIcon: {
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
  transaction: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 8 },
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
