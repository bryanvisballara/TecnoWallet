import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon, Card, Pill, PrimaryButton, useAppTheme } from '@/components/ui';
import { copyText } from '@/lib/copy-text';
import type { Recaudo } from '@/store/recaudos';

const RAIL_LABELS: Record<string, string> = {
  ach_push: 'Transferencia ACH',
  wire: 'Transferencia wire',
  fednow: 'FedNow',
  spei: 'SPEI',
  pix: 'PIX',
  bre_b: 'Bre-B',
  sepa: 'SEPA',
  faster_payments: 'Faster Payments',
};

function railLabel(rail: string) {
  return RAIL_LABELS[rail] ?? rail.replaceAll('_', ' ');
}

function currencyTitle(code: string) {
  const upper = code.trim().toUpperCase();
  if (upper === 'USD' || upper === 'USDC') return 'USD → USDc';
  if (upper === 'COP') return 'COP → USDc';
  if (upper === 'MXN') return 'MXN → USDc';
  if (upper === 'BRL') return 'Reales → USDc';
  if (upper === 'EUR') return 'EUR → USDc';
  return `${upper} → USDc`;
}

function statusCopy(status?: string, error?: string) {
  if (status === 'ready') return { label: 'Lista', tone: 'green' as const };
  if (status === 'pending_kyc') return { label: 'Falta verificación', tone: 'neutral' as const };
  if (error === 'not_configured' || status === 'failed') {
    return { label: 'Pendiente de abrir', tone: 'neutral' as const };
  }
  return { label: 'Preparando cuenta', tone: 'neutral' as const };
}

function instructionRows(
  account: NonNullable<Recaudo['tecnoAccount']>['virtualAccounts'] extends (infer T)[] | undefined
    ? T
    : never,
) {
  const info = account.instructions;
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value?: string) => {
    if (value?.trim()) rows.push({ label, value: value.trim() });
  };
  push('Banco', info?.bankName);
  push('Titular', info?.beneficiaryName ?? info?.accountHolderName);
  push('Número de cuenta', info?.accountNumber);
  push('Routing', info?.routingNumber);
  push('CLABE', info?.clabe);
  push('IBAN', info?.iban);
  push('BIC', info?.bic);
  push('PIX', info?.pixCode);
  push('Llave Bre-B', info?.breBKey);
  push('Referencia', info?.depositMessage);
  return rows;
}

async function copyValue(label: string, value: string) {
  const result = await copyText(value);
  Alert.alert(
    result === 'copied' ? 'Copiado' : 'Listo para compartir',
    `${label}: ${value}`,
  );
}

