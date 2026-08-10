import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, Screen, useAppTheme } from '@/components/ui';
import { safeGoBack } from '@/lib/navigation';
import {
  approveAdminCommission,
  getAdminAffiliatePayouts,
  getAdminUserStats,
  markAdminCommissionsPaid,
  searchAdminUsers,
  upgradeAdminUser,
  type AdminAffiliatePayout,
  type AdminUserRow,
  type AdminUserStats,
} from '@/services/admin-api';
import { useAuthStore } from '@/store/auth';

type AdminTab = 'resumen' | 'pagos' | 'usuarios';

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  paid: 'Pagado',
  reversed: 'Reversado',
};

function moneyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function previousMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));
  return { from: toInputDate(from), to: toInputDate(to) };
}

export default function AdminPortalScreen() {
  const theme = useAppTheme();
  const platformRole = useAuthStore((state) => state.profile.platformRole);
  const isAdmin = platformRole === 'admin';
  const [tab, setTab] = useState<AdminTab>('resumen');
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [payouts, setPayouts] = useState<AdminAffiliatePayout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const month = useMemo(() => previousMonthRange(), []);
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setError(null);
    try {
      setStats(await getAdminUserStats());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las métricas.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    setError(null);
    try {
      const result = await getAdminAffiliatePayouts({
        from: from || undefined,
        to: to || undefined,
        status: statusFilter || undefined,
      });
      setPayouts(result.affiliates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los pagos.');
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  }, [from, to, statusFilter]);

  const loadUsers = useCallback(async (q?: string) => {
    setUsersLoading(true);
    setError(null);
    try {
      const result = await searchAdminUsers(q);
      setUsers(result.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar usuarios.');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'resumen') void loadStats();
    if (tab === 'pagos') void loadPayouts();
    if (tab === 'usuarios') void loadUsers(userQuery);
  }, [isAdmin, tab, loadStats, loadPayouts, loadUsers, userQuery]);

  if (!isAdmin) {
    return <Redirect href="/(tabs)/mas" />;
  }

  return (
    <Screen
      withTabBar
      title="Portal admin"
      subtitle="Métricas, afiliados y upgrades"
      right={
        <Pressable
          onPress={() => safeGoBack('/(tabs)/mas')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <View style={styles.tabs}>
        {(
          [
            ['resumen', 'Resumen'],
            ['pagos', 'Afiliados → Pagos'],
            ['usuarios', 'Usuarios'],
          ] as const
        ).map(([id, label]) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? theme.primarySoft : theme.surfaceSecondary,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}>
              <Text
                style={{
                  color: active ? theme.primary : theme.text,
                  fontWeight: '700',
                  fontSize: 12,
                }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === 'resumen' ? (
        <Card style={styles.block}>
          <Text style={[styles.section, { color: theme.text }]}>Usuarios</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Conteos por suscripción real en Mongo. Sin compra = Free. Solo el
            owner (`mercancias.visbal@gmail.com`) arranca como Business.
          </Text>
          {statsLoading || !stats ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <View style={styles.statGrid}>
              <StatCard label="Total" value={String(stats.total)} tone={theme.primary} />
              <StatCard label="Free" value={String(stats.free)} tone={theme.muted} />
              <StatCard label="Plus" value={String(stats.plus)} tone={theme.warning} />
              <StatCard label="Business" value={String(stats.business)} tone={theme.success} />
            </View>
          )}
          <PrimaryButton onPress={() => void loadStats()}>Actualizar</PrimaryButton>
        </Card>
      ) : null}

      {tab === 'pagos' ? (
        <>
          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Filtro de fechas</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Las comisiones se consolidan mensualmente. Por defecto: mes anterior. Aprueba y
              marca pagadas tras transferir USDT (~día 15).
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.label, { color: theme.muted }]}>Desde</Text>
                <TextInput
                  value={from}
                  onChangeText={setFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceSecondary,
                    },
                  ]}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.label, { color: theme.muted }]}>Hasta</Text>
                <TextInput
                  value={to}
                  onChangeText={setTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceSecondary,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.rowWrap}>
              {['', 'pending', 'approved', 'paid', 'reversed'].map((value) => {
                const active = statusFilter === value;
                const label = value ? statusLabel[value] : 'Todos';
                return (
                  <Pressable
                    key={value || 'all'}
                    onPress={() => setStatusFilter(value)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active
                          ? theme.primarySoft
                          : theme.surfaceSecondary,
                      },
                    ]}>
                    <Text
                      style={{
                        color: active ? theme.primary : theme.text,
                        fontWeight: '700',
                        fontSize: 12,
                      }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <PrimaryButton onPress={() => void loadPayouts()}>
              {payoutsLoading ? 'Cargando…' : 'Aplicar filtro'}
            </PrimaryButton>
            <PrimaryButton
              onPress={() => {
                void (async () => {
                  try {
                    const result = await markAdminCommissionsPaid({
                      from: from || undefined,
                      to: to || undefined,
                      note: 'Pago mensual consolidado',
                    });
                    Alert.alert(
                      'Pagos marcados',
                      `Se actualizaron ${result.modified} comisión(es).`,
                    );
                    await loadPayouts();
                  } catch (cause) {
                    Alert.alert(
                      'Error',
                      cause instanceof Error ? cause.message : 'No se pudo marcar como pagado.',
                    );
                  }
                })();
              }}>
              Marcar periodo como pagado
            </PrimaryButton>
          </Card>

          {payoutsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : payouts.length === 0 ? (
            <Card>
              <Text style={[styles.hint, { color: theme.muted }]}>
                No hay comisiones en este rango.
              </Text>
            </Card>
          ) : (
            payouts.map((row) => {
              const open = expandedId === row.affiliateId;
              const payout = row.payoutMethod;
              return (
                <Card key={row.affiliateId} style={styles.block}>
                  <Pressable
                    onPress={() =>
                      setExpandedId(open ? null : row.affiliateId)
                    }
                    style={styles.between}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.memberName, { color: theme.text }]}>
                        {row.affiliateName}
                      </Text>
                      <Text style={[styles.hint, { color: theme.muted }]}>
                        {row.affiliateCode || row.affiliateId}
                      </Text>
                      <Text style={[styles.hint, { color: theme.muted }]}>
                        {payout
                          ? `USDT ${payout.network.toUpperCase()} · ${payout.address}`
                          : 'Sin método de pago'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={[styles.amount, { color: theme.text }]}>
                        {moneyMinor(row.commissionTotalMinor, row.currency)}
                      </Text>
                      <Pill
                        tone={
                          row.status === 'paid'
                            ? 'green'
                            : row.status === 'pending' || row.status === 'approved'
                              ? 'orange'
                              : 'neutral'
                        }>
                        {statusLabel[row.status] ?? row.status}
                      </Pill>
                    </View>
                  </Pressable>

                  {open
                    ? row.commissions.map((commission) => (
                        <View
                          key={commission.id}
                          style={[
                            styles.commissionRow,
                            { borderTopColor: theme.border },
                          ]}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={[styles.memberName, { color: theme.text }]}>
                              {commission.userLabel}
                            </Text>
                            <Text style={[styles.hint, { color: theme.muted }]}>
                              {commission.planLabel} · {commission.commissionRate}% ·{' '}
                              {statusLabel[commission.status]}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 8 }}>
                            <Text style={[styles.amount, { color: theme.text }]}>
                              {moneyMinor(
                                commission.commissionAmountMinor,
                                commission.currency,
                              )}
                            </Text>
                            {commission.status === 'pending' ? (
                              <Pressable
                                onPress={() => {
                                  void (async () => {
                                    setBusyId(commission.id);
                                    try {
                                      await approveAdminCommission(commission.id);
                                      await loadPayouts();
                                    } catch (cause) {
                                      Alert.alert(
                                        'Error',
                                        cause instanceof Error
                                          ? cause.message
                                          : 'No se pudo aprobar.',
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  })();
                                }}>
                                <Text style={{ color: theme.primary, fontWeight: '700' }}>
                                  {busyId === commission.id ? '…' : 'Aprobar'}
                                </Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      ))
                    : null}
                </Card>
              );
            })
          )}
        </>
      ) : null}

      {tab === 'usuarios' ? (
        <Card style={styles.block}>
          <Text style={[styles.section, { color: theme.text }]}>Upgrade manual</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Busca por correo o nombre y asigna Plus o Business (provider manual).
          </Text>
          <TextInput
            value={userQuery}
            onChangeText={setUserQuery}
            placeholder="Buscar usuario…"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surfaceSecondary,
              },
            ]}
          />
          <PrimaryButton onPress={() => void loadUsers(userQuery)}>
            {usersLoading ? 'Buscando…' : 'Buscar'}
          </PrimaryButton>
          {users.map((user) => (
            <View
              key={user.id}
              style={[styles.userRow, { borderTopColor: theme.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.memberName, { color: theme.text }]}>{user.name}</Text>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  {user.email} · {user.plan}
                  {user.provider ? ` · ${user.provider}` : ''}
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                <Pressable
                  onPress={() => {
                    void (async () => {
                      setBusyId(`${user.id}-plus`);
                      try {
                        await upgradeAdminUser(user.id, { plan: 'plus', months: 1 });
                        Alert.alert('Listo', `${user.email} → Plus (1 mes)`);
                        await loadUsers(userQuery);
                      } catch (cause) {
                        Alert.alert(
                          'Error',
                          cause instanceof Error ? cause.message : 'No se pudo actualizar.',
                        );
                      } finally {
                        setBusyId(null);
                      }
                    })();
                  }}>
                  <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>
                    {busyId === `${user.id}-plus` ? '…' : '→ Plus'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void (async () => {
                      setBusyId(`${user.id}-business`);
                      try {
                        await upgradeAdminUser(user.id, {
                          plan: 'business',
                          months: 1,
                        });
                        Alert.alert('Listo', `${user.email} → Business (1 mes)`);
                        await loadUsers(userQuery);
                      } catch (cause) {
                        Alert.alert(
                          'Error',
                          cause instanceof Error ? cause.message : 'No se pudo actualizar.',
                        );
                      } finally {
                        setBusyId(null);
                      }
                    })();
                  }}>
                  <Text style={{ color: theme.success, fontWeight: '700', fontSize: 12 }}>
                    {busyId === `${user.id}-business` ? '…' : '→ Business'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
      ]}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  block: { gap: 12 },
  section: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 10 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  between: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberName: { fontSize: 15, fontWeight: '700' },
  amount: { fontSize: 15, fontWeight: '800' },
  commissionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  userRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  error: { color: '#E5484D', fontSize: 13 },
});
