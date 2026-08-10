import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, PrimaryButton, useAppTheme } from '@/components/ui';
import { useAffiliateStore } from '@/store/affiliate';

export function AffiliateWelcomeModal() {
  const theme = useAppTheme();
  const welcome = useAffiliateStore((state) => state.welcome);
  const dismiss = useAffiliateStore((state) => state.dismissWelcome);

  return (
    <Modal
      visible={Boolean(welcome)}
      transparent
      animationType="fade"
      onRequestClose={dismiss}>
      <Pressable style={styles.overlay} onPress={dismiss}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={(event) => event.stopPropagation()}>
          <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
            <AppIcon name="gift.fill" color={theme.primary} size={32} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            ¡Bienvenido a TecnoWallet!
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            Llegaste por recomendación de {welcome?.name}. Tu código{' '}
            <Text style={{ color: theme.primary, fontWeight: '800' }}>
              {welcome?.code}
            </Text>{' '}
            quedó registrado.
          </Text>
          <PrimaryButton onPress={dismiss}>Continuar</PrimaryButton>
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
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
