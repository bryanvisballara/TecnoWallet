import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon, Card, IconButton, Pill, ProgressBar, ScalePressable, Screen, SectionTitle, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useActiveLedger } from '@/store/ledger';

function bucketForAccount(kind: string) {
  const value = kind.toLowerCase();
  if (value.includes('ahor')) return 'Ahorros';
  if (value.includes('efect')) return 'Efectivo';
  if (value.includes('crédit') || value.includes('credit')) return 'Crédito';
  return 'Corriente';
}

export default function AccountsScreen() {
  const theme = useAppTheme();
  const { accounts, ledger } = useActiveLedger();
  const assets = accounts.filter((item) => item.balance > 0).reduce((sum, item) => sum + item.balance, 0);
  const debt = Math.abs(accounts.filter((item) => item.balance < 0).reduce((sum, item) => sum + item.balance, 0));
  const net = assets - debt;
  const creditDebt = debt;
  const creditUsage = assets + debt > 0 ? debt / (assets + debt) : 0;

  const distribution = useMemo(() => {
    const colors = {
      Corriente: theme.primary,
      Ahorros: theme.success,
      Efectivo: theme.warning,
      Crédito: theme.purple,
    } as const;
    const totals: Record<keyof typeof colors, number> = {
      Corriente: 0,
      Ahorros: 0,
      Efectivo: 0,
      Crédito: 0,
    };
    accounts.forEach((account) => {
      const bucket = bucketForAccount(account.kind) as keyof typeof colors;
      totals[bucket] += Math.abs(account.balance);
    });
    const segments = (Object.keys(totals) as Array<keyof typeof colors>)
      .map((label) => ({ label, amount: totals[label], color: colors[label] }))
      .filter((item) => item.amount > 0);
    const total = segments.reduce((sum, item) => sum + item.amount, 0);
    return { segments, total };
  }, [accounts, theme.primary, theme.success, theme.warning, theme.purple]);

  const healthTone = creditUsage === 0 ? 'neutral' : creditUsage < 0.3 ? 'green' : creditUsage < 0.5 ? 'orange' : 'neutral';
  const healthColor = creditUsage === 0 ? theme.muted : creditUsage < 0.3 ? theme.success : theme.warning;
  const healthCopy =
    creditDebt === 0
      ? 'No hay saldo de crédito pendiente en este libro.'
      : creditUsage < 0.3
        ? 'Bien. La deuda es baja frente a tus activos.'
        : 'La deuda pesa más. Revisa tus tarjetas y pagos.';

  return (
    <Screen withTabBar title="Cuentas" subtitle={`Patrimonio · ${ledger.name}`} right={<IconButton icon="plus" label="Agregar cuenta" />}>
      <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
        <Text style={styles.heroLabel}>Patrimonio neto</Text>
        <Text style={styles.heroValue}>{money(net)}</Text>
        <View style={styles.heroStats}>
          <View><Text style={styles.heroSmall}>Activos</Text><Text style={styles.heroStat}>{money(assets, true)}</Text></View>
          <View style={styles.divider} />
          <View><Text style={styles.heroSmall}>Deudas</Text><Text style={styles.heroStat}>{money(debt, true)}</Text></View>
        </View>
      </Card>

      <Card>
        <View style={uiStyles.between}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Distribución</Text>
          <Pill tone={distribution.total > 0 ? 'blue' : 'neutral'}>
            {distribution.total > 0 ? `${accounts.length} cuenta${accounts.length === 1 ? '' : 's'}` : 'Vacío'}
          </Pill>
        </View>
        {distribution.total === 0 ? (
          <Text style={[styles.small, { color: theme.muted, marginVertical: 16 }]}>
            Aún no hay saldos para distribuir en {ledger.name}.
          </Text>
        ) : (
          <>
            <View style={styles.distribution}>
              {distribution.segments.map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.segment,
                    {
                      flex: Math.max(item.amount / distribution.total, 0.04),
                      backgroundColor: item.color,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.legend}>
              {distribution.segments.map((item) => (
                <View key={item.label} style={[uiStyles.row, uiStyles.gap8]}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <Text style={[styles.small, { color: theme.muted }]}>
                    {item.label} · {money(item.amount, true)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      <SectionTitle action="Administrar">Mis cuentas</SectionTitle>
      {accounts.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            Este libro no tiene cuentas todavía.
          </Text>
        </Card>
      ) : (
        accounts.map((account) => (
          <ScalePressable
            key={account.id}
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
                  <Text style={[styles.small, { color: theme.muted }]}>
                    {account.kind}
                    {account.lastFour === '—' ? '' : ` · •••• ${account.lastFour}`}
                  </Text>
                </View>
                <View style={styles.balanceCopy}>
                  <Text style={[styles.balance, { color: account.balance < 0 ? theme.danger : theme.text }]}>{money(account.balance)}</Text>
                  <Text style={[styles.sync, { color: theme.success }]}>
                    {account.balance === 0 ? 'Sin movimiento' : 'Al día'}
                  </Text>
                </View>
                <AppIcon name="chevron" color={theme.muted} size={15} />
              </View>
            </Card>
          </ScalePressable>
        ))
      )}

      <SectionTitle>Salud financiera</SectionTitle>
      <Card style={styles.health}>
        <View style={uiStyles.between}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Peso de la deuda</Text>
          <Text style={[styles.score, { color: healthColor }]}>{Math.round(creditUsage * 100)}%</Text>
        </View>
        <ProgressBar value={creditUsage} color={healthColor} label="Peso de la deuda" />
        <View style={uiStyles.between}>
          <Text style={[styles.small, { color: theme.muted, flex: 1 }]}>{healthCopy}</Text>
          {creditDebt > 0 ? <Pill tone={healthTone === 'green' ? 'green' : 'orange'}>{money(creditDebt, true)}</Pill> : null}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#0878F9', gap: 8, borderWidth: 0 }, heroLabel: { color: '#DCEBFF', fontSize: 13 },
  heroValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '700', letterSpacing: -1.3 },
  heroStats: { flexDirection: 'row', gap: 28, alignItems: 'center', marginTop: 12 }, heroSmall: { color: '#DCEBFF', fontSize: 11 },
  heroStat: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 2 }, divider: { height: 32, width: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF66' },
  cardTitle: { fontSize: 18, fontWeight: '700' }, distribution: { flexDirection: 'row', gap: 4, height: 13, borderRadius: 8, overflow: 'hidden', marginVertical: 16 },
  segment: { height: 13, borderRadius: 5 }, legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 8 }, dot: { width: 8, height: 8, borderRadius: 4 },
  small: { fontSize: 12, lineHeight: 17 }, accountIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 }, accountName: { fontSize: 15, fontWeight: '600' }, balanceCopy: { alignItems: 'flex-end', gap: 3 },
  balance: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }, sync: { fontSize: 10 }, health: { gap: 13 },
  score: { fontSize: 18, fontWeight: '700' },
});
