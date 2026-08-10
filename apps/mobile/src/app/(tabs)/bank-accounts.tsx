import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { safeGoBack } from '@/lib/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon, Card, Pill, ScalePressable, Screen, uiStyles, useAppTheme } from '@/components/ui';
import { money } from '@/data/demo';
import { useActiveLedger } from '@/store/ledger';
import { useBankStore, type PendingBankTx } from '@/store/bank';

declare global {
  interface Window {
    belvoSDK?: {
      createWidget: (
        accessToken: string,
        options: Record<string, unknown>,
      ) => { build: () => void };
    };
  }
}

function fromMinor(amountMinor: number, currency: string) {
  const zero = ['COP', 'CLP', 'JPY', 'KRW', 'VND', 'PYG'].includes(currency);
  return zero ? amountMinor : amountMinor / 100;
}

function PendingRow({
  item,
  busy,
  onConfirm,
  onDismiss,
}: {
  item: PendingBankTx;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const amount = fromMinor(item.amountMinor, item.currency);
  const tone = item.kind === 'income' ? theme.success : theme.danger;
  return (
    <Card style={styles.pendingCard}>
      <View style={uiStyles.between}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {item.merchantName || item.description}
          </Text>
          <Text style={[styles.small, { color: theme.muted }]}>
            {new Date(item.occurredAt).toLocaleDateString('es')} · {item.kind === 'income' ? 'Ingreso' : 'Gasto'}
          </Text>
        </View>
        <Text style={[styles.amount, { color: tone }]}>
          {money(amount)}
        </Text>
      </View>
      <View style={styles.actions}>
        <ScalePressable
          disabled={busy}
          onPress={onDismiss}
          style={[styles.actionBtn, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={[styles.actionText, { color: theme.text }]}>Ignorar</Text>
        </ScalePressable>
        <ScalePressable
          disabled={busy}
          onPress={onConfirm}
          style={[styles.actionBtn, { backgroundColor: theme.primary }]}>
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Agregar al libro</Text>
        </ScalePressable>
      </View>
    </Card>
  );
}

async function openBelvoWidgetWeb(accessToken: string): Promise<{
  linkId: string;
  institution?: string;
} | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;

  await new Promise<void>((resolve, reject) => {
    if (window.belvoSDK) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-belvo-widget]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se cargó Belvo Widget')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.belvo.io/belvo-widget-1-stable.js';
    script.async = true;
    script.dataset.belvoWidget = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se cargó Belvo Widget'));
    document.body.appendChild(script);
  });

  // Belvo requires a mount node: <div id="belvo"></div>
  let mount = document.getElementById('belvo');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'belvo';
    document.body.appendChild(mount);
  }
  Object.assign(mount.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99999',
    background: 'rgba(8,11,18,0.45)',
  });

  const cleanup = () => {
    const node = document.getElementById('belvo');
    if (node) {
      node.replaceChildren();
      node.removeAttribute('style');
      // Keep the node in DOM for the next open (Belvo looks it up by id).
      Object.assign(node.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '99999',
        display: 'none',
      });
    }
  };

  return new Promise((resolve, reject) => {
    if (!window.belvoSDK) {
      cleanup();
      reject(new Error('Belvo Widget no disponible'));
      return;
    }
    mount!.style.display = 'block';
    try {
      window.belvoSDK
        .createWidget(accessToken, {
          locale: 'es',
          // Sandbox keys currently expose bank mocks mainly in BR (not CO).
          country_codes: ['BR', 'MX', 'CL'],
          institution_types: ['bank'],
          callback: (
            link: string | { id?: string },
            institution?: { name?: string; code?: string },
          ) => {
            const linkId = typeof link === 'string' ? link : link?.id;
            cleanup();
            if (!linkId) {
              reject(new Error('Belvo no devolvió el link'));
              return;
            }
            resolve({
              linkId,
              institution: institution?.name || institution?.code,
            });
          },
          onExit: () => {
            cleanup();
            resolve(null);
          },
          onError: (error: { message?: string }) => {
            cleanup();
            reject(new Error(error?.message || 'Error en Belvo Widget'));
          },
        })
        .build();
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('No se pudo abrir Belvo'));
    }
  });
}

