import { Redirect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
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
import { copyText } from '@/lib/copy-text';
import { safeGoBack } from '@/lib/navigation';
import {
  getAdminAffiliatePayouts,
  getAdminUserDetail,
  getAdminUserStats,
  payAdminAffiliate,
  searchAdminUsers,
  upgradeAdminUser,
  type AdminAffiliatePayout,
  type AdminPayoutPolicy,
  type AdminPayoutTotals,
  type AdminPlan,
  type AdminUserDetail,
  type AdminUserRow,
  type AdminUserStats,
} from '@/services/admin-api';
import { useAuthStore } from '@/store/auth';

type AdminTab = 'resumen' | 'pagos' | 'usuarios';
type PlanFilter = 'all' | AdminPlan;

const planFilters: { id: PlanFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'free', label: 'Free' },
  { id: 'plus', label: 'Plus' },
  { id: 'business', label: 'Business' },
];

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  paid: 'Pagado',
  reversed: 'Reversado',
};

function formatAdminDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function moneyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

const MAX_PROOF_B64 = 900_000;

async function pickCompressedProof() {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.28,
    base64: true,
  });
  if (picked.canceled || !picked.assets[0]) {
    return { canceled: true as const };
  }
  const asset = picked.assets[0];
  const raw = (asset.base64 ?? '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!raw) {
    return { canceled: true as const };
  }
  const tooLarge = raw.length > MAX_PROOF_B64;
  return {
    canceled: false as const,
    name: asset.fileName || 'comprobante.jpg',
    base64: tooLarge ? undefined : raw,
    omitted: tooLarge,
  };
}

async function copyValue(value: string, okMessage: string) {
  const mode = await copyText(value);
  Alert.alert(
    mode === 'copied' ? 'Copiado' : 'Listo para copiar',
    mode === 'copied' ? okMessage : 'Ábrelo en Notas o Mensajes y cópialo desde ahí.',
  );
}

function payoutOrigin(row: AdminAffiliatePayout) {
  const bounty = row.bountyAmountMinor ?? 500;
  const refs = row.referralCount ?? new Set(row.commissions.map((c) => c.userId)).size;
  const groups = new Map<
    string,
    { count: number; unitMinor: number; commissionMinor: number }
  >();
  for (const item of row.commissions) {
    if (item.status === 'reversed') continue;
    if (item.commissionAmountMinor !== bounty) continue;
    const key = item.planLabel || item.product || 'Plan';
    const cur = groups.get(key) ?? {
      count: 0,
      unitMinor: bounty,
      commissionMinor: 0,
    };
    cur.count += 1;
    cur.commissionMinor += item.commissionAmountMinor;
    groups.set(key, cur);
  }
  return {
    bounty,
    refs,
    groups: [...groups.entries()].map(([label, value]) => ({ label, ...value })),
  };
}

type AdminTheme = ReturnType<typeof useAppTheme>;

