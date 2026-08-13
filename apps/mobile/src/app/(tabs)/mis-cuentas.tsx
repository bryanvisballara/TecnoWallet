import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HeroBalanceBanner } from '@/components/hero-balance-banner';
import { AppIcon, Card, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money, type Account } from '@/data/demo';
import { displayLedgerName, useAppCopy } from '@/i18n/app-copy';
import { isLiquidAccount, sumBalances } from '@/lib/accounts';
import { useActiveLedger } from '@/store/ledger';
import { useLanguageStore } from '@/store/language';
import { usePreferencesStore } from '@/store/preferences';

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
  const hideBalances = usePreferencesStore((state) => state.hideBalances);
  const setHideBalances = usePreferencesStore((state) => state.setHideBalances);
  const [hidden, setHidden] = useState(hideBalances);

  useEffect(() => {
    setHidden(hideBalances);
  }, [hideBalances]);

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
      <HeroBalanceBanner
        compact
        label={copy.accounts.liquidity}
        amount={liquidez}
        hidden={hidden}
        onToggleHidden={() => {
          setHidden((prev) => {
            const next = !prev;
            void setHideBalances(next);
            return next;
          });
        }}
        toggleA11yLabel={copy.home.toggleBalances}
        ledgerLabel={ledgerLabel}
        ledgerIcon={ledger.icon || 'house.fill'}
        actionLabel={copy.home.liquidityFromAccounts(liquidAccounts.length)}
      />

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
