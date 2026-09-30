import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppIcon, Card, Pill, PrimaryButton, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { displayLedgerName, displayStoredName, useAppCopy } from '@/i18n/app-copy';
import { isWealthAsset, isWealthDebt } from '@/lib/accounts';
import { resolveEnvelopeForTransaction } from '@/lib/envelope-match';
import { withPaidLedgerAccess } from '@/lib/require-paid-access';
import { useLanguageStore } from '@/store/language';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';

export default function AccountDetailScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, transactions, ledger, envelopes } = useActiveLedger();
  const removeAccount = useLedgerStore((state) => state.removeAccount);
  const account = accounts.find((item) => item.id === id) ?? accounts[0];
  const accountTx = transactions.filter((item) => item.account === account.name);
  const isAsset = isWealthAsset(account);
  const isDebt = isWealthDebt(account);
  const isWealthItem = isAsset || isDebt;
  const masked = account.lastFour === '—' ? copy.accounts.noNumber : `•••• ${account.lastFour}`;
  const [deleting, setDeleting] = useState(false);
  const kindLabel = displayStoredName(account.kind, locale);
  const accountLabel = displayStoredName(account.name, locale);
  const bookLabel = displayLedgerName(ledger.name, locale);
  const openEdit = () =>
    withPaidLedgerAccess(() =>
      router.push({
        pathname: '/add-account',
        params: {
          id: account.id,
          ...(isAsset ? { mode: 'asset' } : isDebt ? { mode: 'debt' } : {}),
        },
      }),
    );

  const entityLabel = isDebt
    ? copy.accounts.entityDebt
    : isAsset
      ? copy.accounts.entityAsset
      : copy.accounts.entityAccount;
  const fallback = isWealthItem ? '/(tabs)/salud-financiera' : '/(tabs)/mis-cuentas';
  const heroLabel = isDebt
    ? copy.accounts.pendingBalance
    : isAsset
      ? copy.accounts.assetValue
      : copy.accounts.availableBalance;
  const heroBadge = isDebt
    ? copy.health.badgeDebt
    : isAsset
      ? copy.health.badgeAsset
      : copy.accounts.badgeAccount;
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
    Alert.alert(copy.accounts.deleteTitle(entityLabel), copy.accounts.deleteBody(accountLabel), [
      { text: copy.common.cancel, style: 'cancel' },
      {
        text: copy.common.delete,
        style: 'destructive',
        onPress: () => void runDelete(),
      },
    ]);
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      await removeAccount(account.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack();
    } catch (error) {
      Alert.alert(
        copy.accounts.deleteFailed,
        error instanceof Error ? error.message : copy.common.tryAgain,
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen
      title={accountLabel}
      subtitle={`${kindLabel} · ${bookLabel}`}
      right={
        <View style={styles.headerActions}>
          <Pressable
            onPress={goBack}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
          <Pressable
            accessibilityLabel={copy.accounts.tapToEdit}
            onPress={openEdit}
            style={[styles.back, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="paintbrush.fill" color={theme.primary} />
          </Pressable>
          <Pressable
            accessibilityLabel={copy.accounts.deleteTitle(entityLabel)}
            disabled={deleting}
            onPress={confirmDelete}
            style={[styles.back, { backgroundColor: '#FDECEC', opacity: deleting ? 0.6 : 1 }]}>
            <AppIcon name="trash" color={theme.danger} />
          </Pressable>
        </View>
      }>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.accounts.tapToEdit} ${accountLabel}`}
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
            {isWealthItem ? copy.accounts.tapToEdit : `${masked} · ${copy.accounts.tapToEdit}`}
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
            <Text style={[styles.title, { color: theme.text }]}>{copy.accounts.typeLabel}</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{kindLabel}</Text>
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
              <Text style={[styles.title, { color: theme.text }]}>{copy.accounts.sync}</Text>
              <Text style={[styles.small, { color: theme.muted }]}>
                {copy.accounts.syncStatus}
              </Text>
            </View>
            <Pill tone="green">OK</Pill>
          </View>
        ) : null}
      </Card>

      {!isWealthItem ? (
        <>
          <SectionTitle action={copy.common.viewAll} onAction={() => router.push('/(tabs)/movimientos')}>
            {copy.accounts.movements}
          </SectionTitle>
          <Card style={styles.list}>
            {accountTx.length > 0 ? (
              accountTx.map((item, index) => {
                const envelope = resolveEnvelopeForTransaction(item, envelopes);
                const envelopeLabel = displayStoredName(
                  envelope?.name.trim() || item.category.trim(),
                  locale,
                );
                return (
                  <ScalePressable
                    key={item.id}
                    haptic={false}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}${envelopeLabel ? `, ${copy.accounts.envelopeLine(envelopeLabel)}` : `, ${copy.accounts.noEnvelope}`}`}
                    onPress={() =>
                      withPaidLedgerAccess(() =>
                        router.push({
                          pathname: '/add-transaction',
                          params: { id: item.id },
                        }),
                      )
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
                      <Text style={[styles.title, { color: theme.text }]}>
                        {displayStoredName(item.title, locale)}
                      </Text>
                      <Text style={[styles.small, { color: theme.muted }]}>
                        {envelopeLabel
                          ? copy.accounts.envelopeLine(envelopeLabel)
                          : copy.accounts.noEnvelope}{' '}
                        · {item.date}
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
                {copy.accounts.emptyMovements}
              </Text>
            )}
          </Card>

          <PrimaryButton
            icon="plus"
            onPress={() =>
              withPaidLedgerAccess(() =>
                router.push({ pathname: '/add-transaction', params: { accountId: account.id } }),
              )
            }>
            {copy.accounts.addMovement}
          </PrimaryButton>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.accounts.deleteTitle(entityLabel)}
        disabled={deleting}
        onPress={confirmDelete}
        style={[styles.deleteBtn, { borderColor: theme.danger, opacity: deleting ? 0.6 : 1 }]}>
        <AppIcon name="trash" color={theme.danger} size={16} />
        <Text style={[styles.deleteText, { color: theme.danger }]}>
          {copy.accounts.deleteTitle(entityLabel)}
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