export function TecnoAccountPanel({
  recaudo,
  isOrganizer,
  onSync,
  onSavePayout,
}: {
  recaudo: Recaudo;
  isOrganizer: boolean;
  onSync: () => Promise<void>;
  onSavePayout: (details: string) => Promise<void>;
}) {
  const theme = useAppTheme();
  const account = recaudo.tecnoAccount;
  const status = statusCopy(account?.status, account?.error);
  const virtualAccounts = account?.virtualAccounts ?? [];
  const hasDepositDetails = virtualAccounts.some(
    (item) => instructionRows(item).length > 0,
  );
  const rails = [
    ...new Set(virtualAccounts.flatMap((item) => item.paymentRails ?? [])),
  ];
  const [payout, setPayout] = useState(recaudo.payoutAccountDetails ?? '');
  const [savingPayout, setSavingPayout] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      await onSync();
    } catch (error) {
      Alert.alert(
        'No se pudo abrir la cuenta',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSyncing(false);
    }
  };

  const savePayout = async () => {
    if (payout.trim().length < 8) {
      Alert.alert(
        'Cuenta de retiro',
        'Escribe los datos de tu cuenta: banco, titular y número.',
      );
      return;
    }
    setSavingPayout(true);
    try {
      await onSavePayout(payout.trim());
      Alert.alert('Guardado', 'Ahí enviaremos el retiro cuando saques dinero del recaudo.');
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSavingPayout(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <AppIcon name="building.columns.fill" color={theme.primary} size={19} />
        </View>
        <View style={styles.copy}>
          <View style={styles.nameLine}>
            <Text style={[styles.title, { color: theme.text }]}>Cuenta TecnoWallet</Text>
            <Pill tone={status.tone}>{status.label}</Pill>
          </View>
          <Text style={[styles.meta, { color: theme.muted }]}>
            Recibe aportes y los ahorra en USDc. No es una tarjeta: no tiene CVV ni fecha de
            vencimiento.
          </Text>
        </View>
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.primary }]}>Cómo aportar</Text>
        <Text style={[styles.meta, { color: theme.text }]}>
          Transfiere a los datos de abajo en USD, COP, MXN o reales. El recaudo acredita USDc.
          También podrás usar tarjetas internacionales cuando la verificación esté lista; por
          ahora el medio activo es la transferencia.
        </Text>
        {rails.length ? (
          <View style={styles.rails}>
            {rails.map((rail) => (
              <View
                key={rail}
                style={[styles.railChip, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.railText, { color: theme.primary }]}>
                  {railLabel(rail)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>
            Los medios de pago aparecen cuando la cuenta termine de abrirse.
          </Text>
        )}
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.primary }]}>Verificación de identidad</Text>
        <Text style={[styles.meta, { color: theme.text }]}>
          El organizador completa una verificación (documento y selfie) en una página segura.
          Sin eso no se pueden abrir los números de depósito ni retirar.
        </Text>
        {account?.kycUrl ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(account.kycUrl!)}
            style={[
              styles.btn,
              { borderColor: theme.primary, backgroundColor: theme.primarySoft },
            ]}>
            <Text style={[styles.btnText, { color: theme.primary }]}>
              Completar verificación
            </Text>
          </Pressable>
        ) : null}
        {account?.tosUrl ? (
          <Pressable onPress={() => void Linking.openURL(account.tosUrl!)}>
            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>
              Ver términos de la cuenta
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={[styles.blockTitle, { color: theme.primary }]}>Datos para depositar</Text>
        {hasDepositDetails ? (
          virtualAccounts.map((item) => {
            const rows = instructionRows(item);
            if (!rows.length) return null;
            return (
              <View
                key={item.id}
                style={[
                  styles.va,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}>
                <Text style={[styles.vaTitle, { color: theme.text }]}>
                  {currencyTitle(item.currency)}
                </Text>
                {item.paymentRails.map((rail) => (
                  <Text key={rail} style={[styles.meta, { color: theme.muted }]}>
                    {railLabel(rail)}
                  </Text>
                ))}
                {rows.map((row) => (
                  <Pressable
                    key={row.label}
                    onPress={() => void copyValue(row.label, row.value)}
                    style={styles.fieldRow}>
                    <View style={styles.copy}>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>{row.label}</Text>
                      <Text selectable style={[styles.fieldValue, { color: theme.text }]}>
                        {row.value}
                      </Text>
                    </View>
                    <AppIcon name="doc.fill" color={theme.primary} size={16} />
                  </Pressable>
                ))}
              </View>
            );
          })
        ) : (
          <Text style={[styles.meta, { color: theme.muted }]}>
            Aún no hay número de cuenta. Completa la verificación y pulsa Actualizar cuenta.
          </Text>
        )}
      </View>

      {isOrganizer ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: theme.primary }]}>Dónde retirar</Text>
          <Text style={[styles.meta, { color: theme.text }]}>
            Cuando el recaudo tenga saldo, el organizador lo saca a esta cuenta bancaria (banco,
            titular y número). No es una tarjeta.
          </Text>
          <TextInput
            value={payout}
            onChangeText={setPayout}
            multiline
            textAlignVertical="top"
            placeholder="Ej. Ana Gómez, ahorros Bancolombia 01234567890"
            placeholderTextColor={theme.muted}
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.surfaceSecondary,
                borderColor: theme.border,
              },
            ]}
          />
          <PrimaryButton onPress={() => void savePayout()}>
            {savingPayout ? 'Guardando…' : 'Guardar cuenta de retiro'}
          </PrimaryButton>
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: theme.primary }]}>Cómo se saca el dinero</Text>
          <Text style={[styles.meta, { color: theme.text }]}>
            Solo el organizador retira, cuando se cumple la meta, hacia su cuenta bancaria. Los
            integrantes aportan; no retiran.
          </Text>
        </View>
      )}

      {isOrganizer ? (
        <Pressable
          accessibilityRole="button"
          disabled={syncing}
          onPress={() => void sync()}
          style={[
            styles.btn,
            { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
          ]}>
          <Text style={[styles.btnText, { color: theme.text }]}>
            {syncing ? 'Actualizando…' : 'Actualizar cuenta'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  block: { gap: 8 },
  blockTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  rails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  railChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  railText: { fontSize: 11, fontWeight: '700' },
  btn: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  btnText: { fontSize: 14, fontWeight: '700' },
  va: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  vaTitle: { fontSize: 14, fontWeight: '800' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600' },
  fieldValue: { fontSize: 14, fontWeight: '700' },
  input: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
