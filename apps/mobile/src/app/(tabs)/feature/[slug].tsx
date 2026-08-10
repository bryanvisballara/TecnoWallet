import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { featureGroups, money } from '@/data/demo';
import { askAssistant } from '@/services/assistant-api';
import { ApiError } from '@/services/api';
import {
  authenticateAppUnlock,
  clearAppLockPin,
  getBiometricCapability,
  hasAppLockPin,
  setAppLockPin,
} from '@/services/biometrics';
import { configureActivityNotifications } from '@/services/push-notifications';
import { useActiveLedger } from '@/store/ledger';
import {
  isPlusRequiredError,
  plusReasonFromError,
  paywallPlanFromError,
  hasPaidPlan,
  usePlusStore,
} from '@/store/plus';
import {
  appearanceLabel,
  autoLockDelayLabel,
  usePreferencesStore,
  weekStartsOnLabel,
  type AppearanceMode,
  type AutoLockDelay,
  type WeekStartsOn,
} from '@/store/preferences';

const content: Record<string, Array<{ title: string; subtitle: string; value: string; icon: string }>> = {
  facturas: [],
  suscripciones: [],
  recurrentes: [],
  metas: [],
  familia: [],
  bancos: [],
  ocr: [],
};

const FAQ_ITEMS = [
  {
    question: '¿Qué es TecnoWallet?',
    answer:
      'TecnoWallet es una plataforma para organizar, controlar y entender tus finanzas. Puedes registrar tus ingresos y gastos, administrar presupuestos, analizar tus hábitos financieros y obtener información útil para tomar mejores decisiones con tu dinero.',
  },
  {
    question: '¿TecnoWallet puede conectarse con mis cuentas bancarias?',
    answer:
      'TecnoWallet puede ayudarte a centralizar tu información financiera y organizar tus movimientos. Dependiendo de las funciones disponibles en tu país, podrás registrar o importar información de tus cuentas y mantener tus finanzas organizadas desde un solo lugar.',
  },
  {
    question: '¿Qué incluye TecnoWallet+?',
    answer:
      'TecnoWallet+ desbloquea las funciones avanzadas de la plataforma, incluyendo herramientas de análisis financiero, funcionalidades con IA y la posibilidad de colaborar con hasta 5 usuarios. También tendrás acceso a nuevas funciones premium que se incorporen al servicio.',
  },
  {
    question: '¿Puedo compartir mi información financiera con otras personas?',
    answer:
      'Sí. TecnoWallet permite crear usuarios colaboradores para que puedas administrar determinadas finanzas junto con familiares, pareja o personas de confianza. Tú mantienes el control sobre los permisos y la información que compartes.',
  },
  {
    question: '¿Mis datos financieros están seguros?',
    answer:
      'La seguridad y privacidad de tu información son una prioridad para TecnoWallet. Tus datos se manejan mediante mecanismos de protección y controles de acceso diseñados para mantener tu información segura y permitirte decidir quién puede acceder a ella.',
  },
] as const;

const legacySettingsSlugs = new Set([
  'backup',
  'tema',
  'apariencia',
  'sonido',
  'actividad',
  'valorar',
]);

const CONTACT_EMAIL = 'dev@wwtecno.com';
const CONTACT_WHATSAPP = '+573016214806';
const CONTACT_WHATSAPP_DIGITS = '573016214806';

