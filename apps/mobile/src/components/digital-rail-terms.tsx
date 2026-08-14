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

export function DigitalRailTerms({
  businessIncluded = false,
}: {
  businessIncluded?: boolean;
}) {
  const theme = useAppTheme();
  const monthly = usd(DIGITAL_MONTHLY_FEE_MINOR);
  const kyc = usd(DIGITAL_KYC_FEE_MINOR);
  const min = usd(DIGITAL_MIN_TARGET_MINOR, 0);
  const absorb = usd(DIGITAL_KYC_ABSORB_TARGET_MINOR, 0);

  const sections = [
    {
      title: 'Ventajas',
      items: [
        'El dinero queda en una cuenta del recaudo, no en el Nequi o banco de una persona.',
        'El organizador controla el retiro cuando se cumple la meta.',
        businessIncluded
          ? `Plan Business: este recaudo no cobra los US$ ${monthly} del primer mes.`
          : `Plan Business: 1 recaudo digital al mes sin la cuota de US$ ${monthly}.`,
      ],
    },
    {
      title: 'Condiciones',
      items: [
        `Solo USD. Meta mínima US$ ${min}.`,
        'La cuenta se abre con el primer aporte real, no al crear el recaudo.',
        'Cada integrante completa KYC. Sin cripto en el pozo. COP u otra moneda: usa cuenta personal (gratis).',
      ],
    },
    {
      title: 'Costos',
      items: [
        `US$ ${monthly}/mes mientras el recaudo esté activo${
          businessIncluded ? ' (mes 1 incluido)' : ''
        }.`,
        '2% al retirar (no pasa por la App Store).',
        `KYC US$ ${kyc} por persona. TecnoWallet lo cubre si la meta es ≥ US$ ${absorb}.`,
      ],
    },
  ];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
      ]}>
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
  block: { gap: 4 },
  heading: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  item: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
});