function AdminPayoutCard({
  row,
  mode,
  theme,
  open,
  busy,
  onToggle,
  onMarkPaid,
}: {
  row: AdminAffiliatePayout;
  mode: 'request' | 'history';
  theme: AdminTheme;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onMarkPaid?: () => void;
}) {
  const payout = row.payoutMethod;
  const pending = row.pendingMinor ?? 0;
  const paid = row.paidMinor ?? 0;
  const amount = mode === 'history' ? paid : pending;
  const origin = payoutOrigin(row);
  const visibleCommissions =
    mode === 'history'
      ? row.commissions.filter((item) => item.status === 'paid')
      : row.commissions.filter((item) => item.status !== 'reversed');
  return (
    <Card style={styles.block}>
      <Pressable onPress={onToggle} style={styles.between}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.memberName, { color: theme.text }]}>
            {row.affiliateName}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {row.affiliateCode || row.affiliateId}
            {row.email ? ` · ${row.email}` : ''}
          </Text>
          <Text style={[styles.hint, { color: payout ? theme.text : theme.danger }]}>
            {payout
              ? `USDT ${payout.network.toUpperCase()}\n${payout.address}`
              : 'Sin wallet USDT'}
          </Text>
          {mode === 'request' && row.payoutRequestedAt ? (
            <Text style={[styles.hint, { color: theme.muted }]}>
              Solicitó el {formatAdminDate(row.payoutRequestedAt)}
            </Text>
          ) : null}
          {mode === 'history' && row.lastPaidAt ? (
            <Text style={[styles.hint, { color: theme.muted }]}>
              Pagado el {formatAdminDate(row.lastPaidAt)}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[styles.amount, { color: theme.text }]}>
            {moneyMinor(amount, row.currency)}
          </Text>
          <Pill tone={mode === 'history' ? 'green' : 'blue'}>
            {mode === 'history' ? 'Pagado' : 'Solicitado'}
          </Pill>
        </View>
      </Pressable>

      <View
        style={[
          styles.originBox,
          {
            backgroundColor: theme.surfaceSecondary,
            borderColor: theme.border,
          },
        ]}>
        <View style={styles.between}>
          <Text style={[styles.label, { color: theme.text }]}>
            US$ 5 una vez por conversión
          </Text>
          <Pill tone="blue">
            {origin.refs} referido{origin.refs === 1 ? '' : 's'}
          </Pill>
        </View>
        <Text style={[styles.hint, { color: theme.muted }]}>
          Verifica estas conversiones Plus o Business antes de marcar el pago.
        </Text>
        {origin.groups.map((group) => (
          <Text
            key={group.label}
            style={[styles.memberName, { color: theme.text, fontSize: 13 }]}>
            {group.count} × {group.label} ={' '}
            {moneyMinor(group.commissionMinor, row.currency)}
          </Text>
        ))}
      </View>

      {payout ? (
        <Pressable
          onPress={() => {
            void copyValue(
              payout.address,
              `Wallet USDT ${payout.network.toUpperCase()} copiada.`,
            ).catch((cause) =>
              Alert.alert(
                'No se copió',
                cause instanceof Error ? cause.message : 'Intenta de nuevo.',
              ),
            );
          }}
          style={[
            styles.copyBtn,
            {
              borderColor: theme.primary,
              backgroundColor: theme.primarySoft,
            },
          ]}>
          <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
            Copiar wallet
          </Text>
        </Pressable>
      ) : null}

      {mode === 'request' && onMarkPaid ? (
        <PrimaryButton onPress={onMarkPaid}>
          {busy ? 'Pagando…' : 'Marcar como pagado · subir comprobante'}
        </PrimaryButton>
      ) : null}

      <Pressable onPress={onToggle}>
        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
          {open
            ? 'Ocultar afiliados referidos'
            : `Ver afiliados referidos (${visibleCommissions.length})`}
        </Text>
      </Pressable>

      {open
        ? visibleCommissions.map((commission) => (
            <View
              key={commission.id}
              style={[styles.commissionRow, { borderTopColor: theme.border }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.memberName, { color: theme.text }]}>
                  {commission.userLabel}
                </Text>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  {commission.planLabel} · US$ 5 una vez ·{' '}
                  {statusLabel[commission.status]}
                </Text>
              </View>
              <Text style={[styles.amount, { color: theme.text }]}>
                {moneyMinor(commission.commissionAmountMinor, commission.currency)}
              </Text>
            </View>
          ))
        : null}
    </Card>
  );
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
  const [payoutPolicy, setPayoutPolicy] = useState<AdminPayoutPolicy | null>(null);
  const [payoutTotals, setPayoutTotals] = useState<AdminPayoutTotals | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
      const result = await getAdminAffiliatePayouts();
      setPayouts(result.affiliates);
      setPayoutPolicy(result.policy);
      setPayoutTotals(result.totals ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los pagos.');
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  }, []);

  const markAffiliatePaid = useCallback(async (row: AdminAffiliatePayout) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permiso',
        'Necesitas acceso a fotos para adjuntar el comprobante de la transferencia.',
      );
      return;
    }
    const proof = await pickCompressedProof();
    if (proof.canceled) {
      Alert.alert(
        'Comprobante',
        'Sube la captura de la transferencia USDT para enviar el correo y marcar pagado.',
      );
      return;
    }
    setBusyId(row.affiliateId);
    try {
      const result = await payAdminAffiliate(row.affiliateId, {
        note: 'Pago USDT a solicitud del afiliado',
        proofName: proof.name,
        proofBase64: proof.base64,
      });
      Alert.alert(
        'Pagado',
        `${moneyMinor(result.paidMinor, result.currency)} a ${result.wallet.network.toUpperCase()} ${result.wallet.address}\nCorreo ${result.emailDelivered ? 'enviado' : 'registrado'} a ${result.email}.${
          proof.omitted
            ? '\nLa foto era muy pesada: el pago sí quedó, el correo va sin adjunto.'
            : ''
        }\nSaldo del afiliado: USD 0.00`,
      );
      await loadPayouts();
    } catch (cause) {
      Alert.alert(
        'No se pagó',
        cause instanceof Error ? cause.message : 'Revisa wallet, solicitud y comprobante.',
      );
    } finally {
      setBusyId(null);
    }
  }, [loadPayouts]);

  const loadUsers = useCallback(async (q?: string, plan?: PlanFilter) => {
    setUsersLoading(true);
    setError(null);
    try {
      const result = await searchAdminUsers(q, plan ?? planFilter);
      setUsers(result.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar usuarios.');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [planFilter]);

  const openUserDetail = useCallback(async (userId: string) => {
    setSelectedUserId(userId);
    setDetailLoading(true);
    setError(null);
    try {
      setUserDetail(await getAdminUserDetail(userId));
    } catch (cause) {
      setUserDetail(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el usuario.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const applyManualPlan = useCallback(
    async (userId: string, plan: AdminPlan, email: string) => {
      setBusyId(`${userId}-${plan}`);
      try {
        await upgradeAdminUser(
          userId,
          plan === 'free' ? { plan: 'free' } : { plan, months: 1 },
        );
        Alert.alert(
          'Listo',
          plan === 'free'
            ? `${email} → Free`
            : `${email} → ${plan === 'plus' ? 'Plus' : 'Business'} (1 mes)`,
        );
        await Promise.all([
          loadUsers(userQuery, planFilter),
          openUserDetail(userId),
          loadStats(),
        ]);
      } catch (cause) {
        Alert.alert(
          'Error',
          cause instanceof Error ? cause.message : 'No se pudo actualizar.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [loadStats, loadUsers, openUserDetail, planFilter, userQuery],
  );

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'resumen') void loadStats();
    if (tab === 'pagos') void loadPayouts();
    if (tab === 'usuarios') void loadUsers(userQuery, planFilter);
  }, [isAdmin, tab, planFilter, loadStats, loadPayouts, loadUsers]);

  if (!isAdmin) {
    return <Redirect href="/(tabs)/mas" />;
  }

  const pendingToReserve =
    payoutTotals?.pendingMinor ??
    payouts.reduce((sum, row) => sum + (row.pendingMinor ?? 0), 0);
  const paidTotal =
    payoutTotals?.paidMinor ??
    payouts.reduce((sum, row) => sum + (row.paidMinor ?? 0), 0);
  const payoutRequests = payouts.filter(
    (row) => row.payoutRequested && row.pendingMinor > 0,
  );
  const payoutHistory = [...payouts]
    .filter(
      (row) =>
        (row.paidMinor ?? 0) > 0 ||
        (row.pendingMinor <= 0 && (row.commissionTotalMinor ?? 0) > 0),
    )
    .sort((a, b) => {
      const aTime = a.lastPaidAt ? new Date(a.lastPaidAt).getTime() : 0;
      const bTime = b.lastPaidAt ? new Date(b.lastPaidAt).getTime() : 0;
      return bTime - aTime;
    });

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
            Conteos por suscripción real en Mongo. Sin compra = sin plan. Solo el
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
            <Text style={[styles.section, { color: theme.text }]}>Cómo se paga</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              {payoutPolicy?.rule ??
                'A desembolsar es el dinero generado en remuneraciones, aunque aún no lleguen a USD 100. Las solicitudes aparecen cuando el afiliado pide el pago.'}
            </Text>
            <View style={styles.statGrid}>
              <StatCard
                label="A desembolsar"
                value={moneyMinor(pendingToReserve, 'USD')}
                tone={theme.primary}
              />
              <StatCard
                label="Solicitudes"
                value={String(payoutRequests.length)}
                tone={theme.success}
              />
              <StatCard
                label="Pagado"
                value={moneyMinor(paidTotal, 'USD')}
                tone={theme.muted}
              />
              <StatCard
                label="Conversiones"
                value={String(
                  payouts.reduce((sum, row) => sum + (row.referralCount ?? 0), 0),
                )}
                tone={theme.warning}
              />
            </View>
            <PrimaryButton onPress={() => void loadPayouts()}>
              {payoutsLoading ? 'Cargando…' : 'Actualizar'}
            </PrimaryButton>
          </Card>

          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Solicitudes de pago</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Aparecen cuando el afiliado llega a USD 100, guarda su wallet USDT y
              presiona Solicitar pago. Te llega un push y un correo a
              dev@wwtecno.com.
            </Text>
          </Card>

          {payoutsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : payoutRequests.length === 0 ? (
            <Card>
              <Text style={[styles.hint, { color: theme.muted }]}>
                No hay solicitudes. El saldo pendiente se aparta en A desembolsar
                hasta que alguien pida el pago.
              </Text>
            </Card>
          ) : (
            payoutRequests.map((row) => (
              <AdminPayoutCard
                key={`req-${row.affiliateId}`}
                row={row}
                mode="request"
                theme={theme}
                open={expandedId === `req-${row.affiliateId}`}
                busy={busyId === row.affiliateId}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === `req-${row.affiliateId}`
                      ? null
                      : `req-${row.affiliateId}`,
                  )
                }
                onMarkPaid={() => void markAffiliatePaid(row)}
              />
            ))
          )}

          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Historial de pagos</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Pagos ya marcados. El saldo del afiliado vuelve a USD 0 y se le envía
              el correo con el comprobante.
            </Text>
          </Card>

          {!payoutsLoading && payoutHistory.length === 0 ? (
            <Card>
              <Text style={[styles.hint, { color: theme.muted }]}>
                Aún no hay pagos registrados.
              </Text>
            </Card>
          ) : (
            payoutHistory.map((row) => (
              <AdminPayoutCard
                key={`paid-${row.affiliateId}`}
                row={row}
                mode="history"
                theme={theme}
                open={expandedId === `paid-${row.affiliateId}`}
                busy={false}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === `paid-${row.affiliateId}`
                      ? null
                      : `paid-${row.affiliateId}`,
                  )
                }
              />
            ))
          )}
        </>
      ) : null}

      {tab === 'usuarios' ? (
        <>
          <Card style={styles.block}>
            <Text style={[styles.section, { color: theme.text }]}>Usuarios</Text>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Filtra por plan, busca y toca un usuario para ver registro, upgrades, pagos y
              upgrade manual (incluye Free).
            </Text>
            <View style={styles.rowWrap}>
              {planFilters.map((filter) => {
                const selected = planFilter === filter.id;
                return (
                  <Pressable
                    key={filter.id}
                    onPress={() => setPlanFilter(filter.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.primary : theme.surfaceSecondary,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}>
                    <Text
                      style={{
                        color: selected ? '#FFFFFF' : theme.muted,
                        fontWeight: '700',
                        fontSize: 12,
                      }}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
            <PrimaryButton onPress={() => void loadUsers(userQuery, planFilter)}>
              {usersLoading ? 'Buscando…' : 'Buscar'}
            </PrimaryButton>
            {users.map((user) => {
              const selected = selectedUserId === user.id;
              return (
                <Pressable
                  key={user.id}
                  onPress={() => void openUserDetail(user.id)}
                  style={[
                    styles.userRow,
                    {
                      borderTopColor: theme.border,
                      backgroundColor: selected ? theme.primarySoft : 'transparent',
                      borderRadius: selected ? 12 : 0,
                      paddingHorizontal: selected ? 10 : 0,
                      paddingBottom: selected ? 10 : 0,
                    },
                  ]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.memberName, { color: theme.text }]}>{user.name}</Text>
                    <Text style={[styles.hint, { color: theme.muted }]}>
                      {user.email} · {user.plan}
                      {user.provider ? ` · ${user.provider}` : ''}
                    </Text>
                  </View>
                  <Pill
                    tone={
                      user.plan === 'business'
                        ? 'green'
                        : user.plan === 'plus'
                          ? 'blue'
                          : 'neutral'
                    }>
                    {user.plan}
                  </Pill>
                </Pressable>
              );
            })}
            {!usersLoading && users.length === 0 ? (
              <Text style={[styles.hint, { color: theme.muted }]}>
                No hay usuarios para este filtro.
              </Text>
            ) : null}
          </Card>

          {selectedUserId ? (
            <Card style={styles.block}>
              {detailLoading || !userDetail ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <>
                  <View style={styles.between}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.section, { color: theme.text }]}>
                        {userDetail.user.name}
                      </Text>
                      <Text style={[styles.hint, { color: theme.muted }]}>
                        {userDetail.user.email}
                      </Text>
                    </View>
                    <Pill
                      tone={
                        userDetail.plan === 'business'
                          ? 'green'
                          : userDetail.plan === 'plus'
                            ? 'blue'
                            : 'neutral'
                      }>
                      {userDetail.plan}
                    </Pill>
                  </View>

                  <View style={styles.detailGrid}>
                    <Text style={[styles.label, { color: theme.muted }]}>Registro</Text>
                    <Text style={[styles.hint, { color: theme.text }]}>
                      {formatAdminDate(userDetail.user.createdAt)}
                    </Text>
                    <Text style={[styles.label, { color: theme.muted }]}>Plan actual</Text>
                    <Text style={[styles.hint, { color: theme.text }]}>
                      {userDetail.plan}
                      {userDetail.subscription?.provider
                        ? ` · ${userDetail.subscription.provider}`
                        : ''}
                      {userDetail.subscription?.expiresAt
                        ? ` · vence ${formatAdminDate(userDetail.subscription.expiresAt)}`
                        : ''}
                    </Text>
                    <Text style={[styles.label, { color: theme.muted }]}>Último upgrade</Text>
                    <Text style={[styles.hint, { color: theme.text }]}>
                      {userDetail.subscription?.purchasedAt
                        ? formatAdminDate(userDetail.subscription.purchasedAt)
                        : '—'}
                    </Text>
                  </View>

                  <Text style={[styles.label, { color: theme.text }]}>Upgrade manual</Text>
                  <View style={styles.rowWrap}>
                    {([
                      { plan: 'free' as const, label: '→ Free', color: theme.muted },
                      { plan: 'plus' as const, label: '→ Plus', color: theme.primary },
                      { plan: 'business' as const, label: '→ Business', color: theme.success },
                    ]).map((action) => (
                      <Pressable
                        key={action.plan}
                        disabled={Boolean(busyId)}
                        onPress={() =>
                          void applyManualPlan(
                            userDetail.user.id,
                            action.plan,
                            userDetail.user.email,
                          )
                        }
                        style={[
                          styles.chip,
                          {
                            borderColor: action.color,
                            backgroundColor: theme.surfaceSecondary,
                            opacity: busyId === `${userDetail.user.id}-${action.plan}` ? 0.6 : 1,
                          },
                        ]}>
                        <Text style={{ color: action.color, fontWeight: '800', fontSize: 12 }}>
                          {busyId === `${userDetail.user.id}-${action.plan}`
                            ? '…'
                            : action.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.label, { color: theme.text }]}>Historial de upgrades</Text>
                  {userDetail.upgrades.length === 0 ? (
                    <Text style={[styles.hint, { color: theme.muted }]}>Sin upgrades aún.</Text>
                  ) : (
                    userDetail.upgrades.slice(0, 8).map((item, index) => (
                      <View
                        key={`${item.at}-${item.productId}-${index}`}
                        style={[styles.historyRow, { borderTopColor: theme.border }]}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.memberName, { color: theme.text, fontSize: 13 }]}>
                            {item.plan}
                          </Text>
                          <Text style={[styles.hint, { color: theme.muted }]}>
                            {formatAdminDate(item.at)} · {item.provider} · {item.status}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={[styles.label, { color: theme.text }]}>Pagos / comisiones</Text>
                  {userDetail.payments.length === 0 ? (
                    <Text style={[styles.hint, { color: theme.muted }]}>
                      No hay pagos de suscripción registrados para este usuario.
                    </Text>
                  ) : (
                    userDetail.payments.slice(0, 8).map((payment) => (
                      <View
                        key={payment.id}
                        style={[styles.historyRow, { borderTopColor: theme.border }]}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.memberName, { color: theme.text, fontSize: 13 }]}>
                            {payment.planLabel}
                          </Text>
                          <Text style={[styles.hint, { color: theme.muted }]}>
                            {formatAdminDate(payment.at)} · {payment.eventType} ·{' '}
                            {statusLabel[payment.status] || payment.status}
                          </Text>
                        </View>
                        <Text style={[styles.amount, { color: theme.text }]}>
                          {moneyMinor(payment.amountMinor, payment.currency)}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </Card>
          ) : null}
        </>
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
  originBox: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },
  copyBtn: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
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
  detailGrid: { gap: 6 },
  historyRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  error: { color: '#E5484D', fontSize: 13 },
});
