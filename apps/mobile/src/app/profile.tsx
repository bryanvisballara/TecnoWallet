import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, Pill, PrimaryButton, ScalePressable, useAppTheme } from '@/components/ui';
import { useAuthStore } from '@/store/auth';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const demo = useAuthStore((state) => state.demo);
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);

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
    : require('../../assets/images/tecnowallet-logo.png');

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Activa el acceso a fotos para cambiar tu imagen de perfil.');
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
      Alert.alert('Nombre requerido', 'Escribe cómo quieres que te llamemos.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Correo inválido', 'Revisa el correo registrado.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron en este dispositivo.');
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (demo) {
      Alert.alert('Modo demo', 'Inicia sesión con una cuenta real para cambiar la contraseña.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      Alert.alert('No coinciden', 'La confirmación de la nueva contraseña no coincide.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Contraseña actualizada', 'Usa la nueva contraseña en tu próximo acceso.');
    } catch (error) {
      Alert.alert('No se pudo cambiar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Tu perfil</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Datos de la cuenta</Text>
        </View>
        {demo ? <Pill tone="blue">Demo</Pill> : <View style={styles.back} />}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.avatarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ScalePressable accessibilityLabel="Cambiar foto de perfil" onPress={() => void pickAvatar()}>
              <Image
                source={avatarSource}
                style={[styles.avatar as ImageStyle, { backgroundColor: theme.primarySoft }]}
                contentFit="cover"
              />
              <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}>
                <AppIcon name="camera" color="#FFFFFF" size={14} />
              </View>
            </ScalePressable>
            <Text style={[styles.avatarHint, { color: theme.muted }]}>Toca para cambiar la foto</Text>
            {profile.avatarUri ? (
              <Pressable onPress={() => void removeAvatar()}>
                <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 13 }}>Quitar foto</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.section, { color: theme.text }]}>Información</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Field label="Nombre">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <Field label="Correo registrado">
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="correo@ejemplo.com"
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <PrimaryButton onPress={() => void saveProfile()}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </PrimaryButton>
          </View>

          <Text style={[styles.section, { color: theme.text }]}>Seguridad</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Field label="Contraseña actual">
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <Field label="Nueva contraseña">
              <TextInput
                value={nextPassword}
                onChangeText={setNextPassword}
                secureTextEntry
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <Field label="Confirmar nueva contraseña">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              />
            </Field>
            <PrimaryButton onPress={() => void savePassword()}>
              {savingPassword ? 'Actualizando…' : 'Cambiar contraseña'}
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
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 13 },
  content: { padding: 18, gap: 12, paddingBottom: 40 },
  avatarCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
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