export default function BankAccountsScreen() {
  const theme = useAppTheme();
  const { ledger, activeLedgerId } = useActiveLedger();
  const connections = useBankStore((state) => state.connections);
  const pending = useBankStore((state) => state.pending);
  const loading = useBankStore((state) => state.loading);
  const error = useBankStore((state) => state.error);
  const refresh = useBankStore((state) => state.refresh);
  const createWidgetToken = useBankStore((state) => state.createWidgetToken);
  const registerLink = useBankStore((state) => state.registerLink);
  const sync = useBankStore((state) => state.sync);
  const confirmPending = useBankStore((state) => state.confirmPending);
  const dismissPending = useBankStore((state) => state.dismissPending);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (activeLedgerId) void refresh(activeLedgerId);
  }, [activeLedgerId, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const connectBank = async () => {
    if (!activeLedgerId) return;
    setBusy(true);
    try {
      const token = await createWidgetToken(activeLedgerId);
      let linkId = '';
      let institution = '';

      if (Platform.OS === 'web') {
        const result = await openBelvoWidgetWeb(token.access);
        if (!result) return;
        linkId = result.linkId;
        institution = result.institution ?? '';
      } else {
        const browser = await WebBrowser.openAuthSessionAsync(token.widgetUrl, undefined);
        if (browser.type !== 'success') return;
        Alert.alert(
          'Casi listo',
          'Si conectaste el banco, pega el link ID de Belvo o vuelve a sincronizar desde el panel.',
        );
        return;
      }

      await registerLink({
        workspaceId: activeLedgerId,
        belvoLinkId: linkId,
        institutionName: institution,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      Alert.alert(
        'No se pudo conectar',
        cause instanceof Error ? cause.message : 'Inténtalo de nuevo.',
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    if (!activeLedgerId) return;
    setBusy(true);
    try {
      const result = await sync(activeLedgerId);
      Alert.alert(
        'Sincronizado',
        result.importedPending
          ? `${result.importedPending} movimiento(s) nuevo(s) por confirmar.`
          : 'No hay movimientos nuevos.',
      );
    } catch (cause) {
      Alert.alert(
        'Error al sincronizar',
        cause instanceof Error ? cause.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!ledger) {
    return <Screen withTabBar title="Cuentas bancarias" />;
  }

  return (
    <Screen
      withTabBar
      title="Cuentas bancarias"
      subtitle={`Belvo · ${ledger.name}`}
      right={
        <Pressable
          onPress={() => {
            safeGoBack('/(tabs)/mas');
          }}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="xmark" color={theme.text} />
        </Pressable>
      }>
      <Card style={styles.hero}>
        <Text style={[styles.heroTitle, { color: theme.text }]}>
          Conecta tu banco
        </Text>
        <Text style={[styles.small, { color: theme.muted }]}>
          Usamos Belvo sandbox para leer movimientos. En sandbox no hay bancos de Colombia:
          prueba con instituciones de Brasil (p. ej. Iron Bank). En producción sí aparecerán
          bancos CO. Cada gasto nuevo se lista abajo para confirmar si lo agregas al libro.
        </Text>
        <ScalePressable
          disabled={busy}
          onPress={() => void connectBank()}
          style={[styles.primary, { backgroundColor: theme.primary, opacity: busy ? 0.7 : 1 }]}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>Conectar con Belvo</Text>
          )}
        </ScalePressable>
        {connections.length > 0 ? (
          <ScalePressable
            disabled={busy}
            onPress={() => void runSync()}
            style={[styles.secondary, { borderColor: theme.border }]}>
            <Text style={[styles.secondaryText, { color: theme.primary }]}>
              Buscar movimientos nuevos
            </Text>
          </ScalePressable>
        ) : null}
      </Card>

      <Text style={[styles.section, { color: theme.muted }]}>CONEXIONES</Text>
      {loading && connections.length === 0 ? (
        <ActivityIndicator color={theme.primary} />
      ) : connections.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            Aún no hay bancos conectados.
          </Text>
        </Card>
      ) : (
        connections.map((item) => (
          <Card key={item.id}>
            <View style={[uiStyles.row, uiStyles.gap12]}>
              <View style={[styles.icon, { backgroundColor: `${theme.primary}1A` }]}>
                <AppIcon name="building.columns.fill" color={theme.primary} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.title, { color: theme.text }]}>{item.institutionName}</Text>
                <Text style={[styles.small, { color: theme.muted }]}>
                  {item.lastSyncedAt
                    ? `Última sync · ${new Date(item.lastSyncedAt).toLocaleString('es')}`
                    : 'Sin sincronizar aún'}
                </Text>
              </View>
              <Pill tone="green">{item.status}</Pill>
            </View>
          </Card>
        ))
      )}

      <Text style={[styles.section, { color: theme.muted }]}>POR CONFIRMAR</Text>
      {pending.length === 0 ? (
        <Card>
          <Text style={[styles.small, { color: theme.muted, textAlign: 'center' }]}>
            Cuando Belvo detecte un movimiento, te pediremos confirmación aquí (luego también por
            push).
          </Text>
        </Card>
      ) : (
        pending.map((item) => (
          <PendingRow
            key={item.id}
            item={item}
            busy={busy}
            onConfirm={() => {
              setBusy(true);
              void confirmPending(item.id)
                .then(() =>
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
                )
                .catch((cause) =>
                  Alert.alert(
                    'No se pudo agregar',
                    cause instanceof Error ? cause.message : 'Inténtalo de nuevo.',
                  ),
                )
                .finally(() => setBusy(false));
            }}
            onDismiss={() => {
              setBusy(true);
              void dismissPending(item.id).finally(() => setBusy(false));
            }}
          />
        ))
      )}

      {error ? (
        <Text style={[styles.small, { color: theme.danger }]}>{error}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { gap: 12 },
  heroTitle: { fontSize: 20, fontWeight: '700' },
  small: { fontSize: 12, lineHeight: 17 },
  primary: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondary: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontWeight: '700', fontSize: 14 },
  section: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 3, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pendingCard: { gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700' },
});
