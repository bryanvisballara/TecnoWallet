import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money, type Account } from '@/data/demo';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { isLiquidAccount, sumBalances } from '@/lib/accounts';
import { useActiveLedger } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';

function AccountRow({ account }: { account: Account }) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`Ver detalle de ${account.name}`}
      onPress={() => router.push({ pathname: '/(tabs)/account/[id]', params: { id: account.id } })}>
      <Card>
        <View style={[uiStyles.row, uiStyles.gap12]}>
          <View style={[styles.accountIcon, { backgroundColor: `${account.color}1A` }]}>
            <AppIcon name={account.icon} color={account.color} size={24} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.accountName, { color: theme.text }]}>{account.name}</Text>
            <Text style={[styles.small, { color: theme.muted }]}>
              {account.kind}
              {account.lastFour === '—' ? '' : ` · •••• ${account.lastFour}`}
            </Text>
          </View>
          <View style={styles.balanceCopy}>
            <Text style={[styles.balance, { color: theme.text }]}>{money(account.balance)}</Text>
            <Text style={[styles.sync, { color: theme.success }]}>
              {account.balance === 0 ? copy.accounts.noMovement : copy.accounts.upToDate}
            </Text>
          </View>
          <AppIcon name="chevron" color={theme.muted} size={15} />
        </View>
      </Card>
    </ScalePressable>
  );
}

export default function MisCuentasScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { accounts, ledger } = useActiveLedger();
  const liquidAccounts = useMemo(
    () => accounts.filter((item) => isLiquidAccount(item.kind)),
    [accounts],
  );
  const liquidez = sumBalances(liquidAccounts);
  const ledgerLabel = ledger ? displayLedgerName(ledger.name, locale) : '';

  if (!ledger) {
    return <Screen withTabBar title={copy.accounts.title} />;
  }

  return (
    <Screen
      withTabBar
      title={copy.accounts.title}
      subtitle={copy.accounts.liquidityMonth(ledgerLabel)}
      right={
        <Pressable
          onPress={() => router.replace('/(tabs)/inicio')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
        <Text style={styles.heroLabel}>{copy.accounts.liquidity}</Text>
        <Text style={styles.heroValue}>{money(liquidez)}</Text>
        <View style={styles.heroStats}>
          <View>
            <Text style={styles.heroSmall}>{copy.accounts.title}</Text>
            <Text style={styles.heroStat}>{liquidAccounts.length}</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.heroSmall}>{copy.accounts.available}</Text>
            <Text style={styles.heroStat}>{money(liquidez, true)}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.accountsHeader}>
        <Text accessibilityRole="header" style={[styles.accountsTitle, { color: theme.text }]}>
          {copy.accounts.myAccounts}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar cuenta"
          onPress={() => router.push({ pathname: '/add-account', params: { mode: 'liquid' } })}
          style={[styles.addBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <AppIcon name="plus" color={theme.primary} size={16} />
        </Pressable>
      </View>
      {liquidAccounts.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            {copy.accounts.empty}
          </Text>
        </Card>
      ) : (
        liquidAccounts.map((account) => <AccountRow key={account.id} account={account} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: '#0878F9', gap: 8, borderWidth: 0 },
  heroLabel: { color: '#DCEBFF', fontSize: 13 },
  heroValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '700', letterSpacing: -1.3 },
  heroStats: { flexDirection: 'row', gap: 18, alignItems: 'center', marginTop: 12 },
  heroSmall: { color: '#DCEBFF', fontSize: 11 },
  heroStat: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 2 },
  divider: { height: 32, width: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF66' },
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
  accountsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  accountsTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.35 },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
