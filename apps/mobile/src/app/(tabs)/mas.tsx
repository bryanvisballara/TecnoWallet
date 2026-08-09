import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from 'react-native';

import { AppIcon, Card, Pill, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { featureGroups } from '@/data/demo';
import { languages } from '@/i18n/languages';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';

export default function MoreScreen() {
  const theme = useAppTheme();
  const demo = useAuthStore((state) => state.demo);
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);
  const requestDeleteAccountCode = useAuthStore(
    (state) => state.requestDeleteAccountCode,
  );
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'code'>('confirm');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const language = languages.find((item) => item.code === locale) ?? languages[0];
  const avatarSource = profile.avatarUri
    ? { uri: profile.avatarUri }
    : require('../../../assets/images/tecnowallet-logo.png');

  const openItem = (slug: string) => {
    if (slug === 'idioma') {
      setLanguageOpen(true);
      return;
    }
    if (slug === 'datos') {
      router.push('/export');
      return;
    }
    if (slug === 'familia') {
      router.push('/ledgers');
      return;
    }
    router.push({ pathname: '/feature/[slug]', params: { slug } });
  };

  const leave = async () => {
    await signOut();
    router.replace('/auth');
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
    setDeleteOpen(false);
    setDeleteStep('confirm');
    setDeleteCode('');
    setDeleteError(null);
    setDeleteInfo(null);
  };

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
      router.replace('/auth');
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
    <Screen withTabBar title="Más" subtitle="Herramientas y preferencias">
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel="Ver perfil"
        onPress={() => router.push('/profile')}>
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
            </View>
            <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>{profile.email}</Text>
          </View>
          <AppIcon name="chevron" color={theme.muted} size={16} />
        </Card>
      </ScalePressable>

      {featureGroups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={[styles.groupTitle, { color: theme.muted }]}>{group.title.toUpperCase()}</Text>
          <Card style={styles.menu}>
            {group.items.map((item, index) => {
              const subtitle = item.slug === 'idioma' ? language.nativeLabel : item.subtitle;
              const badge = item.slug === 'idioma' ? language.code.toUpperCase() : item.badge;
              const iconColor = item.color ?? theme.primary;
              return (
                <View key={item.slug}>
                  <ScalePressable haptic={false} onPress={() => openItem(item.slug)}>
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
                        <Text style={[styles.menuTitle, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      </View>
                      {badge ? <Pill tone={item.badgeTone ?? 'neutral'}>{badge}</Pill> : null}
                      <AppIcon name="chevron" color={theme.muted} size={15} />
                    </View>
                  </ScalePressable>
                  {item.slug === 'transferir' ? (
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
                            Eliminar cuenta
                          </Text>
                          <Text style={[styles.small, { color: theme.muted }]} numberOfLines={1}>
                            Borra tu usuario y libros en el servidor
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
        <Text style={[styles.signOutText, { color: theme.danger }]}>Cerrar sesión</Text>
      </ScalePressable>

      <Text style={[styles.version, { color: theme.muted }]}>TecnoWallet 1.0.0 · Hecho con cuidado</Text>

      <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLanguageOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Idioma</Text>
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
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}>
        <Pressable style={styles.backdrop} onPress={closeDeleteModal}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Eliminar cuenta</Text>
            {deleteStep === 'confirm' ? (
              <Text style={[styles.small, { color: theme.muted, fontSize: 13, lineHeight: 18 }]}>
                Te enviaremos un código de 6 dígitos a {profile.email}. Sin ese código no se
                elimina la cuenta ni tus libros.
              </Text>
            ) : (
              <>
                <Text style={[styles.small, { color: theme.muted, fontSize: 13, lineHeight: 18 }]}>
                  Escribe el código que llegó a tu correo para confirmar el borrado.
                </Text>
                <TextInput
                  value={deleteCode}
                  onChangeText={(value) => setDeleteCode(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
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
                <Text style={[styles.signOutText, { color: theme.text }]}>Cancelar</Text>
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
                    {deleteStep === 'confirm' ? 'Enviar código' : 'Eliminar'}
                  </Text>
                )}
              </ScalePressable>
            </View>
            {deleteStep === 'code' ? (
              <ScalePressable disabled={deleting} onPress={() => void sendDeleteCode()}>
                <Text style={[styles.resendCode, { color: theme.primary }]}>
                  Reenviar código
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
});
