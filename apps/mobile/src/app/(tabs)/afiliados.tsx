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
import { useAppCopy } from '@/i18n/app-copy';
import { intlLocale } from '@/i18n/locale-format';
import { copyText } from '@/lib/copy-text';
import { safeGoBack } from '@/lib/navigation';
import {
  enrollAffiliatePartner,
  getAffiliatePartnerDashboard,
  updateAffiliatePayout,
  type AffiliatePartnerDashboard,
  type AffiliateUsdtNetwork,
} from '@/services/affiliate-api';
import { isBusinessPlan } from '@/services/plus-api';
import { useLanguageStore } from '@/store/language';
import { usePlusStore } from '@/store/plus';
import { ApiError } from '@/services/api';

const USDT_NETWORKS: { id: AffiliateUsdtNetwork; label: string; hint: string }[] = [
  { id: 'bep20', label: 'BEP20', hint: 'BNB Smart Chain' },
  { id: 'trc20', label: 'TRC20', hint: 'Tron' },
  { id: 'erc20', label: 'ERC20', hint: 'Ethereum' },
  { id: 'sol', label: 'SOL', hint: 'Solana' },
];

function moneyMinor(amountMinor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
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

function affiliateTierGuide(locale: string) {
  if (locale === 'es') {
    return [
      {
        id: 'partner' as const,
        label: 'Partner',
        percent: 20,
        range: '1–100',
        how: 'Con 1 a 100 referidos con Plus o Business activos',
        until: 'Mientras te mantengas en ese rango',
      },
      {
        id: 'creator' as const,
        label: 'Creator',
        percent: 30,
        range: '101–500',
        how: 'Con 101 a 500 referidos de pago activos',
        until: 'Mientras te mantengas en ese rango',
      },
      {
        id: 'ambassador' as const,
        label: 'Ambassador',
        percent: 40,
        range: '501+',
        how: 'Con 501 o más referidos de pago activos',
        until: 'Mientras mantengas 501+ activos',
      },
    ] as const;
  }
  return [
    {
      id: 'partner' as const,
      label: 'Partner',
      percent: 20,
      range: '1–100',
      how: 'With 1 to 100 referrals on active Plus or Business',
      until: 'While you stay in that range',
    },
    {
      id: 'creator' as const,
      label: 'Creator',
      percent: 30,
      range: '101–500',
      how: 'With 101 to 500 active paid referrals',
      until: 'While you stay in that range',
    },
    {
      id: 'ambassador' as const,
      label: 'Ambassador',
      percent: 40,
      range: '501+',
      how: 'With 501 or more active paid referrals',
      until: 'While you keep 501+ active',
    },
  ] as const;
}

function nextTierHint(activePaidCount: number, locale: string) {
  if (locale === 'es') {
    if (activePaidCount >= 501) return 'Ya estás en el nivel máximo.';
    if (activePaidCount >= 101) {
      const left = 501 - activePaidCount;
      return `Te faltan ${left} referidos activos para Ambassador (40%).`;
    }
    if (activePaidCount >= 1) {
      const left = 101 - activePaidCount;
      return `Te faltan ${left} referidos activos para Creator (30%).`;
    }
    return 'Empiezas como Partner (20%). Tu primer referido de pago activa el conteo.';
  }
  if (activePaidCount >= 501) return 'You’re already at the top tier.';
  if (activePaidCount >= 101) {
    const left = 501 - activePaidCount;
    return `You need ${left} more active referrals for Ambassador (40%).`;
  }
  if (activePaidCount >= 1) {
    const left = 101 - activePaidCount;
    return `You need ${left} more active referrals for Creator (30%).`;
  }
  return 'You start as Partner (20%). Your first paid referral starts the count.';
}

function AffiliateTiersGuide({
  activeId,
  activePaidCount,
  revenueShareMonths,
}: {
  activeId?: 'partner' | 'creator' | 'ambassador';
  activePaidCount?: number;
  revenueShareMonths: number;
}) {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const tiers = affiliateTierGuide(locale);
  const showProgress = typeof activePaidCount === 'number';

  return (
    <Card style={styles.tiersCard}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{copy.affiliates.tiers}</Text>
      <Text style={[styles.body, { color: theme.muted, marginTop: 4 }]}>
        {locale === 'es'
          ? 'Tu nivel depende de cuántos referidos tienen hoy Plus o Business activos. Si dejan de pagar, el conteo baja y puedes cambiar de nivel.'
          : 'Your tier depends on how many referrals currently have active Plus or Business. If they stop paying, the count drops and your tier can change.'}
      </Text>

      <View style={styles.tierList}>
        {tiers.map((tier) => {
          const active = activeId === tier.id;
          const tone = tierTone(tier.id);
          const soft =
            tone === 'blue'
              ? theme.primarySoft
              : tone === 'green'
                ? theme.successSoft
                : theme.surfaceSecondary;
          const accent =
            tone === 'blue'
              ? theme.primary
              : tone === 'green'
                ? theme.success
                : theme.muted;
          return (
            <View
              key={tier.id}
              style={[
                styles.tierRow,
                {
                  backgroundColor: active ? soft : theme.surfaceSecondary,
                  borderColor: active ? accent : theme.border,
                },
              ]}>
              <View style={styles.tierHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.tierLabel, { color: theme.text }]}>
                    {tier.label}
                    {active ? ` · ${copy.affiliates.yourLevel}` : ''}
                  </Text>
                  <Text style={[styles.tierRange, { color: accent }]}>
                    {tier.percent}%{' '}
                    {locale === 'es' ? 'comisión' : 'commission'} · {tier.range}{' '}
                    {locale === 'es' ? 'activos' : 'active'}
                  </Text>
                </View>
                <Pill tone={tone}>{tier.percent}%</Pill>
              </View>
              <Text style={[styles.tierMeta, { color: theme.muted }]}>
                {copy.affiliates.how} {tier.how}
              </Text>
              <Text style={[styles.tierMeta, { color: theme.muted }]}>
                {copy.affiliates.until} {tier.until}
              </Text>
            </View>
          );
        })}
      </View>

      {showProgress ? (
        <Text style={[styles.tierFoot, { color: theme.text }]}>
          {locale === 'es'
            ? `Hoy: ${activePaidCount} referido${activePaidCount === 1 ? '' : 's'} de pago activo${activePaidCount === 1 ? '' : 's'}. `
            : `Today: ${activePaidCount} active paid referral${activePaidCount === 1 ? '' : 's'}. `}
          {nextTierHint(activePaidCount, locale)}
        </Text>
      ) : null}

      <Text style={[styles.tierFoot, { color: theme.muted }]}>
        {locale === 'es'
          ? `Por cada referido, comisionas durante ${revenueShareMonths} meses desde que se registra con tu enlace o código.`
          : `For each referral, you earn commission for ${revenueShareMonths} months from when they sign up with your link or code.`}
      </Text>
    </Card>
  );
}

