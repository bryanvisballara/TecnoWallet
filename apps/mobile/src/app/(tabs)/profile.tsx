import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, Pill, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { useAppCopy } from '@/i18n/app-copy';
import { useAppRefresh } from '@/hooks/use-app-refresh';
import { useAuthStore } from '@/store/auth';
import { useLanguageStore } from '@/store/language';
import {
  hasPaidPlan,
  planDisplayLabel,
  planDisplaySubtitle,
  usePlusStore,
} from '@/store/plus';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const { refreshing, onRefresh } = useAppRefresh();
  const demo = useAuthStore((state) => state.demo);
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
  }, [profile.name, profile.email]);

  const avatarSource = profile.avatarUri
    ? { uri: profile.avatarUri }
    : require('../../../assets/images/tecnowallet-logo.png');

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(copy.profile.permissionTitle, copy.profile.permissionBody);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    await updateProfile({ avatarUri: result.assets[0].uri });
    void Haptics.selectionAsync();
  };

  const removeAvatar = async () => {
    await updateProfile({ avatarUri: undefined });
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert(copy.profile.nameRequiredTitle, copy.profile.nameRequiredBody);
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert(copy.profile.emailInvalidTitle, copy.profile.emailInvalidBody);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(copy.profile.profileUpdatedTitle, copy.profile.profileUpdatedBody);
    } catch (error) {
      Alert.alert(
        copy.profile.saveFailedTitle,
        error instanceof Error ? error.message : copy.common.tryAgain,
      );
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (demo) {
      Alert.alert(copy.profile.demoModeTitle, copy.profile.demoModeBody);
      return;
    }
    if (nextPassword !== confirmPassword) {
      Alert.alert(copy.profile.passwordMismatchTitle, copy.profile.passwordMismatchBody);
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(copy.profile.passwordUpdatedTitle, copy.profile.passwordUpdatedBody);
    } catch (error) {
      Alert.alert(
        copy.profile.passwordChangeFailedTitle,
        error instanceof Error ? error.message : copy.common.tryAgain,
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.common.back}
          onPress={() => safeGoBack('/(tabs)/mas')}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text }]}>{copy.profile.title}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>{copy.profile.subtitle}</Text>
        </View>
        <View style={styles.headerBadges}>
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
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }>
          <View style={[styles.avatarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ScalePressable accessibilityLabel={copy.profile.changePhotoA11y} onPress={() => void pickAvatar()}>
              <Image
                source={avatarSource}
                style={[styles.avatar as ImageStyle, { backgroundColor: theme.primarySoft }]}
                contentFit="cover"
              />
              <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}>
                <AppIcon name="camera" color="#FFFFFF" size={14} />
              </View>
            </ScalePressable>
            <Text style={[styles.avatarHint, { color: theme.muted }]}>{copy.profile.tapToChangePhoto}</Text>
            <View style={styles.planRow}>
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
              <Text style={[styles.planSubtitle, { color: theme.muted }]}>
                {planDisplaySubtitle(plusAccess, locale)}
              </Text>
            </View>
            {!hasPaidPlan(plusAccess) ? (
              <PrimaryButton onPress={() => openPaywall('UPGRADE', { plan: 'plus' })}>
                Pasarme a Plus
              </PrimaryButton>
            ) : null}
            {profile.avatarUri ? (
              <Pressable onPress={() => void removeAvatar()}>
                <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 13 }}>
                  {copy.profile.removePhoto}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.section, { color: theme.text }]}>{copy.profile.sectionInfo}</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Field label={copy.profile.name}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={copy.profile.namePlaceholder}
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <Field label={copy.profile.email}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={copy.profile.emailPlaceholder}
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <PrimaryButton onPress={() => void saveProfile()}>
              {saving ? copy.profile.saving : copy.profile.saveChanges}
            </PrimaryButton>
          </View>

          <Text style={[styles.section, { color: theme.text }]}>{copy.profile.sectionSecurity}</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Field label={copy.profile.currentPassword}>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <Field label={copy.profile.newPassword}>
              <TextInput
                value={nextPassword}
                onChangeText={setNextPassword}
                secureTextEntry
                placeholder={copy.profile.newPasswordPlaceholder}
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <Field label={copy.profile.confirmPassword}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder={copy.profile.confirmPasswordPlaceholder}
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <PrimaryButton onPress={() => void savePassword()}>
              {savingPassword ? copy.profile.updating : copy.profile.changePassword}
            </PrimaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 13 },
  content: { padding: 18, gap: 12, paddingBottom: 40 },
  avatarCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  avatar: { width: 96, height: 96, borderRadius: 28 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { fontSize: 13 },
  planRow: { alignItems: 'center', gap: 6, marginTop: 2 },
  planSubtitle: { fontSize: 13, textAlign: 'center' },
  section: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
});
