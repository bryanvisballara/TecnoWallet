import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { safeGoBack } from '@/lib/navigation';
import {
  enrollAffiliatePartner,
  getAffiliatePartnerDashboard,
  type AffiliatePartnerDashboard,
} from '@/services/affiliate-api';

function moneyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function tierTone(id: string): 'green' | 'blue' | 'neutral' {
  if (id === 'ambassador') return 'blue';
  if (id === 'creator') return 'green';
  return 'neutral';
}

export default function AffiliatesScreen() {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AffiliatePartnerDashboard | null>(null);
  const [customCode, setCustomCode] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getAffiliatePartnerDashboard();
      setDashboard(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No pudimos cargar el panel de afiliados.',
      );
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = customCode.trim().toUpperCase();
      await enrollAffiliatePartner(code || undefined);
      await load();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No pudimos activar tu perfil.',
      );
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async (shareUrl: string, code: string) => {
    try {
      await Share.share({
        message: `Únete a TecnoWallet con mi enlace: ${shareUrl} (código ${code})`,
        url: shareUrl,
      });
    } catch {
      Alert.alert('Tu enlace', shareUrl);
    }
  };

  if (loading) {
    return (
      <Screen
        withTabBar
        title="Afiliados"
        subtitle="Tu enlace y comisiones"
        right={
          <Pressable
            onPress={() => safeGoBack('/(tabs)/mas')}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
        }>
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </Screen>
    );
  }

  if (!dashboard || !dashboard.enrolled) {
    return (
      <Screen
        withTabBar
        title="Afiliados"
        subtitle="Gana comisiones recomendando TecnoWallet"
        right={
          <Pressable
            onPress={() => safeGoBack('/(tabs)/mas')}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
        }>
        <Card style={styles.heroCard}>
          <View style={[styles.icon, { backgroundColor: theme.successSoft }]}>
            <AppIcon name="gift.fill" color={theme.success} size={28} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.text }]}>
            Programa de afiliados
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            Comparte tu enlace. Cuando alguien se registre y pase a TecnoWallet+ o
            Business, ganas comisión según tu nivel (Partner 20%, Creator 30%,
            Ambassador 40%).
          </Text>
        </Card>

        <Card style={styles.list}>
          <Text style={[styles.sectionLabel, { color: theme.muted }]}>
            CÓDIGO (OPCIONAL)
          </Text>
          <TextInput
            value={customCode}
            onChangeText={(value) =>
              setCustomCode(value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 24))
            }
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Ej. TECNO10"
            placeholderTextColor={theme.muted}
            style={[
              styles.codeInput,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surfaceSecondary,
              },
            ]}
          />
          <Text style={[styles.hint, { color: theme.muted }]}>
            Si lo dejas vacío, generamos uno a partir de tu nombre.
          </Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          icon="sparkles"
          onPress={() => {
            void enroll();
          }}>
          {busy ? 'Activando…' : 'Activar programa'}
        </PrimaryButton>
      </Screen>
    );
  }

  const { affiliate, shareUrl, tier, stats, referred } = dashboard;

  return (
    <Screen
      withTabBar
      title="Afiliados"
      subtitle={affiliate.name}
      right={
        <Pressable
          onPress={() => safeGoBack('/(tabs)/mas')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }>
      <Card style={styles.list}>
        <View style={uiStyles.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>CÓDIGO</Text>
            <Text style={[styles.code, { color: theme.text }]}>{affiliate.code}</Text>
            <Text style={[styles.hint, { color: theme.muted }]} numberOfLines={2}>
              {shareUrl}
            </Text>
          </View>
          <Pill tone={tierTone(tier.id)}>
            {tier.label} · {tier.commissionPercent}%
          </Pill>
        </View>
        <View style={[styles.actions, { marginTop: 14 }]}>
          <PrimaryButton
            icon="square.and.arrow.up"
            onPress={() => {
              void copyShare(shareUrl, affiliate.code);
            }}>
            Compartir enlace
          </PrimaryButton>
        </View>
      </Card>

      <Card style={styles.statsCard}>
        <StatRow label="Clicks" value={String(stats.clicks)} />
        <StatRow label="Descargas" value={String(stats.downloads)} />
        <StatRow label="Registros" value={String(stats.signups)} />
        <StatRow label="TecnoWallet+" value={String(stats.plusConversions)} />
        <StatRow label="Conversión" value={`${stats.conversionRate}%`} last />
      </Card>

      <Card style={styles.statsCard}>
        <StatRow
          label="Ingresos generados"
          value={moneyMinor(stats.revenueGeneratedMinor, stats.currency)}
        />
        <StatRow
          label="Comisión acumulada"
          value={moneyMinor(stats.commissionTotalMinor, stats.currency)}
        />
        <StatRow
          label="Comisión pagada"
          value={moneyMinor(stats.commissionPaidMinor, stats.currency)}
        />
        <StatRow
          label="Pendiente de pago"
          value={moneyMinor(stats.commissionPendingMinor, stats.currency)}
          last
        />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Niveles</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Partner 1–100 (20%) · Creator 101–500 (30%) · Ambassador 501+ (40%). Hoy
          tienes {tier.activePaidCount} usuario{tier.activePaidCount === 1 ? '' : 's'}{' '}
          de pago activo{tier.activePaidCount === 1 ? '' : 's'}.
        </Text>
      </Card>

      <Card style={styles.list}>
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 8 }]}>
          Usuarios referidos
        </Text>
        {referred.length === 0 ? (
          <Text style={[styles.body, { color: theme.muted, marginTop: 0 }]}>
            Aún no hay registros con tu enlace o código. Comparte tu link para
            empezar.
          </Text>
        ) : (
          referred.map((row, index) => (
            <View
              key={row.userId}
              style={[
                styles.refRow,
                index > 0 && {
                  borderTopColor: theme.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.refName, { color: theme.text }]}>{row.label}</Text>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  {formatDate(row.attributedAt)} · {row.plan} · {row.status}
                </Text>
              </View>
              <Text style={[styles.refCommission, { color: theme.text }]}>
                {moneyMinor(row.commissionMinor, row.currency)}
              </Text>
            </View>
          ))
        )}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {Platform.OS === 'web' ? null : null}
    </Screen>
  );
}

function StatRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.statRow,
        !last && {
          borderBottomColor: theme.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
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
  center: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  heroCard: { gap: 12, alignItems: 'flex-start' },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  body: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  list: { gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  codeInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  hint: { fontSize: 12, lineHeight: 16 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  actions: { width: '100%' },
  statsCard: { paddingVertical: 4 },
  statRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: { fontSize: 14 },
  statValue: { fontSize: 15, fontWeight: '700' },
  refRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refName: { fontSize: 14, fontWeight: '600' },
  refCommission: { fontSize: 14, fontWeight: '700' },
  error: { color: '#E5484D', fontSize: 13, marginTop: 8 },
});
