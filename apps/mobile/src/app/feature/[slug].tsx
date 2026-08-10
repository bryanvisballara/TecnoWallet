import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useActiveLedger } from '@/store/ledger';

const content: Record<string, Array<{ title: string; subtitle: string; value: string; icon: string }>> = {
  facturas: [],
  suscripciones: [],
  recurrentes: [],
  metas: [],
  familia: [],
  bancos: [],
  ocr: [],
  faq: [
    { title: '¿Cómo funcionan los sobres?', subtitle: 'Presupuesto por categoría', value: 'Guía', icon: 'wallet.pass.fill' },
    { title: '¿Mis datos son seguros?', subtitle: 'Cifrado y Face ID', value: 'Guía', icon: 'lock.shield.fill' },
    { title: '¿Puedo exportar todo?', subtitle: 'CSV al estilo Budget', value: 'Guía', icon: 'square.and.arrow.up' },
  ],
};

const settingsSlugs = new Set([
  'seguridad',
  'ajustes',
  'backup',
  'sync',
  'tema',
  'apariencia',
  'recordatorios',
  'sonido',
  'actividad',
  'valorar',
  'contacto',
  'transferir',
  'presupuesto-ia',
]);

export default function FeatureScreen() {
  const theme = useAppTheme();
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const feature = useMemo(() => featureGroups.flatMap((group) => group.items).find((item) => item.slug === slug), [slug]);
  const [biometrics, setBiometrics] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);
  const [sounds, setSounds] = useState(false);
  const title = feature?.title ?? 'TecnoWallet';

  useEffect(() => {
    if (slug === 'metas') router.replace('/(tabs)/metas');
    if (slug === 'facturas' || slug === 'suscripciones' || slug === 'recurrentes') {
      router.replace('/(tabs)/salud-financiera');
    }
  }, [slug]);

  if (
    slug === 'metas' ||
    slug === 'facturas' ||
    slug === 'suscripciones' ||
    slug === 'recurrentes'
  ) {
    return null;
  }

  if (slug === 'asistente') {
    return <AssistantFeature />;
  }

  if (settingsSlugs.has(slug)) {
    return (
      <Screen title={title} subtitle={feature?.subtitle} right={<BackButton />}>
        <Card style={styles.list}>
          <ToggleRow icon="faceid" title="Face ID / biometría" value={biometrics} onChange={setBiometrics} />
          <ToggleRow icon="bell" title="Alertas inteligentes" value={notifications} onChange={setNotifications} />
          <ToggleRow icon="icloud.and.arrow.up" title="Sincronización en la nube" value={cloudSync} onChange={setCloudSync} />
          <ToggleRow icon="speaker.wave.2.fill" title="Sonido y haptics" value={sounds} onChange={setSounds} />
          <StaticRow icon="lock.fill" title="Bloqueo automático" value="1 minuto" />
          <StaticRow icon="globe" title="Moneda e idioma" value="USD · Español" />
          <StaticRow icon="moon.fill" title="Apariencia" value="Automática" />
          <StaticRow icon="calendar" title="Inicio de semana" value="Lunes" />
        </Card>
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferencias</Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            Ajusta seguridad, avisos y sincronización. La exportación CSV está en Más → Exportar.
          </Text>
        </Card>
      </Screen>
    );
  }

  const rows = content[slug] ?? [];
  const showAdd = !['faq', 'estadisticas', 'calendario'].includes(slug) && rows.length > 0;
  return (
    <Screen title={title} subtitle={feature?.subtitle} right={<BackButton />}>
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
              style={[styles.row, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
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

function BackButton() {
  const theme = useAppTheme();
  return <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}><AppIcon name="arrow.left" color={theme.text} /></Pressable>;
}

type ChatBubble = { id: string; role: 'user' | 'assistant'; text: string };

function AssistantFeature() {
  const theme = useAppTheme();
  const active = useActiveLedger();
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
      const message =
        err instanceof ApiError
          ? err.message
          : 'No pudimos consultar al asistente.';
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
    <Screen title="Asistente IA" subtitle="Análisis privado de tus finanzas" right={<BackButton />}>
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

        <ScrollView style={{ flexGrow: 0, maxHeight: 360 }} contentContainerStyle={{ gap: 10 }}>
          {messages.map((item) => (
            <Card
              key={item.id}
              style={{
                backgroundColor:
                  item.role === 'user' ? theme.primarySoft : theme.surface,
              }}>
              <View style={uiStyles.row}>
                <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
                  <AppIcon
                    name={item.role === 'user' ? 'person.fill' : 'sparkles'}
                    color={theme.primary}
                  />
                </View>
                <Text style={[styles.insight, { color: theme.text }]}>{item.text}</Text>
              </View>
            </Card>
          ))}
        </ScrollView>

        {error ? (
          <Text style={{ color: '#E5484D', fontSize: 12 }}>{error}</Text>
        ) : null}

        <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="¿En qué gasté más?"
            placeholderTextColor={theme.muted}
            style={[styles.composerInput, { color: theme.text }]}
            editable={!busy}
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

function ToggleRow({ icon, title, value, onChange }: { icon: string; title: string; value: boolean; onChange: (value: boolean) => void }) {
  const theme = useAppTheme();
  return <View style={styles.row}><View style={[styles.icon, { backgroundColor: theme.primarySoft }]}><AppIcon name={icon} color={theme.primary} /></View><Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: theme.primary }} /></View>;
}

function StaticRow({ icon, title, value }: { icon: string; title: string; value: string }) {
  const theme = useAppTheme();
  return <View style={styles.row}><View style={[styles.icon, { backgroundColor: theme.primarySoft }]}><AppIcon name={icon} color={theme.primary} /></View><Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.small, { color: theme.muted }]}>{value}</Text></View>;
}

function Calendar() {
  const theme = useAppTheme();
  return <Card><View style={styles.days}>{Array.from({ length: 35 }, (_, index) => <View key={index} style={[styles.day, index === 11 && { backgroundColor: theme.primary }]}><Text style={{ color: index === 11 ? '#FFFFFF' : theme.text, fontSize: 12 }}>{index < 4 ? '' : index - 3}</Text></View>)}</View></Card>;
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderWidth: 0, gap: 10 }, heroTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '700' }, heroHint: { color: '#DCEBFF', fontSize: 12 },
  insight: { flex: 1, fontSize: 14, lineHeight: 20 }, icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  composer: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 8, paddingLeft: 16, flexDirection: 'row', alignItems: 'center' }, composerInput: { flex: 1, minHeight: 40 }, send: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: 2 }, row: { minHeight: 72, flexDirection: 'row', alignItems: 'center' }, copy: { flex: 1, gap: 3 }, rowTitle: { fontSize: 14, fontWeight: '600' }, rowValue: { fontSize: 13, fontWeight: '700' }, small: { fontSize: 11, lineHeight: 16 },
  settingTitle: { flex: 1, fontSize: 14, fontWeight: '600' }, sectionTitle: { fontSize: 18, fontWeight: '700' }, body: { marginTop: 8, fontSize: 13, lineHeight: 20 }, buttonGap: { marginTop: 18 },
  statsValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '700' }, bars: { height: 100, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, bar: { flex: 1, borderRadius: 6, backgroundColor: '#FFFFFF85' },
  days: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