export default function AffiliatesScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);
  const isBusiness = isBusinessPlan(plusAccess);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AffiliatePartnerDashboard | null>(null);
  const [customCode, setCustomCode] = useState('');
  const [payoutNetwork, setPayoutNetwork] = useState<AffiliateUsdtNetwork>('bep20');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutSaved, setPayoutSaved] = useState(false);

  const load = useCallback(async () => {
    if (!isBusiness) {
      setDashboard(null);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await getAffiliatePartnerDashboard();
      setDashboard(data);
      if (data.enrolled && data.affiliate.payoutMethod) {
        setPayoutNetwork(data.affiliate.payoutMethod.network);
        setPayoutAddress(data.affiliate.payoutMethod.address);
      }
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.code === 'BUSINESS_REQUIRED' || cause.status === 402)
      ) {
        setDashboard(null);
        setError(null);
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No pudimos cargar el panel de afiliados.',
        );
        setDashboard(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isBusiness]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const enroll = async () => {
    if (!isBusiness) {
      openPaywall('UPGRADE', { plan: 'business' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const code = customCode.trim().toUpperCase();
      await enrollAffiliatePartner(code || undefined);
      await load();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.code === 'BUSINESS_REQUIRED' || cause.status === 402)
      ) {
        openPaywall('UPGRADE', { plan: 'business' });
      } else {
        setError(
          cause instanceof Error ? cause.message : 'No pudimos activar tu perfil.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const copyShare = async (shareUrl: string, code: string) => {
    try {
      await Share.share({
        message:
          locale === 'es'
            ? `Únete a TecnoWallet con mi enlace: ${shareUrl} (código ${code})`
            : `Join TecnoWallet with my link: ${shareUrl} (code ${code})`,
        url: shareUrl,
      });
    } catch {
      Alert.alert(locale === 'es' ? 'Tu enlace' : 'Your link', shareUrl);
    }
  };

  const copyValue = async (value: string, okEs: string, okEn: string) => {
    try {
      const mode = await copyText(value);
      if (mode === 'copied') {
        Alert.alert(locale === 'es' ? 'Copiado' : 'Copied', locale === 'es' ? okEs : okEn);
        return;
      }
      Alert.alert(
        locale === 'es' ? 'Listo para copiar' : 'Ready to copy',
        locale === 'es'
          ? 'Ábrelo en Notas o Mensajes y cópialo desde ahí.'
          : 'Open it in Notes or Messages and copy it from there.',
      );
    } catch (cause) {
      Alert.alert(
        locale === 'es' ? 'No se copió' : 'Could not copy',
        cause instanceof Error
          ? cause.message
          : locale === 'es'
            ? 'Intenta de nuevo.'
            : 'Try again.',
      );
    }
  };

  const savePayout = async () => {
    const address = payoutAddress.trim();
    if (!address) {
      setError('Ingresa la dirección de tu wallet USDT.');
      return;
    }
    setPayoutBusy(true);
    setError(null);
    setPayoutSaved(false);
    try {
      const result = await updateAffiliatePayout({
        network: payoutNetwork,
        address,
      });
      setDashboard((prev) => {
        if (!prev || !prev.enrolled) return prev;
        return {
          ...prev,
          affiliate: {
            ...prev.affiliate,
            ...result.affiliate,
            payoutMethod: result.payoutMethod,
          },
        };
      });
      if (result.payoutMethod) {
        setPayoutNetwork(result.payoutMethod.network);
        setPayoutAddress(result.payoutMethod.address);
      }
      setPayoutSaved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.code === 'BUSINESS_REQUIRED' || cause.status === 402)
      ) {
        openPaywall('UPGRADE', { plan: 'business' });
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No pudimos guardar el método de pago.',
        );
      }
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen
        withTabBar
        title={copy.affiliates.title}
        subtitle={copy.affiliates.subtitle}
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

  if (!isBusiness) {
    return (
      <Screen
        withTabBar
        title={copy.affiliates.title}
        subtitle={copy.affiliates.businessRequired}
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
            {copy.affiliates.title}
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {locale === 'es'
              ? 'Primero necesitas TecnoWallet Business. Con Business se te habilita el programa de afiliados para compartir tu enlace y ganar comisiones.'
              : 'You need TecnoWallet Business first. Business unlocks the affiliate program so you can share your link and earn commissions.'}
          </Text>
        </Card>

        <PrimaryButton
          icon="briefcase.fill"
          onPress={() => openPaywall('UPGRADE', { plan: 'business' })}>
          {copy.affiliates.upgradeBusiness}
        </PrimaryButton>
      </Screen>
    );
  }

  if (!dashboard || !dashboard.enrolled) {
    return (
      <Screen
        withTabBar
        title={copy.affiliates.title}
        subtitle={
          locale === 'es'
            ? 'Gana comisiones recomendando TecnoWallet'
            : 'Earn commissions by recommending TecnoWallet'
        }
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
            {copy.affiliates.title}
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {locale === 'es'
              ? 'Comparte tu enlace. Cuando alguien se registre y pase a TecnoWallet+ o Business, ganas comisión según tu nivel.'
              : 'Share your link. When someone signs up and upgrades to TecnoWallet+ or Business, you earn commission based on your tier.'}
          </Text>
        </Card>

        <AffiliateTiersGuide revenueShareMonths={12} />

        <Card style={styles.list}>
          <Text style={[styles.sectionLabel, { color: theme.muted }]}>
            {locale === 'es' ? 'CÓDIGO (OPCIONAL)' : 'CODE (OPTIONAL)'}
          </Text>
          <TextInput
            value={customCode}
            onChangeText={(value) =>
              setCustomCode(value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 24))
            }
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={locale === 'es' ? 'Ej. TECNO10' : 'e.g. TECNO10'}
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
            {locale === 'es'
              ? 'Si lo dejas vacío, generamos uno a partir de tu nombre.'
              : 'If you leave it blank, we generate one from your name.'}
          </Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          icon="sparkles"
          onPress={() => {
            void enroll();
          }}>
          {busy ? copy.affiliates.activating : copy.affiliates.activate}
        </PrimaryButton>
      </Screen>
    );
  }

  const { affiliate, shareUrl, tier, stats, referred } = dashboard;

  return (
    <Screen
      withTabBar
      title={copy.affiliates.title}
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
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>
              {locale === 'es' ? 'CÓDIGO' : 'CODE'}
            </Text>
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
            {copy.affiliates.shareLink}
          </PrimaryButton>
          <View style={styles.copyRow}>
            <Pressable
              onPress={() => {
                void copyValue(
                  affiliate.code,
                  'Código copiado.',
                  'Code copied.',
                );
              }}
              style={[
                styles.copyChip,
                { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
              ]}>
              <Text style={[styles.copyChipText, { color: theme.text }]}>
                {locale === 'es' ? 'Copiar código' : 'Copy code'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void copyValue(
                  shareUrl,
                  'Enlace copiado.',
                  'Link copied.',
                );
              }}
              style={[
                styles.copyChip,
                { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
              ]}>
              <Text style={[styles.copyChipText, { color: theme.text }]}>
                {locale === 'es' ? 'Copiar enlace' : 'Copy link'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <Card style={styles.statsCard}>
        <StatRow label="Clicks" value={String(stats.clicks)} />
        <StatRow label={copy.affiliates.downloads} value={String(stats.downloads)} />
        <StatRow label={copy.affiliates.registrations} value={String(stats.signups)} />
        <StatRow label="TecnoWallet+" value={String(stats.plusConversions)} />
        <StatRow label={copy.affiliates.conversion} value={`${stats.conversionRate}%`} last />
      </Card>

      <Card style={styles.statsCard}>
        <StatRow
          label={copy.affiliates.revenueGenerated}
          value={moneyMinor(stats.revenueGeneratedMinor, stats.currency, locale)}
        />
        <StatRow
          label={copy.affiliates.commissionAccrued}
          value={moneyMinor(stats.commissionTotalMinor, stats.currency, locale)}
        />
        <StatRow
          label={copy.affiliates.commissionPaid}
          value={moneyMinor(stats.commissionPaidMinor, stats.currency, locale)}
        />
        <StatRow
          label={copy.affiliates.pendingPayout}
          value={moneyMinor(stats.commissionPendingMinor, stats.currency, locale)}
          last
        />
      </Card>

      <Card style={styles.list}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {copy.affiliates.payoutMethod}
        </Text>
        <Text style={[styles.body, { color: theme.muted, marginTop: 0 }]}>
          {copy.affiliates.payoutHint}
        </Text>

        <View
          style={[
            styles.methodChip,
            {
              backgroundColor: theme.successSoft,
              borderColor: theme.success,
            },
          ]}>
          <AppIcon name="wallet.pass.fill" color={theme.success} size={18} />
          <Text style={[styles.methodChipText, { color: theme.text }]}>
            Wallet · USDT
          </Text>
          {affiliate.payoutMethod ? (
            <Pill tone="green">{copy.affiliates.configured}</Pill>
          ) : (
            <Pill tone="orange">{copy.affiliates.pending}</Pill>
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.muted }]}>
          {locale === 'es' ? 'RED' : 'NETWORK'}
        </Text>
        <View style={styles.networkRow}>
          {USDT_NETWORKS.map((network) => {
            const active = payoutNetwork === network.id;
            return (
              <Pressable
                key={network.id}
                onPress={() => {
                  setPayoutNetwork(network.id);
                  setPayoutSaved(false);
                }}
                style={[
                  styles.networkChip,
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
                    fontSize: 13,
                  }}>
                  {network.label}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 10 }}>{network.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.muted }]}>
          {copy.affiliates.walletAddress}
        </Text>
        <TextInput
          value={payoutAddress}
          onChangeText={(value) => {
            setPayoutAddress(value.replace(/\s+/g, ''));
            setPayoutSaved(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={
            payoutNetwork === 'trc20'
              ? 'T…'
              : payoutNetwork === 'sol'
                ? locale === 'es'
                  ? 'Dirección Solana'
                  : 'Solana address'
                : '0x…'
          }
          placeholderTextColor={theme.muted}
          style={[
            styles.codeInput,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.surfaceSecondary,
              fontSize: 14,
              letterSpacing: 0,
              fontWeight: '600',
            },
          ]}
        />
        <Text style={[styles.hint, { color: theme.muted }]}>
          {copy.affiliates.walletWarning}
        </Text>

        <Pressable
          onPress={() => {
            const address = payoutAddress.trim();
            if (!address) {
              Alert.alert(
                locale === 'es' ? 'Wallet' : 'Wallet',
                locale === 'es'
                  ? 'Primero escribe o guarda tu dirección USDT.'
                  : 'Enter or save your USDT address first.',
              );
              return;
            }
            void copyValue(
              address,
              'Dirección de wallet copiada.',
              'Wallet address copied.',
            );
          }}
          style={[
            styles.copyChip,
            {
              alignSelf: 'flex-start',
              borderColor: theme.primary,
              backgroundColor: theme.primarySoft,
            },
          ]}>
          <Text style={[styles.copyChipText, { color: theme.primary }]}>
            {locale === 'es' ? 'Copiar wallet' : 'Copy wallet'}
          </Text>
        </Pressable>

        <PrimaryButton
          icon="checkmark.circle.fill"
          onPress={() => {
            void savePayout();
          }}>
          {payoutBusy
            ? copy.affiliates.saving
            : payoutSaved
              ? copy.affiliates.saved
              : copy.affiliates.saveMethod}
        </PrimaryButton>
      </Card>

      <AffiliateTiersGuide
        activeId={tier.id}
        activePaidCount={tier.activePaidCount}
        revenueShareMonths={affiliate.revenueShareMonths ?? 12}
      />

      <Card style={styles.list}>
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 8 }]}>
          {copy.affiliates.referredUsers}
        </Text>
        {referred.length === 0 ? (
          <Text style={[styles.body, { color: theme.muted, marginTop: 0 }]}>
            {copy.affiliates.referredEmpty}
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
                  {formatDate(row.attributedAt, locale)} · {row.plan} · {row.status}
                </Text>
              </View>
              <Text style={[styles.refCommission, { color: theme.text }]}>
                {moneyMinor(row.commissionMinor, row.currency, locale)}
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
  methodChip: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  methodChipText: { flex: 1, fontSize: 14, fontWeight: '700' },
  networkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  networkChip: {
    width: '48%',
    flexGrow: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    justifyContent: 'center',
  },
  tiersCard: { gap: 12 },
  tierList: { gap: 10, marginTop: 4 },
  tierRow: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  tierLabel: { fontSize: 16, fontWeight: '700' },
  tierRange: { fontSize: 13, fontWeight: '600' },
  tierMeta: { fontSize: 12, lineHeight: 17 },
  tierFoot: { fontSize: 12, lineHeight: 18 },
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
  actions: { width: '100%', gap: 10 },
  copyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  copyChip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copyChipText: { fontSize: 13, fontWeight: '700' },
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
