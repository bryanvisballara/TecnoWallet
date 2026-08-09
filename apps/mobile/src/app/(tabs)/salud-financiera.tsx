import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, Pill, ProgressBar, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money, type Account } from '@/data/demo';
import {
  isLiquidAccount,
  isWealthAsset,
  isWealthDebt,
  sumBalances,
} from '@/lib/accounts';
import { useActiveLedger } from '@/store/ledger';

function AccountRow({ account }: { account: Account }) {
  const theme = useAppTheme();
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${account.name}`}
      onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}>
      <Card>
        <View style={[uiStyles.row, uiStyles.gap12]}>
          <View style={[styles.accountIcon, { backgroundColor: `${account.color}1A` }]}>
            <AppIcon name={account.icon} color={account.color} size={24} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.accountName, { color: theme.text }]}>{account.name}</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{account.kind}</Text>
          </View>
          <View style={styles.balanceCopy}>
            <Text
              style={[
                styles.balance,
                { color: account.balance < 0 ? theme.danger : theme.text },
              ]}>
              {money(account.balance < 0 ? Math.abs(account.balance) : account.balance)}
            </Text>
            <Text style={[styles.sync, { color: account.balance < 0 ? theme.danger : theme.success }]}>
              {account.balance < 0 ? 'Deuda' : 'Activo'}
            </Text>
          </View>
          <AppIcon name="chevron" color={theme.muted} size={15} />
        </View>
      </Card>
    </ScalePressable>
  );
}

export default function SaludFinancieraScreen() {
  const theme = useAppTheme();
  const { accounts, ledger } = useActiveLedger();

  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const wealthAssets = useMemo(
    () => accounts.filter((item) => isWealthAsset(item)),
    [accounts],
  );
  const wealthDebts = useMemo(
    () => accounts.filter((item) => isWealthDebt(item)),
    [accounts],
  );

  const liquidez = sumBalances(liquidAccounts);
  const bienes = sumBalances(wealthAssets);
  const deudas = Math.abs(sumBalances(wealthDebts));
  const patrimonio = liquidez + bienes - deudas;
  const totalWealthBase = Math.max(liquidez, 0) + bienes + deudas;
  const creditUsage = totalWealthBase > 0 ? deudas / totalWealthBase : 0;

  const healthTone = creditUsage === 0 ? 'neutral' : creditUsage < 0.3 ? 'green' : creditUsage < 0.5 ? 'orange' : 'neutral';
  const healthColor = creditUsage === 0 ? theme.muted : creditUsage < 0.3 ? theme.success : theme.warning;
  const healthCopy =
    deudas === 0
      ? 'Sin deudas registradas. Tu patrimonio es liquidez más bienes.'
      : creditUsage < 0.3
        ? 'Bien. La deuda es baja frente a tu patrimonio.'
        : 'La deuda pesa más. Revisa pasivos y pagos.';

  return (
    <Screen
      withTabBar
      title="Salud financiera"
      subtitle={`Patrimonio · ${ledger.name}`}
      right={
        <Pressable
          onPress={() => router.replace('/(tabs)/inicio')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={[styles.patrimonioCard, { backgroundColor: '#0B1D3A' }]}>
        <Text style={styles.heroLabel}>Patrimonio</Text>
        <Text style={styles.heroValue}>{money(patrimonio)}</Text>
        <Text style={styles.patrimonioHint}>Liquidez + bienes − deudas</Text>
        <View style={styles.heroStats}>
          <View>
            <Text style={styles.heroSmall}>Liquidez</Text>
            <Text style={styles.heroStat}>{money(liquidez, true)}</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.heroSmall}>Bienes</Text>
            <Text style={styles.heroStat}>{money(bienes, true)}</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.heroSmall}>Deudas</Text>
            <Text style={styles.heroStat}>{money(deudas, true)}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.health}>
        <View style={uiStyles.between}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Peso de la deuda</Text>
          <Text style={[styles.score, { color: healthColor }]}>{Math.round(creditUsage * 100)}%</Text>
        </View>
        <ProgressBar value={creditUsage} color={healthColor} label="Peso de la deuda" />
        <View style={uiStyles.between}>
          <Text style={[styles.small, { color: theme.muted, flex: 1 }]}>{healthCopy}</Text>
          {deudas > 0 ? (
            <Pill tone={healthTone === 'green' ? 'green' : 'orange'}>{money(deudas, true)}</Pill>
          ) : null}
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={[styles.subsection, { color: theme.muted }]}>ACTIVOS</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar activo"
          onPress={() => router.push({ pathname: '/add-account', params: { mode: 'asset' } })}
          style={[styles.addBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <AppIcon name="plus" color={theme.primary} size={16} />
        </Pressable>
      </View>
      {wealthAssets.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            Sin bienes registrados. Usa + para agregar una casa u otro activo.
          </Text>
        </Card>
      ) : (
        wealthAssets.map((account) => <AccountRow key={account.id} account={account} />)
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.subsection, { color: theme.muted }]}>DEUDAS</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar deuda"
          onPress={() => router.push({ pathname: '/add-account', params: { mode: 'debt' } })}
          style={[styles.addBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <AppIcon name="plus" color={theme.primary} size={16} />
        </Pressable>
      </View>
      {wealthDebts.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            Sin deudas registradas.
          </Text>
        </Card>
      ) : (
        wealthDebts.map((account) => <AccountRow key={account.id} account={account} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  patrimonioCard: { gap: 8, borderWidth: 0 },
  patrimonioHint: { color: '#DCEBFF', fontSize: 12 },
  heroLabel: { color: '#DCEBFF', fontSize: 13 },
  heroValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '700', letterSpacing: -1.3 },
  heroStats: { flexDirection: 'row', gap: 18, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
  heroSmall: { color: '#DCEBFF', fontSize: 11 },
  heroStat: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 2 },
  divider: { height: 32, width: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF66' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 17 },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  accountName: { fontSize: 15, fontWeight: '600' },
  balanceCopy: { alignItems: 'flex-end', gap: 3 },
  balance: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sync: { fontSize: 10 },
  health: { gap: 13 },
  score: { fontSize: 18, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: -2,
  },
  subsection: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
