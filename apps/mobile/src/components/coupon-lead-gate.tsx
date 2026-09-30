import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, PrimaryButton, Screen, useAppTheme } from '@/components/ui';
import { authHref } from '@/lib/auth-entry';
import { copyText } from '@/lib/copy-text';
import { branchReferralDownloadUrl } from '@/lib/referral-link';
import {
  getAffiliateCode,
  recordAffiliateClick,
  submitCouponLead,
} from '@/services/affiliate-api';
import { storeWebAffiliateReferral } from '@/services/branch';
import { localeFromDevice } from '@/store/language';

const APP_STORE_URL =
  process.env.EXPO_PUBLIC_APP_STORE_URL ||
  'https://apps.apple.com/app/id6802359477';

const COUNTRY_CODES = [
  'AR', 'BO', 'BR', 'CA', 'CL', 'CO', 'CR', 'DE', 'DO', 'EC', 'ES', 'FR', 'GB',
  'GT', 'HN', 'IT', 'MX', 'NI', 'PA', 'PE', 'PT', 'PY', 'SV', 'US', 'UY', 'VE',
] as const;

const text = {
  es: {
    subtitleReferral: 'Referido',
    subtitleCoupon: 'Cupón',
    referralTitle: 'Te invitaron a TecnoWallet',
    referralBody:
      'Descarga la app, crea tu cuenta ahí y suscríbete con Apple. El enlace lleva el referido; si ya la instalaste, vuelve a abrir este enlace en Safari o ingresa el código en la app.',
    referralFrom: (label: string) => `Te recomienda: ${label}`,
    referralStep1: '1. Descarga TecnoWallet (App Store)',
    referralStep2:
      '2. Regístrate en la app con el mismo correo que uses aquí, si dejas tus datos.',
    referralStep3:
      '3. Si ya instalaste: abre otra vez este enlace en Safari o pega el código en el paywall de Plus.',
    referralCopyCode: 'Copiar código de referido',
    referralOptionalLead: 'Dejar mi correo (opcional)',
    referralOptionalHint:
      'Si te registras en la app con el mismo correo, ligamos la recomendación aunque no abras el enlace otra vez.',
    referralRevealedTitle: 'Correo registrado',
    referralRevealedBody:
      'Descarga o abre la app y crea tu cuenta con ese correo. También puedes volver a abrir este enlace después de instalar.',
    title: 'Pide tu cupón de TecnoWallet',
    body: 'Completa el formulario. El código aparece cuando lo envías.',
    iosTitle: 'Enlace de referido',
    iosBody:
      'Completa el formulario para registrar quién te recomendó TecnoWallet.',
    iosRevealedTitle: 'Referido registrado',
    iosRevealedBody:
      'Abre TecnoWallet y suscríbete con Compras dentro de la app. No necesitas un código de descuento en la app.',
    name: 'Nombre',
    email: 'Correo',
    country: 'País',
    pickCountry: 'Elige tu país',
    send: 'Enviar',
    sending: 'Enviando…',
    revealedTitle: 'Tu cupón está listo',
    revealedBody: 'Úsalo al suscribirte a TecnoWallet+ o Business.',
    copy: 'Copiar cupón',
    copied: 'Copiado',
    download: 'Descargar TecnoWallet',
    next: 'Continuar',
    invalid: 'Revisa tu nombre, correo y país.',
    failed: 'No pudimos guardar tus datos. Inténtalo de nuevo.',
  },
  en: {
    subtitleReferral: 'Referral',
    subtitleCoupon: 'Coupon',
    referralTitle: 'You were invited to TecnoWallet',
    referralBody:
      'Download the app, sign up there, and subscribe with Apple. The link carries the referral; if you already installed, open this link again in Safari or enter the code in the app.',
    referralFrom: (label: string) => `Recommended by: ${label}`,
    referralStep1: '1. Download TecnoWallet (App Store)',
    referralStep2:
      '2. Sign up in the app with the same email you use here, if you leave your details.',
    referralStep3:
      '3. If you already installed: open this link again in Safari or paste the code on the Plus paywall.',
    referralCopyCode: 'Copy referral code',
    referralOptionalLead: 'Leave my email (optional)',
    referralOptionalHint:
      'If you sign up in the app with the same email, we can attach the referral even without reopening the link.',
    referralRevealedTitle: 'Email saved',
    referralRevealedBody:
      'Download or open the app and create your account with that email. You can also reopen this link after installing.',
    title: 'Request your TecnoWallet coupon',
    body: 'Fill in the form. The code appears after you send it.',
    iosTitle: 'Referral link',
    iosBody: 'Fill in the form to register who referred you to TecnoWallet.',
    iosRevealedTitle: 'Referral saved',
    iosRevealedBody:
      'Open TecnoWallet and subscribe with In-App Purchase. You do not need a discount code in the app.',
    name: 'Name',
    email: 'Email',
    country: 'Country',
    pickCountry: 'Choose your country',
    send: 'Send',
    sending: 'Sending…',
    revealedTitle: 'Your coupon is ready',
    revealedBody: 'Use it when you subscribe to TecnoWallet+ or Business.',
    copy: 'Copy coupon',
    copied: 'Copied',
    download: 'Download TecnoWallet',
    next: 'Continue',
    invalid: 'Check your name, email, and country.',
    failed: "We couldn't save your details. Try again.",
  },
} as const;

