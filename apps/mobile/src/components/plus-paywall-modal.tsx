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
import { getAppCopy } from '@/i18n/app-copy';
import { ApiError } from '@/services/api';
import {
  claimPendingAffiliate,
  peekPendingAffiliateCode,
  storeManualAffiliateCode,
} from '@/services/branch';
import {
  configurePurchases,
  fetchApplePaywallPrices,
  loadOfferings,
  purchaseBusiness,
  purchasePlus,
  restorePlusPurchases,
  type ApplePaywallPrices,
} from '@/services/purchases';
import {
  acceptCollaborationInvite,
  createAccessRequest,
  parseInviteInput,
  rememberInviteInput,
} from '@/services/collaboration-api';
import { hasLocalGuestAccess } from '@/lib/guest-access';
import { shouldSuppressPaywallForReferralFlow } from '@/lib/referral-auth';
import { localStorage } from '@/services/persistence';
import {
  canUnlockApp,
  canUseSharedBooksWithoutPaying,
} from '@/services/plus-api';
import { useAffiliateStore } from '@/store/affiliate';
import { useAppTutorialStore } from '@/store/app-tutorial';
import { useAuthStore } from '@/store/auth';
import { localeFromDevice } from '@/store/language';
import { useCalendarStore } from '@/store/calendar';
import { useLedgerStore } from '@/store/ledger';
import {
  affiliateProgramEnabled,
  type PaywallPlan,
  usePlusStore,
} from '@/store/plus';

