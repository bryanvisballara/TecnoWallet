import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  AppIcon,
  ScalePressable,
  useAppTheme,
} from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import { ApiError } from '@/services/api';
import { getAffiliateCode } from '@/services/affiliate-api';
import {
  claimPendingAffiliate,
  storeManualAffiliateCode,
} from '@/services/branch';
import {
  loadOfferings,
  purchaseBusiness,
  purchasePlus,
  restorePlusPurchases,
} from '@/services/purchases';
import { useAffiliateStore } from '@/store/affiliate';
import {
  type PaywallPlan,
  usePlusStore,
} from '@/store/plus';

const plusBenefitIcons = [
  'sparkles',
  'wallet.pass.fill',
  'person.2.fill',
  'calendar',
] as const;

const businessBenefitIcons = [
  'briefcase.fill',
  'person.2.fill',
  'gift.fill',
  'sparkles',
  'calendar',
] as const;

export function PlusPaywallModal() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const visible = usePlusStore((state) => state.paywallOpen);
  const reason = usePlusStore((state) => state.paywallReason);
  const plan = usePlusStore((state) => state.paywallPlan);
  const priceLabel = usePlusStore((state) => state.priceLabel);
  const businessPriceLabel = usePlusStore((state) => state.businessPriceLabel);
  const listPriceLabel = usePlusStore((state) => state.listPriceLabel);
  const listBusinessPriceLabel = usePlusStore(
    (state) => state.listBusinessPriceLabel,
  );
  const couponCode = usePlusStore((state) => state.couponCode);
  const close = usePlusStore((state) => state.closePaywall);
  const setBilling = usePlusStore((state) => state.setBilling);
  const setCoupon = usePlusStore((state) => state.setCoupon);
  const [working, setWorking] = useState<'buy' | 'restore' | 'coupon' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [couponDraft, setCouponDraft] = useState('');
  const reasonCopy = copy.paywall.reasons[reason];
  const isBusiness = plan === 'business' || reason === 'SEAT_LIMIT';
  const benefitLabels = isBusiness ? copy.paywall.businessBenefits : copy.paywall.plusBenefits;
  const benefitIcons = isBusiness ? businessBenefitIcons : plusBenefitIcons;
  const activePrice = isBusiness ? businessPriceLabel : priceLabel;
  const listPrice = isBusiness ? listBusinessPriceLabel : listPriceLabel;
  const showStrike =
    Boolean(couponCode) &&
    Boolean(listPrice) &&
    Boolean(activePrice) &&
    listPrice !== activePrice;
  const brandLabel = isBusiness ? 'TECNOWALLET BUSINESS' : 'TECNOWALLET+';

  const title = isBusiness
    ? reason === 'SEAT_LIMIT'
      ? copy.paywall.upgradeBusinessSeat
      : copy.paywall.unlockBusiness
    : reason === 'UPGRADE'
      ? copy.paywall.unlockPlus
      : reasonCopy.title;

  useEffect(() => {
    if (!visible) return;
    setError(null);
    useAffiliateStore.getState().dismissWelcome();
    if (usePlusStore.getState().couponCode) {
      setCouponDraft(usePlusStore.getState().couponCode ?? '');
    }
    void loadOfferings().catch(() => undefined);
  }, [visible]);

  const applyCoupon = async (raw: string, options?: { silent?: boolean }) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    if (!options?.silent) {
      setError(null);
      setWorking('coupon');
    }
    try {
      const affiliate = await getAffiliateCode(code);
      await storeManualAffiliateCode(affiliate.code);
      setCoupon(affiliate.code, affiliate.name);
      setCouponDraft(affiliate.code);
      await loadOfferings();
    } catch (couponError) {
      if (options?.silent) return;
      const message =
        couponError instanceof ApiError
          ? copy.paywall.couponInvalid
          : couponError instanceof Error
            ? couponError.message
            : copy.paywall.couponInvalid;
      setError(message);
    } finally {
      if (!options?.silent) setWorking(null);
    }
  };

  const runPurchase = async (target: PaywallPlan = plan) => {
    setError(null);
    setWorking('buy');
    const paywallReason = usePlusStore.getState().paywallReason;
    const appliedCode = usePlusStore.getState().couponCode;
    close();
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(resolve, 400);
      });
    });
    try {
      const billing =
        target === 'business'
          ? await purchaseBusiness()
          : await purchasePlus();
      setBilling(billing);
      if (appliedCode) {
        void claimPendingAffiliate({ allowManual: true }).catch(() =>
          storeManualAffiliateCode(appliedCode),
        );
      }
    } catch (purchaseError) {
      usePlusStore.getState().openPaywall(paywallReason, { plan: target });
      if (appliedCode) setCoupon(appliedCode);
      const message =
        purchaseError instanceof Error
          ? purchaseError.message
          : copy.paywall.purchaseFailed;
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setWorking(null);
    }
  };

  const runRestore = async () => {
    setError(null);
    setWorking('restore');
    try {
      const billing = await restorePlusPurchases();
      setBilling(billing);
      if (billing.isPlus) close();
      else setError(copy.paywall.restoreEmpty);
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : copy.paywall.restoreFailed,
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityLabel={copy.common.close}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetInner}>
          <View style={styles.topRow}>
            <View style={[styles.logo, { backgroundColor: theme.primarySoft }]}>
              <AppIcon
                name={isBusiness ? 'briefcase.fill' : 'sparkles'}
                color={theme.primary}
                size={28}
              />
            </View>
            <ScalePressable
              accessibilityLabel={copy.common.close}
              onPress={close}
              style={[styles.close, { backgroundColor: theme.surfaceSecondary }]}>
              <AppIcon name="xmark" color={theme.muted} size={18} />
            </ScalePressable>
          </View>

          <Text style={[styles.eyebrow, { color: theme.primary }]}>
            {brandLabel}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{reasonCopy.body}</Text>

          <View style={styles.benefits}>
            {benefitLabels.map((label, index) => (
              <View key={label} style={styles.benefit}>
                <View
                  style={[
                    styles.check,
                    { backgroundColor: theme.successSoft },
                  ]}>
                  <AppIcon name={benefitIcons[index]} color={theme.success} size={16} />
                </View>
                <Text style={[styles.benefitText, { color: theme.text }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {couponCode ? (
            <View
              style={[
                styles.couponApplied,
                { backgroundColor: theme.successSoft },
              ]}>
              <AppIcon name="checkmark.circle.fill" color={theme.success} size={18} />
              <Text style={[styles.couponAppliedText, { color: theme.success }]}>
                {copy.paywall.couponApplied(couponCode)}
              </Text>
            </View>
          ) : (
            <View style={styles.couponBlock}>
              <Text style={[styles.couponLabel, { color: theme.text }]}>
                {copy.paywall.couponLabel}
              </Text>
              <View style={styles.couponRow}>
                <TextInput
                  value={couponDraft}
                  onChangeText={(value) => setCouponDraft(value.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!working}
                  placeholder={copy.paywall.couponPlaceholder}
                  placeholderTextColor={theme.muted}
                  style={[
                    styles.couponInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.surfaceSecondary,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <ScalePressable
                  accessibilityRole="button"
                  disabled={Boolean(working) || !couponDraft.trim()}
                  onPress={() => void applyCoupon(couponDraft)}
                  style={[
                    styles.couponButton,
                    {
                      backgroundColor: theme.primary,
                      opacity: working || !couponDraft.trim() ? 0.6 : 1,
                    },
                  ]}>
                  {working === 'coupon' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.couponButtonText}>
                      {copy.paywall.couponApply}
                    </Text>
                  )}
                </ScalePressable>
              </View>
            </View>
          )}

          <ScalePressable
            accessibilityRole="button"
            disabled={Boolean(working)}
            onPress={() => void runPurchase(isBusiness ? 'business' : 'plus')}
            style={[
              styles.primary,
              {
                backgroundColor: theme.primary,
                opacity: working ? 0.7 : 1,
              },
            ]}>
            {working === 'buy' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryText}>
                  {Platform.OS === 'ios'
                    ? isBusiness
                      ? copy.paywall.subscribeBusiness
                      : copy.paywall.subscribeApple
                    : isBusiness
                      ? copy.paywall.viewBusiness
                      : copy.paywall.viewPlus}
                </Text>
                {showStrike ? (
                  <Text style={styles.strike}>{listPrice}</Text>
                ) : null}
                <Text style={styles.price}>
                  {activePrice
                    ? copy.paywall.pricePerMonth(activePrice)
                    : copy.paywall.priceBeforeConfirm}
                </Text>
              </>
            )}
          </ScalePressable>

          <ScalePressable
            disabled={Boolean(working)}
            onPress={() => void runRestore()}
            style={styles.restore}>
            {working === 'restore' ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Text style={[styles.restoreText, { color: theme.primary }]}>
                {copy.paywall.restore}
              </Text>
            )}
          </ScalePressable>

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          <Text style={[styles.legal, { color: theme.muted }]}>{copy.paywall.legal}</Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => void Linking.openURL('https://tecnowallet.app/terms')}>
              <Text style={[styles.legalLink, { color: theme.primary }]}>{copy.paywall.terms}</Text>
            </Pressable>
            <Text style={{ color: theme.muted }}>·</Text>
            <Pressable onPress={() => void Linking.openURL('https://tecnowallet.app/privacy')}>
              <Text style={[styles.legalLink, { color: theme.primary }]}>{copy.paywall.privacy}</Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#07101F99',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 12,
    zIndex: 2,
    maxHeight: '92%',
  },
  sheetInner: {
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  benefits: { gap: 10, marginTop: 4 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: 14, fontWeight: '600' },
  couponBlock: { gap: 6, marginTop: 4 },
  couponLabel: { fontSize: 13, fontWeight: '700' },
  couponRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  couponInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  couponButton: {
    height: 44,
    minWidth: 88,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  couponButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  couponAppliedText: { fontSize: 13, fontWeight: '700' },
  primary: {
    marginTop: 8,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 2,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  strike: {
    color: '#FFFFFF99',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  price: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  restore: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { fontSize: 14, fontWeight: '700' },
  error: { fontSize: 13, textAlign: 'center' },
  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: { fontSize: 12, fontWeight: '700' },
});