function languageTags() {
  const tags: string[] = [];
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings as
      | { AppleLocale?: string; AppleLanguages?: string[] }
      | undefined;
    if (Array.isArray(settings?.AppleLanguages)) tags.push(...settings.AppleLanguages);
    if (settings?.AppleLocale) tags.push(settings.AppleLocale);
  } else if (typeof navigator !== 'undefined') {
    tags.push(...(navigator.languages ?? []), navigator.language);
  }
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intl) tags.push(intl);
  } catch {
    // Locale can be missing; the country field stays empty.
  }
  return tags;
}

function guessCountry() {
  for (const tag of languageTags()) {
    const region = tag
      .replace(/_/g, '-')
      .split('-')
      .slice(1)
      .find((part) => /^[a-zA-Z]{2}$/.test(part));
    if (region) return region.toUpperCase();
  }
  return '';
}

function countryName(code: string, locale: 'es' | 'en') {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export function CouponLeadGate({
  code,
  variant = 'coupon',
}: {
  code: string;
  variant?: 'referral' | 'coupon';
}) {
  const theme = useAppTheme();
  const coupon = code.trim().toUpperCase();
  const isReferral = variant === 'referral';
  const [locale, setLocale] = useState<'es' | 'en'>(
    localeFromDevice() === 'es' ? 'es' : 'en',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState(guessCountry);
  const [countryOpen, setCountryOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referrerLabel, setReferrerLabel] = useState<string | null>(null);
  const [branchUrl, setBranchUrl] = useState<string | null>(null);
  const [referralReady, setReferralReady] = useState(!isReferral);
  const [optionalLeadOpen, setOptionalLeadOpen] = useState(false);
  const copy = text[locale];
  const isIosApp = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const showCouponReveal = !isReferral && !isIosApp;

  useEffect(() => {
    if (!isReferral || coupon.length < 2) return;
    void (async () => {
      try {
        const affiliate = await recordAffiliateClick({
          code: coupon,
          campaign: `link_${coupon.toLowerCase()}`,
        });
        setReferrerLabel(affiliate.name?.trim() || affiliate.code);
        setBranchUrl(affiliate.branchUrl?.trim() || null);
        if (!isWeb) {
          await storeWebAffiliateReferral(affiliate.code, affiliate.clickId);
        }
      } catch {
        try {
          const affiliate = await getAffiliateCode(coupon);
          setReferrerLabel(affiliate.name?.trim() || affiliate.code);
          setBranchUrl(affiliate.branchUrl?.trim() || null);
        } catch {
          setReferrerLabel(coupon);
        }
        if (!isWeb) {
          await storeWebAffiliateReferral(coupon);
        }
      } finally {
        setReferralReady(true);
      }
    })();
  }, [coupon, isReferral, isWeb]);

  const countries = useMemo(
    () =>
      [...COUNTRY_CODES]
        .map((item) => ({ code: item, label: countryName(item, locale) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  );

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || country.length !== 2) {
      setError(copy.invalid);
      return;
    }
    setSending(true);
    setError('');
    try {
      await submitCouponLead({
        name: trimmedName,
        email: trimmedEmail,
        country,
        locale,
        code: coupon,
      });
      if (!isWeb) {
        try {
          const affiliate = await recordAffiliateClick({
            code: coupon,
            campaign: `link_${coupon.toLowerCase()}`,
          });
          await storeWebAffiliateReferral(affiliate.code, affiliate.clickId);
        } catch {
          await storeWebAffiliateReferral(coupon);
        }
      }
      setRevealed(true);
    } catch {
      setError(copy.failed);
    } finally {
      setSending(false);
    }
  };

  const openDownload = () => {
    if (isWeb) {
      const url = branchReferralDownloadUrl(coupon, branchUrl);
      void Linking.openURL(url);
      return;
    }
    router.replace(authHref('register'));
  };

  const copyReferralCode = () => {
    void copyText(coupon).then(() => setCopied(true));
  };

  const screenSubtitle = isReferral ? copy.subtitleReferral : copy.subtitleCoupon;
  const formTitle = isReferral
    ? copy.referralTitle
    : isIosApp
      ? copy.iosTitle
      : copy.title;
  const formBody = isReferral
    ? copy.referralBody
    : isIosApp
      ? copy.iosBody
      : copy.body;
  const doneTitle = isReferral
    ? copy.referralRevealedTitle
    : isIosApp
      ? copy.iosRevealedTitle
      : copy.revealedTitle;
  const doneBody = isReferral
    ? copy.referralRevealedBody
    : isIosApp
      ? copy.iosRevealedBody
      : copy.revealedBody;

  return (
    <Screen title="TecnoWallet" subtitle={screenSubtitle}>
      <View style={styles.langRow}>
        {(['es', 'en'] as const).map((item) => {
          const selected = item === locale;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => setLocale(item)}
              style={[
                styles.lang,
                {
                  backgroundColor: selected ? theme.primary : theme.surfaceSecondary,
                },
              ]}>
              <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontWeight: '800' }}>
                {item === 'es' ? 'Español' : 'English'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <AppIcon
            name={isReferral ? 'person.2.fill' : 'gift.fill'}
            color={theme.primary}
            size={36}
          />
        </View>
        {isReferral && referralReady && !revealed ? (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{copy.referralTitle}</Text>
            {referrerLabel ? (
              <Text style={[styles.referrer, { color: theme.primary }]}>
                {copy.referralFrom(referrerLabel)}
              </Text>
            ) : null}
            <Text style={[styles.body, { color: theme.muted }]}>{copy.referralBody}</Text>
            <View style={styles.steps}>
              <Text style={[styles.step, { color: theme.text }]}>{copy.referralStep1}</Text>
              <Text style={[styles.step, { color: theme.text }]}>{copy.referralStep2}</Text>
              <Text style={[styles.step, { color: theme.text }]}>{copy.referralStep3}</Text>
            </View>
            <Text style={[styles.code, { color: theme.text }]}>{coupon}</Text>
            <PrimaryButton onPress={openDownload}>{copy.download}</PrimaryButton>
            <Pressable
              accessibilityRole="button"
              onPress={copyReferralCode}
              style={[
                styles.secondaryBtn,
                { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
              ]}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>
                {copied ? copy.copied : copy.referralCopyCode}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOptionalLeadOpen((open) => !open)}
              style={styles.optionalToggle}>
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14 }}>
                {copy.referralOptionalLead}
              </Text>
            </Pressable>
            {optionalLeadOpen ? (
              <>
                <Text style={[styles.body, { color: theme.muted }]}>{copy.referralOptionalHint}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder={copy.name}
                  placeholderTextColor={theme.muted}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceSecondary,
                    },
                  ]}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder={copy.email}
                  placeholderTextColor={theme.muted}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.surfaceSecondary,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCountryOpen((open) => !open)}
                  style={[
                    styles.input,
                    styles.select,
                    { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
                  ]}>
                  <Text style={{ color: country ? theme.text : theme.muted, fontWeight: '700' }}>
                    {country ? countryName(country, locale) : copy.pickCountry}
                  </Text>
                </Pressable>
                {countryOpen ? (
                  <ScrollView
                    style={[
                      styles.menu,
                      { borderColor: theme.border, backgroundColor: theme.surface },
                    ]}>
                    {countries.map((item) => (
                      <Pressable
                        key={item.code}
                        onPress={() => {
                          setCountry(item.code);
                          setCountryOpen(false);
                        }}
                        style={styles.menuItem}>
                        <Text
                          style={{
                            color: theme.text,
                            fontWeight: item.code === country ? '800' : '600',
                          }}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                {error ? (
                  <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
                ) : null}
                <PrimaryButton disabled={sending} onPress={() => void submit()}>
                  {sending ? copy.sending : copy.send}
                </PrimaryButton>
              </>
            ) : null}
          </>
        ) : isReferral && !referralReady ? (
          <Text style={[styles.body, { color: theme.muted }]}>
            {locale === 'es' ? 'Cargando…' : 'Loading…'}
          </Text>
        ) : revealed ? (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{doneTitle}</Text>
            <Text style={[styles.body, { color: theme.muted }]}>{doneBody}</Text>
            {showCouponReveal ? (
              <>
                <Text style={[styles.code, { color: theme.text }]}>{coupon}</Text>
                <PrimaryButton
                  onPress={() => {
                    void copyText(coupon).then(() => setCopied(true));
                  }}>
                  {copied ? copy.copied : copy.copy}
                </PrimaryButton>
              </>
            ) : null}
            <PrimaryButton onPress={openDownload}>
              {isWeb ? copy.download : copy.next}
            </PrimaryButton>
          </>
        ) : isReferral ? null : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{formTitle}</Text>
            {isReferral && referrerLabel ? (
              <Text style={[styles.referrer, { color: theme.primary }]}>
                {copy.referralFrom(referrerLabel)}
              </Text>
            ) : null}
            <Text style={[styles.body, { color: theme.muted }]}>{formBody}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder={copy.name}
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder={copy.email}
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setCountryOpen((open) => !open)}
              style={[styles.input, styles.select, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}>
              <Text style={{ color: country ? theme.text : theme.muted, fontWeight: '700' }}>
                {country ? countryName(country, locale) : copy.pickCountry}
              </Text>
            </Pressable>
            {countryOpen ? (
              <ScrollView style={[styles.menu, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                {countries.map((item) => (
                  <Pressable
                    key={item.code}
                    onPress={() => {
                      setCountry(item.code);
                      setCountryOpen(false);
                    }}
                    style={styles.menuItem}>
                    <Text style={{ color: theme.text, fontWeight: item.code === country ? '800' : '600' }}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
            <PrimaryButton disabled={sending} onPress={() => void submit()}>
              {sending ? copy.sending : copy.send}
            </PrimaryButton>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  lang: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  content: {
    alignItems: 'center',
    gap: 14,
    padding: 24,
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    maxWidth: 420,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    maxWidth: 440,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  referrer: {
    maxWidth: 440,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  steps: {
    width: '100%',
    maxWidth: 440,
    gap: 8,
  },
  step: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'left',
  },
  optionalToggle: {
    paddingVertical: 8,
  },
  secondaryBtn: {
    width: '100%',
    maxWidth: 420,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    width: '100%',
    maxWidth: 420,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  select: { justifyContent: 'center' },
  menu: {
    width: '100%',
    maxWidth: 420,
    maxHeight: 220,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
  code: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  error: { fontSize: 13, textAlign: 'center' },
});