export default function FeatureScreen() {
  const theme = useAppTheme();
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const feature = useMemo(
    () => featureGroups.flatMap((group) => group.items).find((item) => item.slug === slug),
    [slug],
  );
  const title = feature?.title ?? 'TecnoWallet';

  useEffect(() => {
    if (slug === 'metas') router.replace('/(tabs)/metas');
    if (slug === 'facturas' || slug === 'suscripciones' || slug === 'recurrentes') {
      router.replace('/(tabs)/salud-financiera');
    }
    if (slug === 'sync') router.replace('/(tabs)/mas');
  }, [slug]);

  if (
    slug === 'metas' ||
    slug === 'facturas' ||
    slug === 'suscripciones' ||
    slug === 'recurrentes' ||
    slug === 'sync'
  ) {
    return null;
  }

  if (slug === 'asistente') {
    return <AssistantFeature />;
  }

  if (slug === 'recordatorios') {
    return <RemindersSettings />;
  }

  if (slug === 'seguridad') {
    return <BiometricsSettings />;
  }

  if (slug === 'ajustes') {
    return <AdvancedSettings />;
  }

  if (slug === 'contacto') {
    return <ContactSettings />;
  }

  if (slug === 'faq') {
    return <FaqSettings />;
  }

  if (legacySettingsSlugs.has(slug)) {
    return (
      <Screen withTabBar title={title} subtitle={feature?.subtitle} right={<BackButton />}>
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            Esta opción se movió a Preferencias. Usa Recordatorios, Face ID / Biometría o Más ajustes.
          </Text>
        </Card>
      </Screen>
    );
  }

  const rows = content[slug] ?? [];
  const showAdd = !['estadisticas', 'calendario'].includes(slug) && rows.length > 0;
  return (
    <Screen withTabBar title={title} subtitle={feature?.subtitle} right={<BackButton />}>
      {slug === 'estadisticas' && (
        <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
          <Text style={styles.heroHint}>Ahorro promedio mensual</Text>
          <Text style={styles.statsValue}>{money(0)}</Text>
          <Pill tone="neutral">Sin historial aún</Pill>
          <View style={styles.bars}>
            {[8, 8, 8, 8, 8, 8].map((height, index) => (
              <View key={index} style={[styles.bar, { height }]} />
            ))}
          </View>
        </Card>
      )}
      {slug === 'calendario' && <Calendar />}
      {rows.length > 0 ? (
        <Card style={styles.list}>
          {rows.map((item, index) => (
            <View
              key={item.title}
              style={[
                styles.row,
                index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name={item.icon} color={theme.primary} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.rowValue, { color: theme.text }]}>{item.value}</Text>
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {feature?.subtitle ?? 'Esta sección estará lista en la próxima actualización.'}
          </Text>
        </Card>
      )}
      {showAdd ? <PrimaryButton icon="plus">Añadir {title.toLowerCase()}</PrimaryButton> : null}
    </Screen>
  );
}

function RemindersSettings() {
  const theme = useAppTheme();
  const remindersEnabled = usePreferencesStore((state) => state.remindersEnabled);
  const setRemindersEnabled = usePreferencesStore((state) => state.setRemindersEnabled);
  const reminderPayments = usePreferencesStore((state) => state.reminderPayments);
  const setReminderPayments = usePreferencesStore((state) => state.setReminderPayments);
  const reminderGoals = usePreferencesStore((state) => state.reminderGoals);
  const setReminderGoals = usePreferencesStore((state) => state.setReminderGoals);
  const reminderCalendar = usePreferencesStore((state) => state.reminderCalendar);
  const setReminderCalendar = usePreferencesStore((state) => state.setReminderCalendar);
  const [busy, setBusy] = useState(false);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);

  const toggleMaster = async (value: boolean) => {
    setBusy(true);
    setPermissionNote(null);
    try {
      await setRemindersEnabled(value);
      if (value) {
        const granted = await configureActivityNotifications();
        if (!granted && Platform.OS !== 'web') {
          setPermissionNote('Activa las notificaciones del sistema para recibir recordatorios.');
        }
        if (Platform.OS === 'web') {
          setPermissionNote(
            'En la web los avisos se ven en la app. En iPhone/Android también llegan como notificaciones.',
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen withTabBar title="Recordatorios" subtitle="Pagos, metas y calendario" right={<BackButton />}>
      <Card style={styles.list}>
        <ToggleRow
          icon="bell"
          title="Recordatorios"
          subtitle="Avisos de la app"
          value={remindersEnabled}
          disabled={busy}
          onChange={(value) => {
            void toggleMaster(value);
          }}
        />
        <ToggleRow
          icon="banknote.fill"
          title="Pagos y movimientos"
          subtitle="Recaudos e ingresos/gastos"
          value={reminderPayments}
          disabled={!remindersEnabled}
          onChange={(value) => {
            void setReminderPayments(value);
          }}
        />
        <ToggleRow
          icon="flag.fill"
          title="Metas"
          subtitle="Progreso y límites"
          value={reminderGoals}
          disabled={!remindersEnabled}
          onChange={(value) => {
            void setReminderGoals(value);
          }}
        />
        <ToggleRow
          icon="calendar"
          title="Calendario"
          subtitle="Eventos y cumpleaños"
          value={reminderCalendar}
          disabled={!remindersEnabled}
          onChange={(value) => {
            void setReminderCalendar(value);
          }}
        />
      </Card>
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Cómo funciona</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          {permissionNote ??
            'Los recordatorios del calendario y recaudos usan estas preferencias. Si los desactivas, TecnoWallet no programa avisos nuevos.'}
        </Text>
      </Card>
    </Screen>
  );
}

function BiometricsSettings() {
  const theme = useAppTheme();
  const lockEnabled = usePreferencesStore((state) => state.biometricsLockEnabled);
  const setLockEnabled = usePreferencesStore((state) => state.setBiometricsLockEnabled);
  const hideBalances = usePreferencesStore((state) => state.hideBalances);
  const setHideBalances = usePreferencesStore((state) => state.setHideBalances);
  const autoLockDelay = usePreferencesStore((state) => state.autoLockDelay);
  const setAutoLockDelay = usePreferencesStore((state) => state.setAutoLockDelay);
  const [busy, setBusy] = useState(false);
  const [capabilityLabel, setCapabilityLabel] = useState('Face ID / biometría');
  const [pinModal, setPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getBiometricCapability().then((cap) => setCapabilityLabel(cap.label));
  }, []);

  const enableLock = async () => {
    setBusy(true);
    setError(null);
    try {
      const cap = await getBiometricCapability();
      if (Platform.OS !== 'web' && cap.available) {
        const auth = await authenticateAppUnlock('Confirma para activar el bloqueo');
        if (!auth.success) {
          setError('No se pudo verificar. Inténtalo de nuevo.');
          return;
        }
        const hasPin = await hasAppLockPin();
        if (!hasPin) setPinModal(true);
        else await setLockEnabled(true);
        return;
      }
      setPinModal(true);
    } finally {
      setBusy(false);
    }
  };

  const disableLock = async () => {
    setBusy(true);
    setError(null);
    try {
      if (Platform.OS !== 'web') {
        const auth = await authenticateAppUnlock('Confirma para desactivar el bloqueo');
        if (!auth.success) {
          const hasPin = await hasAppLockPin();
          if (!hasPin) {
            setError('No se pudo verificar.');
            return;
          }
        }
      }
      await setLockEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const savePinAndEnable = async () => {
    setError(null);
    if (pin.length < 4) {
      setError('La clave debe tener al menos 4 dígitos.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('Las claves no coinciden.');
      return;
    }
    setBusy(true);
    try {
      await setAppLockPin(pin);
      await setLockEnabled(true);
      setPinModal(false);
      setPin('');
      setPinConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clave.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen withTabBar title="Face ID / Biometría" subtitle="Desbloqueo al abrir la app" right={<BackButton />}>
      <Card style={styles.list}>
        <ToggleRow
          icon="faceid"
          title={capabilityLabel}
          subtitle="Pedir verificación al abrir"
          value={lockEnabled}
          disabled={busy}
          onChange={(value) => {
            void (value ? enableLock() : disableLock());
          }}
        />
        <ToggleRow
          icon="eye.slash.fill"
          title="Ocultar saldos"
          subtitle="Al entrar a Inicio"
          value={hideBalances}
          onChange={(value) => {
            void setHideBalances(value);
          }}
        />
      </Card>

      <Card style={styles.list}>
        <Text style={[styles.settingTitle, { color: theme.text, marginBottom: 8 }]}>Bloquear de nuevo</Text>
        {(['immediate', '1m', '5m'] as AutoLockDelay[]).map((option) => (
          <OptionRow
            key={option}
            title={autoLockDelayLabel(option)}
            selected={autoLockDelay === option}
            onPress={() => {
              void setAutoLockDelay(option);
            }}
          />
        ))}
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Respaldo con clave</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Además de Face ID o huella, puedes usar una clave numérica si el dispositivo no tiene biometría o estás en la
          web.
        </Text>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            icon="key.fill"
            onPress={() => {
              setPinModal(true);
              setError(null);
            }}>
            {lockEnabled ? 'Cambiar clave' : 'Definir clave'}
          </PrimaryButton>
        </View>
        {lockEnabled ? (
          <Pressable
            style={{ marginTop: 12 }}
            onPress={() => {
              Alert.alert('Quitar clave', '¿Eliminar la clave de respaldo?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar',
                  style: 'destructive',
                  onPress: () => {
                    void clearAppLockPin();
                  },
                },
              ]);
            }}>
            <Text style={{ color: theme.muted, fontSize: 13 }}>Eliminar clave de respaldo</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={{ color: '#E5484D', marginTop: 10, fontSize: 13 }}>{error}</Text> : null}
      </Card>

      <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}>
        <View style={styles.modalScrim}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Clave de desbloqueo</Text>
            <Text style={[styles.body, { color: theme.muted }]}>Elige 4 a 8 dígitos para abrir la app.</Text>
            <TextInput
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="Nueva clave"
              placeholderTextColor={theme.muted}
              style={[
                styles.pinField,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
              ]}
            />
            <TextInput
              value={pinConfirm}
              onChangeText={(value) => setPinConfirm(value.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="Confirmar clave"
              placeholderTextColor={theme.muted}
              style={[
                styles.pinField,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
              ]}
            />
            {error ? <Text style={{ color: '#E5484D', fontSize: 13 }}>{error}</Text> : null}
            <View style={uiStyles.row}>
              <Pressable
                onPress={() => {
                  setPinModal(false);
                  setPin('');
                  setPinConfirm('');
                  setError(null);
                }}
                style={[styles.modalBtn, { borderColor: theme.border }]}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => {
                  void savePinAndEnable();
                }}
                style={[styles.modalBtnPrimary, { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }]}>
                {busy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function AdvancedSettings() {
  const weekStartsOn = usePreferencesStore((state) => state.weekStartsOn);
  const setWeekStartsOn = usePreferencesStore((state) => state.setWeekStartsOn);
  const hapticsEnabled = usePreferencesStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = usePreferencesStore((state) => state.setHapticsEnabled);
  const appearance = usePreferencesStore((state) => state.appearance);
  const setAppearance = usePreferencesStore((state) => state.setAppearance);
  const theme = useAppTheme();

  return (
    <Screen withTabBar title="Más ajustes" subtitle="Semana y opciones avanzadas" right={<BackButton />}>
      <Card style={styles.list}>
        <Text style={[styles.settingTitle, { color: theme.text, marginBottom: 8 }]}>Inicio de semana</Text>
        {(['monday', 'sunday'] as WeekStartsOn[]).map((option) => (
          <OptionRow
            key={option}
            title={weekStartsOnLabel(option)}
            selected={weekStartsOn === option}
            onPress={() => {
              void setWeekStartsOn(option);
            }}
          />
        ))}
      </Card>

      <Card style={styles.list}>
        <Text style={[styles.settingTitle, { color: theme.text, marginBottom: 8 }]}>Apariencia</Text>
        {(['system', 'light', 'dark'] as AppearanceMode[]).map((option) => (
          <OptionRow
            key={option}
            title={appearanceLabel(option)}
            selected={appearance === option}
            onPress={() => {
              void setAppearance(option);
            }}
          />
        ))}
      </Card>

      <Card style={styles.list}>
        <ToggleRow
          icon="speaker.wave.2.fill"
          title="Hápticos"
          subtitle="Vibración al tocar"
          value={hapticsEnabled}
          onChange={(value) => {
            void setHapticsEnabled(value);
          }}
        />
      </Card>
    </Screen>
  );
}

function FaqSettings() {
  const theme = useAppTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Screen
      withTabBar
      title="Preguntas frecuentes"
      subtitle="Guías y respuestas rápidas"
      right={<BackButton />}>
      <Card style={styles.list}>
        {FAQ_ITEMS.map((item, index) => {
          const open = openIndex === index;
          return (
            <View
              key={item.question}
              style={[
                styles.faqBlock,
                index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpenIndex(open ? null : index)}
                style={styles.faqHeader}>
                <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
                  <AppIcon name="questionmark.circle.fill" color={theme.primary} />
                </View>
                <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.question}</Text>
                <AppIcon name={open ? 'chevron.down' : 'chevron'} color={theme.muted} />
              </Pressable>
              {open ? (
                <Text style={[styles.faqAnswer, { color: theme.muted }]}>{item.answer}</Text>
              ) : null}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

function ContactSettings() {
  const theme = useAppTheme();

  const openEmail = async () => {
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Consulta TecnoWallet')}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Correo', CONTACT_EMAIL);
    }
  };

  const openWhatsApp = async () => {
    const text = encodeURIComponent('Hola, tengo una consulta sobre TecnoWallet.');
    const appUrl = `whatsapp://send?phone=${CONTACT_WHATSAPP_DIGITS}&text=${text}`;
    const webUrl = `https://wa.me/${CONTACT_WHATSAPP_DIGITS}?text=${text}`;
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpen ? appUrl : webUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        Alert.alert('WhatsApp', CONTACT_WHATSAPP);
      }
    }
  };

  return (
    <Screen withTabBar title="Contáctanos" subtitle="Estamos para ayudarte" right={<BackButton />}>
      <Card style={styles.list}>
        <Pressable onPress={() => void openEmail()} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="envelope.fill" color={theme.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Correo</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{CONTACT_EMAIL}</Text>
          </View>
          <AppIcon name="chevron" color={theme.muted} />
        </Pressable>
        <Pressable
          onPress={() => void openWhatsApp()}
          style={[styles.row, { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={[styles.icon, { backgroundColor: '#E7F8EF' }]}>
            <AppIcon name="logo.whatsapp" color="#12B76A" />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>WhatsApp</Text>
            <Text style={[styles.small, { color: theme.muted }]}>{CONTACT_WHATSAPP}</Text>
          </View>
          <AppIcon name="chevron" color={theme.muted} />
        </Pressable>
      </Card>
      <Card>
        <Text style={[styles.body, { color: theme.muted, marginTop: 0 }]}>
          Escríbenos por correo o WhatsApp y te respondemos lo antes posible.
        </Text>
      </Card>
    </Screen>
  );
}

function BackButton() {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={16}
      onPress={() => safeGoBack('/(tabs)/mas')}
      style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
      <AppIcon name="arrow.left" color={theme.text} />
    </Pressable>
  );
}

type ChatBubble = { id: string; role: 'user' | 'assistant'; text: string };

function AssistantFeature() {
  const theme = useAppTheme();
  const active = useActiveLedger();
  const plusAccess = usePlusStore((state) => state.access);
  const openPaywall = usePlusStore((state) => state.openPaywall);
  const isPlus = hasPaidPlan(plusAccess);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Pregunta por categorías, totales del mes, saldos o metas. TecnoWallet calcula los números; la IA solo interpreta y responde.',
    },
  ]);

  const send = async () => {
    const text = question.trim();
    if (!text || busy) return;
    if (!isPlus) {
      openPaywall('AI_REQUIRED');
      return;
    }
    const workspaceId = active.activeLedgerId || active.ledger.id;
    if (!workspaceId) {
      setError('No hay un libro activo.');
      return;
    }
    setError(null);
    setQuestion('');
    const userId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userId, role: 'user', text }]);
    setBusy(true);
    try {
      const result = await askAssistant({
        workspaceId,
        message: text,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.answer,
        },
      ]);
    } catch (err) {
      if (isPlusRequiredError(err)) {
        openPaywall(plusReasonFromError(err), {
          plan: paywallPlanFromError(err),
        });
        return;
      }
      const message = err instanceof ApiError ? err.message : 'No pudimos consultar al asistente.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: message,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen withTabBar title="Asistente IA" subtitle="Análisis privado de tus finanzas" right={<BackButton />}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, gap: 12 }}>
        <Card style={[styles.hero, { backgroundColor: theme.primary }]}>
          <AppIcon name="sparkles" color="#FFFFFF" size={30} />
          <Text style={styles.heroTitle}>Pregunta lo que quieras sobre tu dinero</Text>
          <Text style={styles.heroHint}>
            Los cálculos los hace TecnoWallet. La IA no recibe tu historial completo ni mueve dinero.
          </Text>
        </Card>

        {!isPlus ? (
          <Card style={styles.upgradeCard}>
            <View style={styles.upgradeHeader}>
              <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name="sparkles" color={theme.primary} />
              </View>
              <View style={styles.upgradeCopy}>
                <View style={uiStyles.row}>
                  <Pill tone="blue">TecnoWallet+</Pill>
                </View>
                <Text style={[styles.upgradeTitle, { color: theme.text }]}>Incluido en planes de pago</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  El asistente necesita TecnoWallet+ o Business.
                </Text>
              </View>
            </View>
            <PrimaryButton icon="star.fill" onPress={() => openPaywall('AI_REQUIRED')}>
              Ver planes
            </PrimaryButton>
          </Card>
        ) : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.role === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: theme.primary }
                  : { alignSelf: 'flex-start', backgroundColor: theme.surfaceSecondary },
              ]}>
              <Text style={{ color: message.role === 'user' ? '#FFFFFF' : theme.text, fontSize: 14, lineHeight: 20 }}>
                {message.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        {error ? <Text style={{ color: '#E5484D', fontSize: 12 }}>{error}</Text> : null}

        <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="¿En qué gasté más?"
            placeholderTextColor={theme.muted}
            style={[styles.composerInput, { color: theme.text }]}
            editable={!busy && isPlus}
            onFocus={() => {
              if (!isPlus) openPaywall('AI_REQUIRED');
            }}
            onSubmitEditing={() => {
              void send();
            }}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !question.trim()}
            onPress={() => {
              void send();
            }}
            style={[
              styles.send,
              {
                backgroundColor: theme.primary,
                opacity: busy || !question.trim() ? 0.5 : 1,
              },
            ]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppIcon name="paperplane.fill" color="#FFFFFF" size={17} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, disabled ? { opacity: 0.45 } : null]}>
      <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
        <AppIcon name={icon} color={theme.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.small, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: theme.primary }} />
    </View>
  );
}

function OptionRow({ title, selected, onPress }: { title: string; selected: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
      {selected ? <AppIcon name="checkmark.circle.fill" color={theme.primary} /> : null}
    </Pressable>
  );
}

function Calendar() {
  const theme = useAppTheme();
  return (
    <Card>
      <View style={styles.days}>
        {Array.from({ length: 35 }, (_, index) => (
          <View key={index} style={[styles.day, index === 11 && { backgroundColor: theme.primary }]}>
            <Text style={{ color: index === 11 ? '#FFFFFF' : theme.text, fontSize: 12 }}>
              {index < 4 ? '' : index - 3}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 10 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heroHint: { color: '#DCEBFF', fontSize: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  composer: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerInput: { flex: 1, minHeight: 40 },
  send: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 2 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 13, fontWeight: '700' },
  small: { fontSize: 11, lineHeight: 16 },
  settingTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  body: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  upgradeCard: { gap: 12 },
  upgradeHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  upgradeCopy: { flex: 1, gap: 8 },
  upgradeTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  statsValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '700' },
  bars: { height: 100, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bar: { flex: 1, borderRadius: 6, backgroundColor: '#FFFFFF85' },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  faqBlock: { paddingVertical: 10, gap: 8 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20, paddingRight: 8 },
  faqAnswer: { fontSize: 13, lineHeight: 20, paddingLeft: 52, paddingBottom: 8 },
  modalScrim: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  pinField: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 3,
    textAlign: 'center',
  },
  modalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  modalBtnPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
