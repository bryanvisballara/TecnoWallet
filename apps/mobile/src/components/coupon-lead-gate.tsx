import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { recordAffiliateClick, submitCouponLead } from '@/services/affiliate-api';
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
    subtitle: 'Cupón',
    title: 'Pide tu cupón de TecnoWallet',
    body: 'Completa el formulario. El código aparece cuando lo envías.',
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
    subtitle: 'Coupon',
    title: 'Request your TecnoWallet coupon',
    body: 'Fill in the form. The code appears after you send it.',
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

export function CouponLeadGate({ code }: { code: string }) {
  const theme = useAppTheme();
  const coupon = code.trim().toUpperCase();
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
  const copy = text[locale];

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
      try {
        const affiliate = await recordAffiliateClick({
          code: coupon,
          campaign: `creator_${coupon.toLowerCase()}`,
        });
        await storeWebAffiliateReferral(affiliate.code, affiliate.clickId);
      } catch {
        await storeWebAffiliateReferral(coupon);
      }
      setRevealed(true);
    } catch {
      setError(copy.failed);
    } finally {
      setSending(false);
    }
  };

  const openDownload = () => {
    if (Platform.OS === 'web') {
      void Linking.openURL(APP_STORE_URL);
      return;
    }
    router.replace(authHref('register'));
  };

  return (
    <Screen title="TecnoWallet" subtitle={copy.subtitle}>
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
          <AppIcon name="gift.fill" color={theme.primary} size={36} />
        </View>
        {revealed ? (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{copy.revealedTitle}</Text>
            <Text style={[styles.body, { color: theme.muted }]}>{copy.revealedBody}</Text>
            <Text style={[styles.code, { color: theme.text }]}>{coupon}</Text>
            <PrimaryButton
              onPress={() => {
                void copyText(coupon).then(() => setCopied(true));
              }}>
              {copied ? copy.copied : copy.copy}
            </PrimaryButton>
            <PrimaryButton onPress={openDownload}>
              {Platform.OS === 'web' ? copy.download : copy.next}
            </PrimaryButton>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{copy.title}</Text>
            <Text style={[styles.body, { color: theme.muted }]}>{copy.body}</Text>
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
