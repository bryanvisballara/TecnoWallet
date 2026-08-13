import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useMemo } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SwipeEditDeleteRow } from '@/components/swipe-edit-delete-row';
import { AppIcon, Card, Pill, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money, type Account } from '@/data/demo';
import {
  isLiquidAccount,
  isWealthAsset,
  isWealthDebt,
  sumBalances,
} from '@/lib/accounts';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';

function SwipeAccountRow({
  account,
  index,
  amountColor,
  mode,
}: {
  account: Account;
  index: number;
  amountColor?: string;
  mode: 'asset' | 'debt' | 'liquidity';
}) {
  const theme = useAppTheme();
  const removeAccount = useLedgerStore((state) => state.removeAccount);
  const editMode = mode === 'debt' ? 'debt' : 'asset';

  const openDetail = () =>
    router.push({ pathname: '/(tabs)/account/[id]', params: { id: account.id } });

  const openEdit = () =>
    router.push({ pathname: '/add-account', params: { id: account.id, mode: editMode } });

  const confirmDelete = () => {
    const label = mode === 'debt' ? 'deuda' : mode === 'asset' ? 'activo' : 'cuenta';
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
        accessibilityLabel={`${account.name}. Desliza para editar o eliminar.`}
        onPress={openDetail}
        style={[
          styles.row,
          { backgroundColor: theme.surface },
          index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
        ]}>
        <View style={[styles.icon, { backgroundColor: `${account.color}1A` }]}>
          <AppIcon name={account.icon} color={account.color} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{account.name}</Text>
          <Text style={[styles.small, { color: theme.muted }]}>{account.kind}</Text>
        </View>
        <Text style={[styles.amount, { color: amountColor ?? theme.text }]}>
          {money(mode === 'debt' ? Math.abs(account.balance) : account.balance)}
        </Text>
        <AppIcon name="chevron" color={theme.muted} size={14} />
      </Pressable>
    </SwipeEditDeleteRow>
  );
}

export default function NetWorthScreen() {
  const theme = useAppTheme();
  const { accounts, ledger } = useActiveLedger();

  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const assetAccounts = useMemo(
    () => accounts.filter((item) => isWealthAsset(item)),
    [accounts],
  );
  const debtAccounts = useMemo(
    () => accounts.filter((item) => isWealthDebt(item)),
    [accounts],
  );

  const liquidez = sumBalances(liquidAccounts);
  const bienes = sumBalances(assetAccounts);
  const debt = Math.abs(sumBalances(debtAccounts));
  const net = liquidez + bienes - debt;
  const assetShare =
    liquidez + bienes + debt > 0 ? (Math.max(liquidez, 0) + bienes) / (Math.max(liquidez, 0) + bienes + debt) : 1;

  return (
    <Screen
      title="Patrimonio"
      subtitle={`Neto del libro ${ledger.name}`}
      right={
        <Pressable
          onPress={() => safeGoBack('/(tabs)/salud-financiera')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={[styles.hero, { backgroundColor: '#0B1D3A' }]}>
        <Text style={styles.heroLabel}>Patrimonio</Text>
        <Text
          style={styles.heroValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}>
          {money(net)}
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroSmall}>Liquidez</Text>
            <Text style={styles.heroStatValue}>{money(liquidez)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroSmall}>Bienes</Text>
            <Text style={styles.heroStatValue}>{money(bienes)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroSmall}>Deudas</Text>
            <Text style={styles.heroStatValue}>{money(debt)}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={uiStyles.between}>
          <Text style={[styles.section, { color: theme.text }]}>Composición</Text>
          <Pill tone="green">{Math.round(assetShare * 100)}% activos</Pill>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { flex: Math.max(Math.max(liquidez, 0) + bienes, 0.01), backgroundColor: theme.success }]} />
          <View style={[styles.barFill, { flex: Math.max(debt, 0.01), backgroundColor: theme.danger }]} />
        </View>
        <View style={uiStyles.between}>
          <Text style={[styles.small, { color: theme.muted }]}>
            Activos {money(Math.max(liquidez, 0) + bienes, true)}
          </Text>
          <Text style={[styles.small, { color: theme.muted }]}>Deudas {money(debt, true)}</Text>
        </View>
      </Card>

      <SectionTitle action="Ver cuentas" onAction={() => router.push('/(tabs)/mis-cuentas')}>
        Liquidez
      </SectionTitle>
      <Card style={styles.list}>
        {liquidAccounts.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>Sin cuentas líquidas.</Text>
        ) : (
          liquidAccounts.map((account, index) => (
            <SwipeAccountRow
              key={account.id}
              account={account}
              index={index}
              mode="liquidity"
            />
          ))
        )}
      </Card>

      <SectionTitle>Bienes</SectionTitle>
      <Card style={styles.list}>
        {assetAccounts.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>Sin bienes (casa, inversión…).</Text>
        ) : (
          assetAccounts.map((account, index) => (
            <SwipeAccountRow
              key={account.id}
              account={account}
              index={index}
              mode="asset"
            />
          ))
        )}
      </Card>

      <SectionTitle>Deudas</SectionTitle>
      <Card style={styles.list}>
        {debtAccounts.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>Sin deudas en este libro.</Text>
        ) : (
          debtAccounts.map((account, index) => (
            <SwipeAccountRow
              key={account.id}
              account={account}
              index={index}
              amountColor={theme.danger}
              mode="debt"
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: {
    borderWidth: 0,
    gap: 8,
    minHeight: 128,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    justifyContent: 'space-between',
  },
  heroLabel: { color: '#DCEBFF', fontSize: 13 },
  heroValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroStats: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroStat: { gap: 1 },
  heroSmall: { color: '#DCEBFF', fontSize: 10 },
  heroStatValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  divider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: '#FFFFFF55' },
  section: { fontSize: 16, fontWeight: '700' },
  barTrack: { flexDirection: 'row', height: 12, borderRadius: 8, overflow: 'hidden', gap: 3, marginVertical: 12 },
  barFill: { height: 12, borderRadius: 6 },
  small: { fontSize: 12 },
  list: { paddingVertical: 2, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  amount: { fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },
});
