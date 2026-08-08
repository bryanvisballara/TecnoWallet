import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, ProgressBar, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { featureGroups, money, upcoming } from '@/data/demo';

const content: Record<string, Array<{ title: string; subtitle: string; value: string; icon: string }>> = {
  facturas: upcoming.map((item) => ({ title: item.name, subtitle: item.date, value: money(item.amount), icon: 'doc.text.fill' })),
  suscripciones: [
    { title: 'Netflix', subtitle: '$191.88 al año', value: '$15.99', icon: 'play.rectangle.fill' },
    { title: 'Spotify', subtitle: '$131.88 al año', value: '$10.99', icon: 'music.note' },
    { title: 'iCloud+', subtitle: '$35.88 al año', value: '$2.99', icon: 'icloud.fill' },
  ],
  recurrentes: [
    { title: 'Ahorro automático', subtitle: 'Cada día 1 · Cuenta principal', value: '$350', icon: 'leaf.fill' },
    { title: 'Alquiler', subtitle: 'Cada día 8 · Visa Tecno', value: '$980', icon: 'house.fill' },
    { title: 'Gym', subtitle: 'Cada día 3 · Visa Tecno', value: '$39', icon: 'flame.fill' },
  ],
  metas: [
    { title: 'Fondo de emergencia', subtitle: '74% · diciembre 2026', value: '$7,400', icon: 'shield.fill' },
    { title: 'Viaje a Japón', subtitle: '46% · abril 2027', value: '$2,760', icon: 'airplane' },
    { title: 'Nueva laptop', subtitle: '31% · noviembre 2026', value: '$620', icon: 'laptopcomputer' },
  ],
  familia: [
    { title: 'Alex Rivera', subtitle: 'Administrador · compartido', value: '$1,840', icon: 'person.crop.circle' },
    { title: 'Sam Rivera', subtitle: 'Miembro · compartido', value: '$982', icon: 'person.crop.circle' },
  ],
  bancos: [
    { title: 'Banco Atlántico', subtitle: 'Cuenta corriente · lista', value: 'Conectado', icon: 'building.columns.fill' },
    { title: 'Visa Tecno', subtitle: 'Crédito · sincronizada', value: 'Activa', icon: 'creditcard.fill' },
  ],
  ocr: [
    { title: 'Ticket Super Central', subtitle: 'Hoy · pendiente de revisar', value: '$86.42', icon: 'photo.fill' },
    { title: 'Factura Internet', subtitle: 'Ayer · listo', value: '$44.90', icon: 'doc.text.fill' },
  ],
  faq: [
    { title: '¿Cómo funcionan los sobres?', subtitle: 'Presupuesto por categoría', value: 'Guía', icon: 'wallet.pass.fill' },
    { title: '¿Mis datos están seguros?', subtitle: 'Cifrado y Face ID', value: 'Guía', icon: 'lock.shield.fill' },
    { title: '¿Puedo exportar todo?', subtitle: 'CSV al estilo Budget', value: 'Guía', icon: 'square.and.arrow.up' },
  ],
};

const settingsSlugs = new Set([
  'seguridad',
  'ajustes',
  'backup',
  'sync',
  'tema',
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
  const [question, setQuestion] = useState('');
  const title = feature?.title ?? 'TecnoWallet';

  if (slug === 'asistente') {
    return (
      <Screen title="Asistente IA" subtitle="Análisis privado de tus finanzas" right={<BackButton />}>
        <Card style={[styles.hero, { backgroundColor: theme.primary }]}><AppIcon name="sparkles" color="#FFFFFF" size={30} /><Text style={styles.heroTitle}>Pregunta lo que quieras sobre tu dinero</Text><Text style={styles.heroHint}>La IA nunca moverá dinero sin tu confirmación.</Text></Card>
        {['Este mes gastaste 18% menos que el anterior.', 'Alimentación terminará con unos $94 disponibles.', 'Dos suscripciones cuestan $227 al año.'].map((message) => <Card key={message}><View style={uiStyles.row}><View style={[styles.icon, { backgroundColor: theme.primarySoft }]}><AppIcon name="sparkles" color={theme.primary} /></View><Text style={[styles.insight, { color: theme.text }]}>{message}</Text></View></Card>)}
        <View style={[styles.composer, { backgroundColor: theme.surface, borderColor: theme.border }]}><TextInput value={question} onChangeText={setQuestion} placeholder="¿En qué gasté más?" placeholderTextColor={theme.muted} style={[styles.composerInput, { color: theme.text }]} /><View style={[styles.send, { backgroundColor: theme.primary }]}><AppIcon name="paperplane.fill" color="#FFFFFF" size={17} /></View></View>
      </Screen>
    );
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
          <Text style={styles.statsValue}>{money(1328.4)}</Text>
          <Pill tone="green">↑ 14.2% este año</Pill>
          <View style={styles.bars}>
            {[42, 64, 50, 78, 61, 88].map((height, index) => (
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
      {slug === 'metas' && (
        <Card>
          <View style={uiStyles.between}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Progreso total</Text>
            <Text style={{ color: theme.success, fontWeight: '700' }}>61%</Text>
          </View>
          <ProgressBar value={0.61} color={theme.success} />
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
