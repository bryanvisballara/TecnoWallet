import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/components/ui';
import {
  DIGITAL_KYC_ABSORB_TARGET_MINOR,
  DIGITAL_KYC_FEE_MINOR,
  DIGITAL_MIN_TARGET_MINOR,
  DIGITAL_MONTHLY_FEE_MINOR,
} from '@/lib/recaudo-digital-pricing';

function usd(minor: number, digits = 2) {
  return (minor / 100).toFixed(digits).replace('.', ',');
}

export function DigitalRailTerms({ embedded = false }: { embedded?: boolean }) {
  const theme = useAppTheme();
  const monthly = usd(DIGITAL_MONTHLY_FEE_MINOR);
  const kyc = usd(DIGITAL_KYC_FEE_MINOR);
  const min = usd(DIGITAL_MIN_TARGET_MINOR, 0);
  const absorb = usd(DIGITAL_KYC_ABSORB_TARGET_MINOR, 0);

  const sections = [
    {
      title: 'Condiciones',
      items: [
        `El recaudo se ahorra en USDc. Meta y retiro mínimo ${min} USDc.`,
        'Puedes realizar tus aportes en USD, COP, Rs, MXN, EUR, entre otras, además de tarjetas de crédito y débito internacionales.',
        'Puedes programar pagos recurrentes y automáticos con tus tarjetas.',
      ],
    },
    {
      title: 'Costos',
      items: [
        `US$ ${monthly}/mes mientras el recaudo esté activo.`,
        '2% al retirar.',
        `Verificación US$ ${kyc} por persona. TecnoWallet lo cubre si la meta es ≥ US$ ${absorb}.`,
        'Todos los costos se debitarán del recaudo.',
      ],
    },
  ];

  return (
    <View
      style={
        embedded
          ? styles.embedded
          : [
              styles.card,
              { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
            ]
      }>
      {sections.map((section) => (
        <View key={section.title} style={styles.block}>
          <Text style={[styles.heading, { color: theme.primary }]}>
            {section.title}
          </Text>
          {section.items.map((item) => (
            <Text key={item} style={[styles.item, { color: theme.text }]}>
              {`•  ${item}`}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  embedded: { gap: 12 },
  block: { gap: 4 },
  heading: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  item: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
});
