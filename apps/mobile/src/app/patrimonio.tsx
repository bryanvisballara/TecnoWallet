import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, Pill, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useActiveLedger } from '@/store/ledger';

export default function NetWorthScreen() {
  const theme = useAppTheme();
  const { accounts, ledger } = useActiveLedger();
  const assetAccounts = accounts.filter((item) => item.balance >= 0);
  const debtAccounts = accounts.filter((item) => item.balance < 0);
  const assets = assetAccounts.reduce((sum, item) => sum + item.balance, 0);
  const debt = debtAccounts.reduce((sum, item) => sum + Math.abs(item.balance), 0);
  const net = assets - debt;
  const assetShare = assets + debt > 0 ? assets / (assets + debt) : 1;

  return (
    <Screen
      title="Patrimonio"
      subtitle={`Neto del libro ${ledger.name}`}
      right={
        <Pressable
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
        <Text style={styles.heroLabel}>Patrimonio neto</Text>
        <Text style={styles.heroValue}>{money(net)}</Text>
        <Text style={styles.heroHint}>Activos − deudas de tus cuentas</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroSmall}>Activos</Text>
            <Text style={styles.heroStatValue}>{money(assets)}</Text>
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
          <View style={[styles.barFill, { flex: Math.max(assets, 0.01), backgroundColor: theme.success }]} />
          <View style={[styles.barFill, { flex: Math.max(debt, 0.01), backgroundColor: theme.danger }]} />
        </View>
        <View style={uiStyles.between}>
          <Text style={[styles.small, { color: theme.muted }]}>Activos {money(assets, true)}</Text>
          <Text style={[styles.small, { color: theme.muted }]}>Deudas {money(debt, true)}</Text>
        </View>
      </Card>

      <SectionTitle action="Ver cuentas" onAction={() => router.push('/(tabs)/cuentas')}>
        Activos
      </SectionTitle>
      <Card style={styles.list}>
        {assetAccounts.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>Sin cuentas con saldo positivo.</Text>
        ) : (
          assetAccounts.map((account, index) => (
            <ScalePressable
              key={account.id}
              onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}>
              <View style={[styles.icon, { backgroundColor: `${account.color}1A` }]}>
                <AppIcon name={account.icon} color={account.color} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{account.name}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>{account.kind}</Text>
              </View>
              <Text style={[styles.amount, { color: theme.text }]}>{money(account.balance)}</Text>
              <AppIcon name="chevron" color={theme.muted} size={14} />
            </ScalePressable>
          ))
        )}
      </Card>

      <SectionTitle>Deudas</SectionTitle>
      <Card style={styles.list}>
        {debtAccounts.length === 0 ? (
          <Text style={[styles.empty, { color: theme.muted }]}>Sin deudas en este libro.</Text>
        ) : (
          debtAccounts.map((account, index) => (
            <ScalePressable
              key={account.id}
              onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}>
              <View style={[styles.icon, { backgroundColor: `${account.color}1A` }]}>
                <AppIcon name={account.icon} color={account.color} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{account.name}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>{account.kind}</Text>
              </View>
              <Text style={[styles.amount, { color: theme.danger }]}>{money(account.balance)}</Text>
              <AppIcon name="chevron" color={theme.muted} size={14} />
            </ScalePressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 8 },
  heroLabel: { color: '#DCEBFF', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', letterSpacing: -1.2 },
  heroHint: { color: '#DCEBFF', fontSize: 12 },
  heroStats: { flexDirection: 'row', gap: 24, alignItems: 'center', marginTop: 10 },
  heroStat: { gap: 2 },
  heroSmall: { color: '#DCEBFF', fontSize: 11 },
  heroStatValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  divider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: '#FFFFFF66' },
  section: { fontSize: 18, fontWeight: '700' },
  barTrack: { flexDirection: 'row', height: 12, borderRadius: 8, overflow: 'hidden', gap: 3, marginVertical: 12 },
  barFill: { height: 12, borderRadius: 6 },
  small: { fontSize: 12 },
  list: { paddingVertical: 2 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  amount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: 16, fontSize: 13, textAlign: 'center' },
});