function isAlreadyMemberError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    return /already have access|already own/i.test(error.message);
  }
  return error instanceof Error && /already have access|already own/i.test(error.message);
}

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
  const copy = getAppCopy(localeFromDevice());
  const authenticated = useAuthStore((state) => state.authenticated);
  const paywallOpen = usePlusStore((state) => state.paywallOpen);
  const [referralFlowActive, setReferralFlowActive] = useState(false);

  useEffect(() => {
    if (!authenticated || Platform.OS !== 'web') {
      setReferralFlowActive(false);
      return;
    }
    void shouldSuppressPaywallForReferralFlow().then((suppress) => {
      setReferralFlowActive(suppress);
      if (suppress) usePlusStore.getState().closePaywall({ force: true });
    });
  }, [authenticated, paywallOpen]);

  const visible = paywallOpen && authenticated && !referralFlowActive;
  const reason = usePlusStore((state) => state.paywallReason);
  const plan = usePlusStore((state) => state.paywallPlan);
  const billingMarket = usePlusStore((state) => state.billingMarket);
  const refreshBillingMarket = usePlusStore((state) => state.refreshBillingMarket);
  const close = usePlusStore((state) => state.closePaywall);
  const access = usePlusStore((state) => state.access);
  const billing = usePlusStore((state) => state.billing);
  const canDismiss = canUnlockApp(billing, access);
  const setBilling = usePlusStore((state) => state.setBilling);
  const setPaywallPlan = usePlusStore((state) => state.setPaywallPlan);
  const signOut = useAuthStore((state) => state.signOut);
  const [working, setWorking] = useState<
    'buy' | 'restore' | 'invite' | 'signout' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviteDraft, setInviteDraft] = useState('');
  const [storePricesLoading, setStorePricesLoading] = useState(false);
  const [applePrices, setApplePrices] = useState<ApplePaywallPrices | null>(
    null,
  );
  const reasonCopy = copy.paywall.reasons[reason];
  const isBusiness = plan === 'business' || reason === 'SEAT_LIMIT';
  const showAffiliateBenefit = affiliateProgramEnabled(billingMarket);
  const rawBenefits = isBusiness ? copy.paywall.businessBenefits : copy.paywall.plusBenefits;
  const rawIcons = isBusiness ? businessBenefitIcons : plusBenefitIcons;
  const benefitLabels = rawBenefits.filter(
    (_, index) => showAffiliateBenefit || rawIcons[index] !== 'gift.fill',
  );
  const benefitIcons = rawIcons.filter(
    (_, index) => showAffiliateBenefit || rawIcons[index] !== 'gift.fill',
  );
  const brandLabel = isBusiness ? 'TECNOWALLET BUSINESS' : 'TECNOWALLET+';

  const title =
    Platform.OS === 'ios'
      ? isBusiness
        ? reason === 'SEAT_LIMIT'
          ? copy.paywall.upgradeBusinessSeat
          : copy.paywall.unlockBusiness
        : copy.paywall.unlockPlus
      : isBusiness
        ? reason === 'SEAT_LIMIT'
          ? copy.paywall.upgradeBusinessSeat
          : copy.paywall.unlockBusiness
        : reason === 'UPGRADE'
          ? copy.paywall.unlockPlus
          : reasonCopy.title;
  const appleMonthlyPriceRaw = isBusiness
    ? applePrices?.businessPrice
    : applePrices?.plusPrice;
  const appleMonthlyPrice = appleMonthlyPriceRaw;
  const nativeStoreCheckout =
    Platform.OS === 'ios' || Platform.OS === 'android';
  const paywallBody = nativeStoreCheckout
    ? copy.paywall.checkoutBodyApple
    : reasonCopy.body;

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setInviteNotice(null);
    setApplePrices(null);
    useAffiliateStore.getState().dismissWelcome();
    setStorePricesLoading(true);
    void (async () => {
      try {
        await refreshBillingMarket().catch(() => undefined);
        const userId = await localStorage.get('auth-user-id', '');
        if (nativeStoreCheckout && userId) {
          await configurePurchases(userId);
          const prices = await fetchApplePaywallPrices();
          setApplePrices(prices);
        } else {
          await loadOfferings();
        }
      } catch {
        await loadOfferings().catch(() => undefined);
      } finally {
        setStorePricesLoading(false);
      }
    })();
  }, [visible, refreshBillingMarket]);

  const unlockIfAlreadyGuest = async () => {
    await Promise.all([
      usePlusStore.getState().hydrate(),
      useLedgerStore.getState().hydrate(),
      useCalendarStore.getState().hydrate(),
    ]);
    if (
      canUnlockApp(usePlusStore.getState().billing) ||
      hasLocalGuestAccess()
    ) {
      usePlusStore.getState().markSharedAccess();
      setInviteNotice(copy.paywall.guestInviteOk);
      return true;
    }
    return false;
  };

  const applyGuestInvite = async () => {
    const parsed = parseInviteInput(inviteDraft);
    if (!parsed) {
      setError(copy.paywall.guestInviteInvalid);
      return;
    }
    setError(null);
    setInviteNotice(null);
    setWorking('invite');
    try {
      if (parsed.kind === 'share') {
        await createAccessRequest(parsed.value);
        await Promise.all([
          usePlusStore.getState().hydrate(),
          useLedgerStore.getState().hydrate(),
        ]);
        if (
          canUseSharedBooksWithoutPaying(usePlusStore.getState().billing) ||
          hasLocalGuestAccess()
        ) {
          usePlusStore.getState().markSharedAccess();
          setInviteNotice(copy.paywall.guestInviteOk);
          return;
        }
        setInviteNotice(copy.paywall.guestInvitePending);
        return;
      }
      await rememberInviteInput(parsed.value);
      await acceptCollaborationInvite(parsed.value);
      await unlockIfAlreadyGuest();
    } catch (inviteError) {
      if (isAlreadyMemberError(inviteError) && (await unlockIfAlreadyGuest())) {
        return;
      }
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : copy.paywall.guestInviteInvalid,
      );
    } finally {
      setWorking(null);
    }
  };

  const runPurchase = async (target: PaywallPlan = plan) => {
    setError(null);
    setWorking('buy');
    const paywallReason = usePlusStore.getState().paywallReason;
    close({ force: true });
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
      if (canUnlockApp(billing)) {
        setTimeout(() => void useAppTutorialStore.getState().startAfterTrial(), 700);
      }
      const pending = await peekPendingAffiliateCode();
      if (pending) {
        void claimPendingAffiliate({ allowManual: true }).catch(() =>
          storeManualAffiliateCode(pending),
        );
      }
    } catch (purchaseError) {
      usePlusStore.getState().openPaywall(paywallReason, { plan: target });
      const message =
        purchaseError instanceof Error
          ? purchaseError.message
          : copy.paywall.purchaseFailed;
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setWorking(null);
    }
  };

  const leave = async () => {
    if (working) return;
    setWorking('signout');
    try {
      await signOut();
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
      if (canUnlockApp(billing)) {
        setTimeout(() => void useAppTutorialStore.getState().startAfterTrial(), 700);
      }
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
      onRequestClose={() => {
        if (canDismiss) close();
      }}>
      <View style={styles.overlay}>
        {canDismiss ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => close()}
            accessibilityLabel={copy.common.close}
          />
        ) : (
          <View style={StyleSheet.absoluteFill} />
        )}
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
              onPress={() => {
                close({ force: true });
                setTimeout(
                  () => void useAppTutorialStore.getState().startAfterTrial(),
                  500,
                );
              }}
              style={[styles.close, { backgroundColor: theme.surfaceSecondary }]}>
              <AppIcon name="xmark" color={theme.muted} size={18} />
            </ScalePressable>
          </View>

          <Text style={[styles.eyebrow, { color: theme.primary }]}>
            {brandLabel}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{paywallBody}</Text>
          {reason === 'SEAT_LIMIT' ? null : (
            <View style={[styles.planSwitch, { backgroundColor: theme.surfaceSecondary }]}>
              {(['plus', 'business'] as const).map((value) => {
                const selected = isBusiness ? value === 'business' : value === 'plus';
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setPaywallPlan(value)}
                    style={[
                      styles.planOption,
                      selected && { backgroundColor: theme.surface },
                    ]}>
                    <Text
                      style={[
                        styles.planOptionText,
                        { color: selected ? theme.text : theme.muted },
                      ]}>
                      {value === 'business'
                        ? copy.paywall.planBusiness
                        : copy.paywall.planPlus}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

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

          <View style={styles.couponBlock}>
            <Text style={[styles.couponLabel, { color: theme.text }]}>
              {copy.paywall.guestInviteTitle}
            </Text>
            <Text style={[styles.guestHint, { color: theme.muted }]}>
              {copy.paywall.guestInviteHint}
            </Text>
            <View style={styles.couponRow}>
              <TextInput
                value={inviteDraft}
                onChangeText={setInviteDraft}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!working}
                placeholder={copy.paywall.guestInvitePlaceholder}
                placeholderTextColor={theme.muted}
                style={[
                  styles.couponInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.surfaceSecondary,
                    borderColor: theme.border,
                    letterSpacing: 0,
                    fontWeight: '600',
                  },
                ]}
              />
              <ScalePressable
                accessibilityRole="button"
                disabled={Boolean(working) || !inviteDraft.trim()}
                onPress={() => void applyGuestInvite()}
                style={[
                  styles.couponButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: working || !inviteDraft.trim() ? 0.6 : 1,
                  },
                ]}>
                {working === 'invite' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.couponButtonText}>
                    {copy.paywall.guestInviteApply}
                  </Text>
                )}
              </ScalePressable>
            </View>
            {inviteNotice ? (
              <Text style={[styles.guestOk, { color: theme.success }]}>
                {inviteNotice}
              </Text>
            ) : null}
          </View>

          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={
              appleMonthlyPrice
                ? `${copy.paywall.startFreeTrial}. ${copy.paywall.billedPerMonth(appleMonthlyPrice)}`
                : copy.paywall.startFreeTrial
            }
            disabled={Boolean(working)}
            onPress={() => void runPurchase(isBusiness ? 'business' : 'plus')}
            style={[
              styles.primary,
              {
                backgroundColor: theme.primary,
                opacity: working ? 0.7 : 1,
              },
            ]}>
            {working === 'buy' || storePricesLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : nativeStoreCheckout ? (
              <>
                <Text style={styles.billedAmount}>
                  {appleMonthlyPrice
                    ? copy.paywall.billedPerMonth(appleMonthlyPrice)
                    : copy.paywall.priceBeforeConfirm}
                </Text>
                <Text style={styles.primaryCta}>{copy.paywall.startFreeTrial}</Text>
                {appleMonthlyPrice ? (
                  <Text
                    style={styles.trialFootnote}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}>
                    {copy.paywall.trialButtonFootnote(appleMonthlyPrice)}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.primaryText}>
                  {isBusiness
                    ? copy.paywall.viewBusiness
                    : copy.paywall.viewPlus}
                </Text>
                <Text style={styles.price}>{copy.paywall.priceBeforeConfirm}</Text>
              </>
            )}
          </ScalePressable>

          {canDismiss ? (
            <ScalePressable
              disabled={Boolean(working)}
              onPress={() => void leave()}
              style={styles.restore}>
              {working === 'signout' ? (
                <ActivityIndicator color={theme.muted} />
              ) : (
                <Text style={[styles.restoreText, { color: theme.muted }]}>
                  {copy.paywall.signOut}
                </Text>
              )}
            </ScalePressable>
          ) : null}

          <ScalePressable
            disabled={Boolean(working)}
            onPress={() => void runRestore()}
            style={styles.restore}>
            {working === 'restore' ? (
              <ActivityIndicator color={theme.muted} />
            ) : (
              <Text style={[styles.restoreText, { color: theme.muted }]}>
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
  planSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
  },
  planOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planOptionText: { fontSize: 14, fontWeight: '800' },
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
  guestHint: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  guestOk: { fontSize: 13, fontWeight: '700' },
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
  primary: {
    marginTop: 8,
    alignSelf: 'center',
    width: '76%',
    maxWidth: 300,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  billedAmount: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  primaryCta: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 1,
  },
  trialFootnote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 11,
    textAlign: 'center',
    marginTop: 1,
    maxWidth: '100%',
  },
  strike: {
    color: '#FFFFFF99',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  price: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  restore: { alignItems: 'center', paddingVertical: 6 },
  restoreText: { fontSize: 13, fontWeight: '600' },
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
