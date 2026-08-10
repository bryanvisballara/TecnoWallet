import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AppIcon,
  ScalePressable,
  useAppTheme,
} from '@/components/ui';
import {
  purchaseBusiness,
  purchasePlus,
  restorePlusPurchases,
} from '@/services/purchases';
import {
  type PaywallPlan,
  type PlusReason,
  usePlusStore,
} from '@/store/plus';

const contextCopy: Record<PlusReason, { title: string; body: string }> = {
  UPGRADE: {
    title: 'Desbloquea tu plan',
    body: 'Organiza más, comparte con tu gente y recibe respuestas inteligentes sobre tu dinero.',
  },
  BOOK_LIMIT: {
    title: 'Haz espacio para todos tus proyectos',
    body: 'Tu plan gratis incluye un libro. Con un plan de pago puedes separar hogar, negocio, viajes y más.',
  },
  ENVELOPE_LIMIT: {
    title: 'Tu presupuesto puede crecer contigo',
    body: 'Ya usaste los 5 sobres gratuitos de esta sección. Con Plus o Business puedes crear todos los que necesites.',
  },
  SHARING_REQUIRED: {
    title: 'Las finanzas funcionan mejor en equipo',
    body: 'Invita colaboradores a tus libros y calendarios con acceso controlado.',
  },
  AI_REQUIRED: {
    title: 'Convierte tus movimientos en respuestas',
    body: 'Pregunta cuánto gastaste, dónde se fue tu dinero y cómo avanzan tus metas.',
  },
  SEAT_LIMIT: {
    title: 'Tu equipo necesita más cupos',
    body: 'TecnoWallet+ incluye 5 colaboradores. Business abre hasta 10 cupos únicos.',
  },
};

const plusBenefits = [
  ['sparkles', 'Asistente IA financiero'],
  ['wallet.pass.fill', 'Libros y sobres sin límites Free'],
  ['person.2.fill', 'Hasta 5 colaboradores'],
  ['calendar', 'Libros y calendarios compartidos'],
] as const;

const businessBenefits = [
  ['briefcase.fill', 'Todo lo de TecnoWallet+'],
  ['person.2.fill', 'Hasta 10 colaboradores'],
  ['sparkles', 'Asistente IA financiero'],
  ['calendar', 'Libros y calendarios compartidos'],
] as const;

export function PlusPaywallModal() {
  const theme = useAppTheme();
  const visible = usePlusStore((state) => state.paywallOpen);
  const reason = usePlusStore((state) => state.paywallReason);
  const plan = usePlusStore((state) => state.paywallPlan);
  const priceLabel = usePlusStore((state) => state.priceLabel);
  const businessPriceLabel = usePlusStore((state) => state.businessPriceLabel);
  const close = usePlusStore((state) => state.closePaywall);
  const setBilling = usePlusStore((state) => state.setBilling);
  const [working, setWorking] = useState<'buy' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = contextCopy[reason];
  const isBusiness = plan === 'business' || reason === 'SEAT_LIMIT';
  const benefits = isBusiness ? businessBenefits : plusBenefits;
  const activePrice = isBusiness ? businessPriceLabel : priceLabel;
  const brandLabel = isBusiness ? 'TECNOWALLET BUSINESS' : 'TECNOWALLET+';

  const runPurchase = async (target: PaywallPlan = plan) => {
    setError(null);
    setWorking('buy');
    try {
      const billing =
        target === 'business'
          ? await purchaseBusiness()
          : await purchasePlus();
      setBilling(billing);
      close();
    } catch (purchaseError) {
      const message =
        purchaseError instanceof Error
          ? purchaseError.message
          : 'No pudimos completar la compra.';
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setWorking(null);
    }
  };

  const runRestore = async () => {
    setError(null);
    setWorking('restore');
    try {
      const billing = await restorePlusPurchases();
      setBilling(billing);
      if (billing.isPlus) close();
      else setError('No encontramos una suscripción activa para restaurar.');
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : 'No pudimos restaurar tus compras.',
      );
    } finally {
      setWorking(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={working ? undefined : close}>
      <Pressable style={styles.overlay} onPress={working ? undefined : close}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
          onPress={(event) => event.stopPropagation()}>
          <View style={styles.topRow}>
            <View style={[styles.logo, { backgroundColor: theme.primarySoft }]}>
              <AppIcon
                name={isBusiness ? 'briefcase.fill' : 'sparkles'}
                color={theme.primary}
                size={28}
              />
            </View>
            <ScalePressable
              accessibilityLabel="Cerrar"
              disabled={Boolean(working)}
              onPress={close}
              style={[styles.close, { backgroundColor: theme.surfaceSecondary }]}>
              <AppIcon name="xmark" color={theme.muted} size={18} />
            </ScalePressable>
          </View>

          <Text style={[styles.eyebrow, { color: theme.primary }]}>
            {brandLabel}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            {isBusiness && reason === 'SEAT_LIMIT'
              ? 'Pasa a TecnoWallet Business'
              : isBusiness
                ? 'Desbloquea TecnoWallet Business'
                : copy.title.replace('tu plan', 'TecnoWallet+')}
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>{copy.body}</Text>

          <View style={styles.benefits}>
            {benefits.map(([icon, label]) => (
              <View key={label} style={styles.benefit}>
                <View
                  style={[
                    styles.check,
                    { backgroundColor: theme.successSoft },
                  ]}>
                  <AppIcon name={icon} color={theme.success} size={16} />
                </View>
                <Text style={[styles.benefitText, { color: theme.text }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <ScalePressable
            accessibilityRole="button"
            disabled={Boolean(working)}
            onPress={() => void runPurchase(isBusiness ? 'business' : 'plus')}
            style={[
              styles.primary,
              {
                backgroundColor: theme.primary,
                opacity: working ? 0.7 : 1,
              },
            ]}>
            {working === 'buy' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryText}>
                  {Platform.OS === 'ios'
                    ? isBusiness
                      ? 'Suscribirme a Business'
                      : 'Suscribirme con Apple'
                    : isBusiness
                      ? 'Ver TecnoWallet Business'
                      : 'Ver TecnoWallet+'}
                </Text>
                <Text style={styles.price}>
                  {activePrice
                    ? `${activePrice} al mes`
                    : 'Precio mostrado antes de confirmar'}
                </Text>
              </>
            )}
          </ScalePressable>

          <ScalePressable
            disabled={Boolean(working)}
            onPress={() => void runRestore()}
            style={styles.restore}>
            {working === 'restore' ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <Text style={[styles.restoreText, { color: theme.primary }]}>
                Restaurar compras
              </Text>
            )}
          </ScalePressable>

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          <Text style={[styles.legal, { color: theme.muted }]}>
            La suscripción se renueva automáticamente hasta que la canceles.
            El cobro se realiza con tu cuenta de Apple.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => void Linking.openURL('https://tecnowallet.app/terms')}>
              <Text style={[styles.legalLink, { color: theme.primary }]}>Términos</Text>
            </Pressable>
            <Text style={{ color: theme.muted }}>·</Text>
            <Pressable onPress={() => void Linking.openURL('https://tecnowallet.app/privacy')}>
              <Text style={[styles.legalLink, { color: theme.primary }]}>Privacidad</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#07101F99',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  benefits: { gap: 10, marginTop: 4 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: 14, fontWeight: '600' },
  primary: {
    marginTop: 8,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 2,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  price: { color: '#FFFFFFCC', fontSize: 13, fontWeight: '600' },
  restore: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { fontSize: 14, fontWeight: '700' },
  error: { fontSize: 13, textAlign: 'center' },
  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: { fontSize: 12, fontWeight: '700' },
});
