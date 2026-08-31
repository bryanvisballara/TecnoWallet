import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from 'react-native';

import { AppIcon, Card, Pill, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { localizedFeatureGroups, useAppCopy } from '@/i18n/app-copy';
import { languages } from '@/i18n/languages';
import { authHref } from '@/lib/auth-entry';
import { currencies, currencyLabel } from '@/lib/currencies';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import { useActiveLedger, useLedgerStore } from '@/store/ledger';
import { usePlusStore, hasPaidPlan, planDisplayLabel, planDisplaySubtitle } from '@/store/plus';
import { isBusinessPlan } from '@/services/plus-api';
import {
  appearanceLabel,
  usePreferencesStore,
  weekStartsOnLabel,
  type AppearanceMode,
} from '@/store/preferences';

export default function MoreScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const featureGroups = useMemo(() => localizedFeatureGroups(copy), [copy]);
  const demo = useAuthStore((state) => state.demo);
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);
  const requestDeleteAccountCode = useAuthStore(
    state => state.requestDeleteAccountCode,
  );
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);
  const hapticsEnabled = usePreferencesStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = usePreferencesStore((state) => state.setHapticsEnabled);
  const appearance = usePreferencesStore((state) => state.appearance);
  const setAppearance = usePreferencesStore((state) => state.setAppearance);
  const remindersEnabled = usePreferencesStore((state) => state.remindersEnabled);
  const biometricsLockEnabled = usePreferencesStore((state) => state.biometricsLockEnabled);
  const weekStartsOn = usePreferencesStore((state) => state.weekStartsOn);
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);
  const setLedgerCurrency = useLedgerStore((state) => state.setLedgerCurrency);
  const { ledger } = useActiveLedger();
  const activeCurrency = (ledger?.baseCurrency || 'COP').toUpperCase();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'code'>('confirm');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteKeyboardHeight, setDeleteKeyboardHeight] = useState(0);
  const language = languages.find((item) => item.code === locale) ?? languages[0];
  const avatarSource = profile.avatarUri
    ? { uri: profile.avatarUri }
    : require('../../../assets/images/tecnowallet-logo.png');

  const filteredCurrencies = useMemo(() => {
    const query = currencyQuery.trim().toLowerCase();
    if (!query) return currencies;
    return currencies.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query),
    );
  }, [currencyQuery]);

  const openItem = (slug: string) => {
    if (slug === 'admin') {
      router.push('/(tabs)/admin');
      return;
    }
    if (slug === 'idioma') {
      setLanguageOpen(true);
      return;
    }
    if (slug === 'apariencia') {
      setAppearanceOpen(true);
      return;
    }
    if (slug === 'sonido') {
      return;
    }
    if (slug === 'upgrade-plus') {
      if (hasPaidPlan(plusAccess)) return;
      openPaywall('UPGRADE', { plan: 'plus' });
      return;
    }
    if (slug === 'upgrade-business') {
      if (plusAccess === 'business') return;
      openPaywall('UPGRADE', { plan: 'business' });
      return;
    }
    if (slug === 'divisa') {
      setCurrencyQuery('');
      setCurrencyOpen(true);
      return;
    }
    if (slug === 'bancos') {
      return;
    }
    if (slug === 'datos') {
      router.push('/(tabs)/export');
      return;
    }
    if (slug === 'afiliados') {
      router.push('/(tabs)/afiliados');
      return;
    }
    if (slug === 'familia') {
      router.push('/(tabs)/ledgers');
      return;
    }
    router.push({ pathname: '/(tabs)/feature/[slug]', params: { slug } });
  };

  const resolveItem = (slug: string, fallbackSubtitle: string, fallbackBadge?: string) => {
    if (slug === 'upgrade-plus') {
      if (hasPaidPlan(plusAccess)) {
        return {
          subtitle:
            plusAccess === 'business'
              ? copy.more.badges.includedInBusiness
              : copy.more.badges.subscriptionActive,
          badge: copy.more.badges.active as string | undefined,
        };
      }
      return {
        subtitle: fallbackSubtitle,
        badge: copy.more.badges.upgrade as string | undefined,
      };
    }
    if (slug === 'upgrade-business') {
      if (plusAccess === 'business') {
        return {
          subtitle: copy.more.badges.subscriptionActive,
          badge: copy.more.badges.active as string | undefined,
        };
      }
      return {
        subtitle: fallbackSubtitle,
        badge: hasPaidPlan(plusAccess)
          ? copy.more.badges.upgrade
          : copy.more.badges.business,
      };
    }
    if (slug === 'afiliados') {
      if (isBusinessPlan(plusAccess)) {
        return {
          subtitle:
            locale === 'es'
              ? 'Tu enlace, código y comisiones'
              : 'Your link, code, and commissions',
          badge: undefined as string | undefined,
        };
      }
      return {
        subtitle: copy.more.items.afiliados.subtitle,
        badge: copy.more.badges.business as string | undefined,
      };
    }
    if (slug === 'divisa') {
      return {
        subtitle:
          locale === 'es'
            ? `${currencyLabel(activeCurrency)} · libro ${ledger?.name ?? 'activo'}`
            : `${currencyLabel(activeCurrency)} · book ${ledger?.name ?? 'active'}`,
        badge: activeCurrency,
      };
    }
    if (slug === 'bancos') {
      return {
        subtitle: copy.more.items.bancos.subtitle,
        badge: (copy.more.items.bancos.badge ?? copy.more.badges.soon) as
          | string
          | undefined,
      };
    }
    if (slug === 'presupuesto-ia') {
      return {
        subtitle:
          locale === 'es' ? 'Sin sugerencias aún' : 'No suggestions yet',
        badge: undefined as string | undefined,
      };
    }
    if (slug === 'recordatorios') {
      return {
        subtitle: remindersEnabled
          ? copy.more.items.recordatorios.subtitle
          : locale === 'es'
            ? 'Avisos desactivados'
            : 'Reminders off',
        badge: remindersEnabled ? copy.more.badges.active : 'Off',
      };
    }
    if (slug === 'seguridad') {
      return {
        subtitle: copy.more.items.seguridad.subtitle,
        badge: biometricsLockEnabled ? copy.more.badges.active : 'Off',
      };
    }
    if (slug === 'ajustes') {
      return {
        subtitle:
          locale === 'es'
            ? `Semana · ${weekStartsOnLabel(weekStartsOn, locale)}`
            : `Week · ${weekStartsOnLabel(weekStartsOn, locale)}`,
        badge: undefined as string | undefined,
      };
    }
    return { subtitle: fallbackSubtitle, badge: fallbackBadge };
  };

  const pickCurrency = async (code: string) => {
    if (code === activeCurrency) {
      setCurrencyOpen(false);
      return;
    }
    setSavingCurrency(true);
    try {
      await setLedgerCurrency(code);
      setCurrencyOpen(false);
    } catch (error) {
      Alert.alert(
        'No se pudo cambiar la divisa',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSavingCurrency(false);
    }
  };

  const leave = async () => {
    await signOut();
    router.replace(authHref('login'));
  };

  const openDeleteModal = () => {
    setDeleteError(null);
    setDeleteInfo(null);
    setDeleteCode('');
    setDeleteStep('confirm');
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    Keyboard.dismiss();
    setDeleteOpen(false);
    setDeleteStep('confirm');
    setDeleteCode('');
    setDeleteError(null);
    setDeleteInfo(null);
    setDeleteKeyboardHeight(0);
  };

  useEffect(() => {
    if (!deleteOpen) {
      setDeleteKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (event) => {
      setDeleteKeyboardHeight(Math.max(0, event.endCoordinates.height));
    });
    const onHide = Keyboard.addListener(hideEvent, () => setDeleteKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [deleteOpen]);

  const sendDeleteCode = async () => {
    if (demo) {
      setDeleteError('La sesión demo no se puede eliminar.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await requestDeleteAccountCode();
      setDeleteStep('code');
      setDeleteInfo(
        result.devCode
          ? `Enviamos un código a ${result.email} (dev: ${result.devCode}).`
          : `Enviamos un código de 6 dígitos a ${result.email}.`,
      );
      if (result.devCode) setDeleteCode(result.devCode);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'No pudimos enviar el código. Inténtalo de nuevo.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const runDeleteAccount = async () => {
    if (demo) {
      setDeleteError('La sesión demo no se puede eliminar.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deleteCode);
      setDeleteOpen(false);
      router.replace(authHref('login'));
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Inténtalo de nuevo en unos minutos.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen withTabBar title={copy.more.title} subtitle={copy.more.subtitle}>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={copy.more.viewProfile}
        onPress={() => router.push('/(tabs)/profile')}>
        <Card style={styles.profile}>
          <Image
            source={avatarSource}
            style={[styles.avatar as ImageStyle, { backgroundColor: theme.primarySoft }]}
            contentFit="cover"
          />
          <View style={styles.copy}>
            <View style={[uiStyles.row, uiStyles.gap8]}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{profile.name}</Text>
              {demo ? <Pill tone="blue">Demo</Pill> : null}
              <Pill
                tone={
                  plusAccess === 'business'
                    ? 'blue'
                    : hasPaidPlan(plusAccess)
                      ? 'green'
                      : 'neutral'
                }>
                {planDisplayLabel(plusAccess, locale)}
              </Pill>
            </View>
            <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
              {profile.email}
            </Text>
            <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
              {planDisplaySubtitle(plusAccess, locale)}
            </Text>
          </View>
          <AppIcon name="chevron" color={theme.muted} size={16} />
        </Card>
      </ScalePressable>

      {profile.platformRole === 'admin' ? (
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={copy.more.adminPortal}
          onPress={() => openItem('admin')}>
          <Card style={styles.adminCard}>
            <View style={[styles.adminIcon, { backgroundColor: theme.primarySoft }]}>
              <AppIcon name="gearshape.fill" color={theme.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.name, { color: theme.text }]}>{copy.more.adminPortal}</Text>
              <Text style={[styles.small, { color: theme.muted }]}>
                {copy.more.adminSubtitle}
              </Text>
            </View>
            <Pill tone="blue">Admin</Pill>
          </Card>
        </ScalePressable>
      ) : null}

      {featureGroups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={[styles.groupTitle, { color: theme.muted }]}>{group.title.toUpperCase()}</Text>
          <Card style={styles.menu}>
            {group.items.map((item, index) => {
              const resolved = resolveItem(item.slug, item.subtitle, item.badge);
              const subtitle =
                item.slug === 'idioma'
                  ? language.nativeLabel
                  : item.slug === 'apariencia'
                    ? appearanceLabel(appearance, locale)
                    : item.slug === 'sonido'
                      ? hapticsEnabled
                        ? copy.more.enabled
                        : copy.more.disabled
                      : resolved.subtitle;
              const badge =
                item.slug === 'idioma'
                  ? language.code.toUpperCase()
                  : item.slug === 'divisa'
                    ? activeCurrency
                    : resolved.badge;
              const title =
                item.slug === 'upgrade-plus' && hasPaidPlan(plusAccess)
                  ? 'TecnoWallet+'
                  : item.slug === 'upgrade-business' && plusAccess === 'business'
                    ? 'TecnoWallet Business'
                    : item.title;
              const upgradeActive =
                (item.slug === 'upgrade-plus' && hasPaidPlan(plusAccess)) ||
                (item.slug === 'upgrade-business' && plusAccess === 'business');
              const badgeTone =
                item.slug === 'upgrade-plus' || item.slug === 'upgrade-business'
                  ? upgradeActive
                    ? 'green'
                    : 'blue'
                  : item.slug === 'afiliados'
                    ? isBusinessPlan(plusAccess)
                      ? 'green'
                      : 'blue'
                  : item.slug === 'recordatorios' || item.slug === 'seguridad'
                    ? resolved.badge === copy.more.badges.active
                      ? 'green'
                      : 'neutral'
                    : (item.badgeTone ?? 'neutral');
              const iconColor = item.color ?? theme.primary;
              const isToggle = item.slug === 'sonido';
              const isComingSoon = item.slug === 'bancos';
              return (
                <View key={item.slug}>
                  <ScalePressable
                    haptic={false}
                    disabled={isToggle || upgradeActive || isComingSoon}
                    onPress={() => openItem(item.slug)}>
                    <View
                      style={[
                        styles.menuRow,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.border,
                        },
                      ]}>
                      <View style={[styles.menuIcon, { backgroundColor: `${iconColor}1A` }]}>
                        <AppIcon name={item.icon} color={iconColor} />
                      </View>
                      <View style={styles.copy}>
                        <Text style={[styles.menuTitle, { color: theme.text }]}>{title}</Text>
                        <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      </View>
                      {isToggle ? (
                        <Switch
                          value={hapticsEnabled}
                          onValueChange={(value) => void setHapticsEnabled(value)}
                          trackColor={{ false: theme.border, true: theme.primary }}
                          thumbColor="#FFFFFF"
                        />
                      ) : (
                        <>
                          {badge ? <Pill tone={badgeTone}>{badge}</Pill> : null}
                          {upgradeActive || isComingSoon ? null : (
                            <AppIcon name="chevron" color={theme.muted} size={15} />
                          )}
                        </>
                      )}
                    </View>
                  </ScalePressable>
                  {item.slug === 'contacto' ? (
                    <ScalePressable
                      haptic={false}
                      disabled={deleting}
                      onPress={openDeleteModal}>
                      <View
                        style={[
                          styles.menuRow,
                          {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: theme.border,
                          },
                        ]}>
                        <View style={[styles.menuIcon, { backgroundColor: '#F044381A' }]}>
                          <AppIcon name="trash" color="#F04438" />
                        </View>
                        <View style={styles.copy}>
                          <Text style={[styles.menuTitle, { color: theme.danger }]}>
                            {copy.more.deleteAccount}
                          </Text>
                          <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
                            {locale === 'es'
                              ? 'Borra tu usuario y libros en el servidor'
                              : 'Deletes your user and books on the server'}
                          </Text>
                        </View>
                        <AppIcon name="chevron" color={theme.muted} size={15} />
                      </View>
                    </ScalePressable>
                  ) : null}
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      <ScalePressable
        onPress={() => void leave()}
        disabled={deleting}
        style={[styles.signOut, { backgroundColor: '#FDECEC' }]}>
        <Text style={[styles.signOutText, { color: theme.danger }]}>{copy.more.signOut}</Text>
      </ScalePressable>

      <Text style={[styles.version, { color: theme.muted }]}>
        {locale === 'es'
          ? 'TecnoWallet 1.0.0 · Hecho con cuidado'
          : 'TecnoWallet 1.0.0 · Made with care'}
      </Text>

      <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLanguageOpen(false)}>
          <Pressable
            style={[styles.sheet, styles.languageSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{copy.more.languageSheet}</Text>
            <ScrollView
              style={styles.languageList}
              contentContainerStyle={styles.languageListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {languages.map((item) => {
                const selected = item.code === locale;
                return (
                  <ScalePressable
                    key={item.code}
                    onPress={async () => {
                      await setLocale(item.code);
                      setLanguageOpen(false);
                    }}
                    style={[
                      styles.languageRow,
                      { backgroundColor: selected ? theme.primarySoft : theme.surfaceSecondary },
                    ]}>
                    <Text style={styles.flag}>{item.flag}</Text>
                    <View style={styles.copy}>
                      <Text style={[styles.menuTitle, { color: theme.text }]}>{item.nativeLabel}</Text>
                      <Text style={[styles.small, { color: theme.muted }]}>{item.label}</Text>
                    </View>
                    {selected ? <AppIcon name="checkmark" color={theme.primary} size={18} /> : null}
                  </ScalePressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={appearanceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAppearanceOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{copy.more.appearanceSheet}</Text>
            {(
              [
                {
                  id: 'system' as AppearanceMode,
                  title: locale === 'es' ? 'Automático' : 'Automatic',
                  hint: locale === 'es' ? 'Sigue el sistema' : 'Follow system',
                },
                {
                  id: 'light' as AppearanceMode,
                  title: copy.appearance.light,
                  hint: locale === 'es' ? 'Siempre modo claro' : 'Always light mode',
                },
                {
                  id: 'dark' as AppearanceMode,
                  title: copy.appearance.dark,
                  hint: locale === 'es' ? 'Siempre modo oscuro' : 'Always dark mode',
                },
              ] as const
            ).map((item) => {
              const selected = appearance === item.id;
              return (
                <ScalePressable
                  key={item.id}
                  onPress={async () => {
                    await setAppearance(item.id);
                    setAppearanceOpen(false);
                  }}
                  style={[
                    styles.languageRow,
                    { backgroundColor: selected ? theme.primarySoft : theme.surfaceSecondary },
                  ]}>
                  <View style={styles.copy}>
                    <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.small, { color: theme.muted }]}>{item.hint}</Text>
                  </View>
                  {selected ? <AppIcon name="checkmark" color={theme.primary} size={18} /> : null}
                </ScalePressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={currencyOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingCurrency) setCurrencyOpen(false);
        }}>
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!savingCurrency) setCurrencyOpen(false);
            }}
          />
          <View style={[styles.currencySheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.currencyHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text, marginBottom: 0 }]}>
                {copy.more.currencySheet}
              </Text>
              <Pressable
                accessibilityLabel={copy.more.close}
                disabled={savingCurrency}
                onPress={() => setCurrencyOpen(false)}
                style={styles.currencyClose}>
                <AppIcon name="xmark" color={theme.text} size={20} />
              </Pressable>
            </View>
            <Text style={[styles.small, { color: theme.muted, fontSize: 13, lineHeight: 18 }]}>
              {locale === 'es'
                ? `Moneda del libro ${ledger?.name ?? 'activo'}. Los montos se mostrarán en esta divisa.`
                : `Currency for book ${ledger?.name ?? 'active'}. Amounts will show in this currency.`}
            </Text>
            <TextInput
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder={
                locale === 'es' ? 'Buscar por código o nombre' : 'Search by code or name'
              }
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!savingCurrency}
              style={[
                styles.currencySearch,
                {
                  color: theme.text,
                  backgroundColor: theme.surfaceSecondary,
                  borderColor: theme.border,
                },
              ]}
            />
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.currencyList}
              renderItem={({ item }) => {
                const selected = item.code === activeCurrency;
                return (
                  <ScalePressable
                    disabled={savingCurrency}
                    onPress={() => void pickCurrency(item.code)}
                    style={[
                      styles.languageRow,
                      { backgroundColor: selected ? theme.primarySoft : theme.surfaceSecondary },
                    ]}>
                    <Text style={[styles.currencyCode, { color: selected ? theme.primary : theme.text }]}>
                      {item.code}
                    </Text>
                    <View style={styles.copy}>
                      <Text style={[styles.menuTitle, { color: theme.text }]}>{item.name}</Text>
                    </View>
                    {selected ? <AppIcon name="checkmark" color={theme.primary} size={18} /> : null}
                  </ScalePressable>
                );
              }}
            />
            {savingCurrency ? (
              <View style={styles.currencySaving}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}>
        <Pressable
          style={[
            styles.backdrop,
            deleteKeyboardHeight > 0 ? { paddingBottom: deleteKeyboardHeight + 8 } : null,
          ]}
          onPress={closeDeleteModal}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{copy.more.deleteAccount}</Text>
            {deleteStep === 'confirm' ? (
              <Text style={[styles.small, { color: theme.muted, fontSize: 13, lineHeight: 18 }]}>
                {locale === 'es'
                  ? `Te enviaremos un código de 6 dígitos a ${profile.email}. Sin ese código no se elimina la cuenta ni tus libros.`
                  : `We'll send a 6-digit code to ${profile.email}. Without it your account and books won't be deleted.`}
              </Text>
            ) : (
              <>
                <Text style={[styles.small, { color: theme.muted, fontSize: 13, lineHeight: 18 }]}>
                  {locale === 'es'
                    ? 'Escribe el código que llegó a tu correo para confirmar el borrado.'
                    : 'Enter the code from your email to confirm deletion.'}
                </Text>
                <TextInput
                  value={deleteCode}
                  onChangeText={(value) => setDeleteCode(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  placeholder="000000"
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
              </>
            )}
            {deleteInfo ? (
              <Text style={[styles.small, { color: theme.primary, fontSize: 13 }]}>{deleteInfo}</Text>
            ) : null}
            {deleteError ? (
              <Text style={[styles.small, { color: theme.danger, fontSize: 13 }]}>{deleteError}</Text>
            ) : null}
            <View style={styles.deleteActions}>
              <ScalePressable
                disabled={deleting}
                onPress={closeDeleteModal}
                style={[styles.deleteActionBtn, { backgroundColor: theme.surfaceSecondary }]}>
                <Text style={[styles.signOutText, { color: theme.text }]}>{copy.more.cancel}</Text>
              </ScalePressable>
              <ScalePressable
                disabled={deleting || (deleteStep === 'code' && deleteCode.length !== 6)}
                onPress={() =>
                  void (deleteStep === 'confirm' ? sendDeleteCode() : runDeleteAccount())
                }
                style={[styles.deleteActionBtn, { backgroundColor: '#FDECEC' }]}>
                {deleting ? (
                  <ActivityIndicator color={theme.danger} />
                ) : (
                  <Text style={[styles.signOutText, { color: theme.danger }]}>
                    {deleteStep === 'confirm' ? copy.more.sendCode : copy.more.delete}
                  </Text>
                )}
              </ScalePressable>
            </View>
            {deleteStep === 'code' ? (
              <ScalePressable disabled={deleting} onPress={() => void sendDeleteCode()}>
                <Text style={[styles.resendCode, { color: theme.primary }]}>
                  {copy.more.resendCode}
                </Text>
              </ScalePressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 52, height: 52, borderRadius: 18 },
  copy: { flex: 1, gap: 3, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '700' },
  small: { fontSize: 11, lineHeight: 16 },
  group: { gap: 8 },
  groupTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginLeft: 5 },
  menu: { paddingVertical: 2 },
  menuRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontSize: 14, fontWeight: '600' },
  signOut: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700' },
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  deleteActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  resendCode: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  version: { textAlign: 'center', fontSize: 11, marginTop: 4, marginBottom: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,11,18,0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10,
  },
  languageSheet: { maxHeight: '78%' },
  languageList: { maxHeight: 420 },
  languageListContent: { gap: 10, paddingBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  languageRow: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flag: { fontSize: 22 },
  currencySheet: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10,
    maxHeight: '78%',
  },
  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySearch: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  currencyList: { maxHeight: 360 },
  currencyCode: { fontSize: 15, fontWeight: '800', minWidth: 40 },
  currencySaving: { alignItems: 'center', paddingVertical: 4 },
});
