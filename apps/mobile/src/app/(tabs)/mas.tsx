import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type ImageStyle } from 'react-native';

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
  const locale = useLanguageStore((state) => state.locale);
  const setLocale = useLanguageStore((state) => state.setLocale);
  const [languageOpen, setLanguageOpen] = useState(false);
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
                <ScalePressable key={item.slug} haptic={false} onPress={() => openItem(item.slug)}>
                  <View
                    style={[
                      styles.menuRow,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
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
              );
            })}
          </Card>
        </View>
      ))}

      <ScalePressable onPress={() => void leave()} style={[styles.signOut, { backgroundColor: '#FDECEC' }]}>
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
