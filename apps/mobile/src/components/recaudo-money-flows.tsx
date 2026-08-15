import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DigitalRailTerms } from '@/components/digital-rail-terms';
import { AppIcon, PrimaryButton, useAppTheme } from '@/components/ui';
import { copyText } from '@/lib/copy-text';
import {
  kycCanRestart,
  kycStatusColor,
  kycStatusLabel,
  openHostedVerificationUrl,
  type RecaudoKyc,
} from '@/lib/recaudo-kyc';
import type { Recaudo } from '@/store/recaudos';

type Va = NonNullable<NonNullable<Recaudo['tecnoAccount']>['virtualAccounts']>[number];

const RAIL_LABELS: Record<string, string> = {
  ach_push: 'Transferencia ACH',
  wire: 'Wire',
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

function vaFor(recaudo: Recaudo, code: string) {
  return recaudo.tecnoAccount?.virtualAccounts?.find(
    (item) => item.currency.toLowerCase() === code.toLowerCase(),
  );
}

function instructionRows(account?: Va, rail?: string) {
  const info = account?.instructions;
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
  if (!rail) return rows;
  const byRail: Record<string, string[]> = {
    bre_b: ['Llave Bre-B', 'Titular', 'Banco', 'Referencia'],
    ach_push: ['Banco', 'Titular', 'Número de cuenta', 'Routing', 'Referencia'],
    wire: ['Banco', 'Titular', 'Número de cuenta', 'Routing', 'Referencia'],
    sepa: ['Titular', 'IBAN', 'BIC', 'Banco', 'Referencia'],
    spei: ['Titular', 'CLABE', 'Banco', 'Referencia'],
    pix: ['PIX', 'Titular', 'Referencia'],
  };
  const keep = byRail[rail];
  if (!keep) return rows;
  const filtered = rows.filter((row) => keep.includes(row.label));
  return filtered.length ? filtered : rows;
}

async function copyValue(label: string, value: string) {
  const result = await copyText(value);
  Alert.alert(result === 'copied' ? 'Copiado' : 'Listo para compartir', `${label}: ${value}`);
}

function SheetFrame({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.sheet, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}>
          <AppIcon name="arrow.left" color={theme.text} size={18} />
        </Pressable>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sheetSub, { color: theme.muted }]}>{subtitle}</Text>
        ) : null}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.sheetBody}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer}
      </SafeAreaView>
    </Modal>
  );
}

function Row({
  title,
  subtitle,
  onPress,
  icon,
  flag,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  icon?: string;
  flag?: string;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.surfaceSecondary }]}>
        {flag ? (
          <Text style={styles.flag}>{flag}</Text>
        ) : (
          <AppIcon name={icon ?? 'globe'} color={theme.primary} size={20} />
        )}
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: theme.muted }]}>{subtitle}</Text>
      </View>
      <AppIcon name="chevron" color={theme.muted} size={16} />
    </Pressable>
  );
}

type ReceiveRail = 'cop' | 'usd' | 'eur' | 'crypto' | 'mxn' | 'brl';

const RAILS_BY_CURRENCY: Record<
  ReceiveRail,
  { id: string; title: string; subtitle: string }[]
> = {
  cop: [{ id: 'bre_b', title: 'Bre-B', subtitle: 'Paga desde tu banco, Nequi o Daviplata' }],
  usd: [
    { id: 'ach_push', title: 'ACH', subtitle: 'Cuenta y routing en Estados Unidos' },
    { id: 'wire', title: 'Wire', subtitle: 'Transferencia internacional' },
  ],
  eur: [{ id: 'sepa', title: 'SEPA', subtitle: 'IBAN europeo' }],
  mxn: [{ id: 'spei', title: 'SPEI', subtitle: 'CLABE en México' }],
  brl: [{ id: 'pix', title: 'PIX', subtitle: 'Copia el código y paga en tu banco' }],
  crypto: [{ id: 'crypto', title: 'USDc', subtitle: 'Envía a la billetera de este recaudo' }],
};

export function RecaudoReceiveSheet({
  visible,
  recaudo,
  onClose,
  onRegister,
  registering,
  onEnsureRail,
  ensuring,
  kyc,
  onVerify,
  verifying,
  isOrganizer,
  activationPaid,
  activationLabel,
  onActivate,
  activating,
}: {
  visible: boolean;
  recaudo: Recaudo;
  onClose: () => void;
  onRegister: (amount: string) => Promise<void>;
  registering: boolean;
  onEnsureRail?: (currency: ReceiveRail) => Promise<void>;
  ensuring?: boolean;
  kyc?: RecaudoKyc;
  onVerify?: () => Promise<void>;
  verifying?: boolean;
  isOrganizer?: boolean;
  activationPaid?: boolean;
  activationLabel?: string;
  onActivate?: () => Promise<void>;
  activating?: boolean;
}) {
  const theme = useAppTheme();
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<ReceiveRail | null>(null);
  const [selectedRail, setSelectedRail] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const openedUrl = useRef<string | null>(null);
  const needsActivation = Boolean(isOrganizer) && activationPaid === false;
  const needsKyc = Boolean(kyc) && !kyc?.verified;

  const detail = useMemo(() => {
    if (!selected || selected === 'crypto') return undefined;
    return vaFor(recaudo, selected);
  }, [recaudo, selected]);

  const rows = selected === 'crypto'
    ? recaudo.tecnoAccount?.walletAddress
      ? [
          { label: 'Red', value: recaudo.tecnoAccount.chain || 'Base' },
          { label: 'Dirección USDc', value: recaudo.tecnoAccount.walletAddress },
        ]
      : []
    : instructionRows(detail, selectedRail ?? undefined);

  const startUrl = detail?.instructions?.startUrl;

  const titles: Record<string, { title: string; sub: string }> = {
    cop: { title: 'Pesos', sub: 'Elige cómo aportar. Se convierte a USDc.' },
    usd: { title: 'Dólares', sub: 'Elige ACH o wire. Se convierte a USDc.' },
    eur: { title: 'Euros', sub: 'SEPA. Se convierte a USDc.' },
    mxn: { title: 'Pesos mexicanos', sub: 'SPEI. Se convierte a USDc.' },
    brl: { title: 'Reales', sub: 'PIX. Se convierte a USDc.' },
    crypto: { title: 'Crypto', sub: 'Envía USDc a la billetera del recaudo.' },
  };

  const closeAll = () => {
    setSelected(null);
    setSelectedRail(null);
    setMore(false);
    setAmount('');
    openedUrl.current = null;
    onClose();
  };

  const pickRail = (railId: string) => {
    setSelectedRail(railId);
    if (selected) void onEnsureRail?.(selected);
  };

  useEffect(() => {
    if (!visible || !selectedRail || ensuring || needsKyc || needsActivation) return;
    if (!startUrl || openedUrl.current === startUrl) return;
    openedUrl.current = startUrl;
    void openHostedVerificationUrl(startUrl).catch(() => undefined);
  }, [visible, selectedRail, ensuring, needsKyc, needsActivation, startUrl]);

  return (
    <>
      <SheetFrame
        visible={visible && !selected}
        title={needsActivation ? 'Wallet digital' : 'Recibir'}
        subtitle={
          needsActivation
            ? `Por ${activationLabel ?? 'US$ 2.99'} compras una wallet digital. Al completar la verificación podrás recibir aportes.`
            : '¿En qué divisa quieres aportar?'
        }
        onClose={closeAll}>
        {needsActivation ? (
          onActivate ? (
            <PrimaryButton onPress={activating ? undefined : () => void onActivate()}>
              {activating ? 'Abriendo Mercado Pago…' : 'Comprar wallet'}
            </PrimaryButton>
          ) : null
        ) : (
          <>
        <Row
          flag="🇨🇴"
          title="Pesos"
          subtitle="Bre-B"
          onPress={() => setSelected('cop')}
        />
        <Row
          flag="🇺🇸"
          title="Dólares"
          subtitle="ACH o Wire"
          onPress={() => setSelected('usd')}
        />
        <Row
          flag="🇪🇺"
          title="Euros"
          subtitle="SEPA"
          onPress={() => setSelected('eur')}
        />
        <Row
          flag="◎"
          title="Crypto"
          subtitle="USDc o USDT"
          onPress={() => setSelected('crypto')}
        />
        <Pressable
          onPress={() => setMore((value) => !value)}
          style={[styles.moreBtn, { backgroundColor: theme.surfaceSecondary }]}>
          <Text style={[styles.moreText, { color: theme.text }]}>
            {more ? 'Ocultar opciones' : 'Ver todas las opciones'}
          </Text>
        </Pressable>
        {more ? (
          <>
            <Row
              flag="🇲🇽"
              title="Pesos mexicanos"
              subtitle="SPEI"
              onPress={() => setSelected('mxn')}
            />
            <Row
              flag="🇧🇷"
              title="Reales"
              subtitle="PIX"
              onPress={() => setSelected('brl')}
            />
          </>
        ) : null}
        <Text style={[styles.disclaimer, { color: theme.muted }]}>
          Las transferencias en USD, EUR, MXN, COP y reales se convierten automáticamente a USDc
          cuando se reciben.
        </Text>
          </>
        )}
      </SheetFrame>

      <SheetFrame
        visible={visible && Boolean(selected)}
        title={selected ? titles[selected].title : ''}
        subtitle={selected ? titles[selected].sub : undefined}
        onClose={() => {
          setSelectedRail(null);
          openedUrl.current = null;
          setSelected(null);
        }}>
        {needsActivation ? (
          <>
            <Text style={[styles.sheetSub, { color: theme.muted, marginTop: 4 }]}>
              Por {activationLabel ?? 'US$ 2.99'} compras una wallet digital. Cuando completes
              la verificación, podrás recibir aportes en USD, EUR, COP, MXN y R$.
            </Text>
            {onActivate ? (
              <PrimaryButton onPress={activating ? undefined : () => void onActivate()}>
                {activating ? 'Abriendo Mercado Pago…' : 'Comprar wallet'}
              </PrimaryButton>
            ) : null}
          </>
        ) : needsKyc ? (
          <>
            <Text style={[styles.sheetSub, { color: theme.muted, marginTop: 4 }]}>
              {isOrganizer
                ? kycCanRestart(kyc)
                  ? 'Para recibir aportes verifica tu identidad. Esto se hace una sola vez.'
                  : 'Ya enviaste tu verificación. Cuando esté lista se abren los datos de depósito.'
                : 'El organizador debe verificar su identidad antes de recibir aportes.'}
            </Text>
            <Text style={[styles.rowTitle, { color: theme.text, marginTop: 12 }]}>
              Estado:{' '}
              <Text style={{ color: kycStatusColor(kyc?.kycStatus, theme) }}>
                {kycStatusLabel(kyc?.kycStatus)}
              </Text>
            </Text>
            {isOrganizer && kycCanRestart(kyc) && onVerify ? (
              <PrimaryButton onPress={verifying ? undefined : () => void onVerify()}>
                {verifying
                  ? 'Abriendo…'
                  : kyc?.kycStatus === 'rejected'
                    ? 'Volver a verificar'
                    : 'Verifica tu identidad'}
              </PrimaryButton>
            ) : isOrganizer && onVerify ? (
              <PrimaryButton onPress={verifying ? undefined : () => void onVerify()}>
                {verifying ? 'Actualizando…' : 'Actualizar estado'}
              </PrimaryButton>
            ) : null}
          </>
        ) : !selectedRail ? (
          (selected ? RAILS_BY_CURRENCY[selected] : []).map((rail) => (
            <Row
              key={rail.id}
              icon="building.columns.fill"
              title={rail.title}
              subtitle={rail.subtitle}
              onPress={() => pickRail(rail.id)}
            />
          ))
        ) : ensuring ? (
          <Text style={[styles.empty, { color: theme.muted }]}>
            Preparando este medio de aporte…
          </Text>
        ) : (
          <>
            {detail?.paymentRails?.length ? (
              <Text style={[styles.rails, { color: theme.primary }]}>
                {detail.paymentRails.map(railLabel).join(' · ')}
              </Text>
            ) : null}
            {startUrl ? (
              <PrimaryButton onPress={() => void openHostedVerificationUrl(startUrl)}>
                Continuar el aporte
              </PrimaryButton>
            ) : null}
            {rows.length ? (
              rows.map((row) => (
                <Pressable
                  key={row.label}
                  onPress={() => void copyValue(row.label, row.value)}
                  style={[styles.field, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.muted }]}>{row.label}</Text>
                  <View style={styles.fieldValueRow}>
                    <Text selectable style={[styles.fieldValue, { color: theme.text }]}>
                      {row.value}
                    </Text>
                    <AppIcon name="doc.fill" color={theme.primary} size={16} />
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.empty, { color: theme.muted }]}>
                Elige realizar un aporte de nuevo cuando la cuenta esté lista, o prueba otro medio.
              </Text>
            )}
            <Text style={[styles.fieldLabel, { color: theme.muted, marginTop: 18 }]}>
              Si ya transferiste, registra el aporte (USDc)
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={theme.muted}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
            />
            <PrimaryButton
              onPress={registering ? undefined : () => void onRegister(amount)}>
              {registering ? 'Registrando…' : 'Registrar aporte'}
            </PrimaryButton>
          </>
        )}
      </SheetFrame>
    </>
  );
}

export function RecaudoWithdrawSheet({
  visible,
  recaudo,
  availableLabel,
  onClose,
  onSaveDestination,
  onWithdraw,
  withdrawing,
}: {
  visible: boolean;
  recaudo: Recaudo;
  availableLabel: string;
  onClose: () => void;
  onSaveDestination: (details: string) => Promise<void>;
  onWithdraw: (amount: string) => Promise<void>;
  withdrawing: boolean;
}) {
  const theme = useAppTheme();
  const [step, setStep] = useState<'method' | 'form'>('method');
  const [method, setMethod] = useState<'breb' | 'bank'>('bank');
  const [kind, setKind] = useState<'individual' | 'empresa'>('individual');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [docType, setDocType] = useState('CC');
  const [docNumber, setDocNumber] = useState('');
  const [bank, setBank] = useState('');
  const [accountType, setAccountType] = useState('Ahorros');
  const [accountNumber, setAccountNumber] = useState('');
  const [brebKey, setBrebKey] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const closeAll = () => {
    setStep('method');
    onClose();
  };

  const save = async () => {
    const details =
      method === 'breb'
        ? `Bre-B · ${brebKey.trim()}`
        : kind === 'empresa'
          ? `${company.trim()} · NIT ${docNumber.trim()} · ${bank.trim()} ${accountType} ${accountNumber.trim()}`
          : `${firstName.trim()} ${lastName.trim()} · ${docType} ${docNumber.trim()} · ${bank.trim()} ${accountType} ${accountNumber.trim()}`;
    if (details.replace(/\s/g, '').length < 8) {
      Alert.alert('Datos incompletos', 'Completa los datos de la cuenta de retiro.');
      return;
    }
    setSaving(true);
    try {
      await onSaveDestination(details);
      Alert.alert('Guardado', 'Ahí enviaremos el retiro.');
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SheetFrame
        visible={visible && step === 'method'}
        title="¿Cómo quieres añadir al destinatario?"
        onClose={closeAll}>
        <Row
          icon="sparkles"
          title="Bre-B"
          subtitle="Llave para recibir en COP"
          onPress={() => {
            setMethod('breb');
            setStep('form');
          }}
        />
        <Row
          icon="building.columns.fill"
          title="Número de cuenta bancaria"
          subtitle="Banco, tipo y número"
          onPress={() => {
            setMethod('bank');
            setStep('form');
          }}
        />
        {recaudo.payoutAccountDetails ? (
          <Text style={[styles.disclaimer, { color: theme.muted }]}>
            Destino actual: {recaudo.payoutAccountDetails}
          </Text>
        ) : null}
      </SheetFrame>

      <SheetFrame
        visible={visible && step === 'form'}
        title={method === 'breb' ? 'Destinatario Bre-B' : 'Añadir destinatario de Colombia'}
        onClose={() => setStep('method')}>
        {method === 'bank' ? (
          <View style={[styles.segment, { backgroundColor: theme.surfaceSecondary }]}>
            {(['individual', 'empresa'] as const).map((item) => {
              const selected = kind === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setKind(item)}
                  style={[
                    styles.segmentItem,
                    selected && { backgroundColor: theme.surface },
                  ]}>
                  <Text style={[styles.segmentText, { color: theme.text }]}>
                    {item === 'individual' ? 'Individual' : 'Empresa'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={[styles.section, { color: theme.text }]}>
          {method === 'breb' ? 'Llave Bre-B' : 'Datos del destinatario'}
        </Text>
        {method === 'breb' ? (
          <UnderlineField label="Llave Bre-B" value={brebKey} onChange={setBrebKey} />
        ) : kind === 'empresa' ? (
          <>
            <UnderlineField label="Razón social" value={company} onChange={setCompany} />
            <UnderlineField label="NIT" value={docNumber} onChange={setDocNumber} keyboard="number-pad" />
          </>
        ) : (
          <>
            <UnderlineField label="Nombre del destinatario" value={firstName} onChange={setFirstName} />
            <UnderlineField label="Apellido del destinatario" value={lastName} onChange={setLastName} />
            <UnderlineField label="Tipo de documento" value={docType} onChange={setDocType} />
            <UnderlineField
              label="Número de documento"
              value={docNumber}
              onChange={setDocNumber}
              keyboard="number-pad"
            />
          </>
        )}

        {method === 'bank' ? (
          <>
            <Text style={[styles.section, { color: theme.text }]}>Datos del banco</Text>
            <UnderlineField label="Banco" value={bank} onChange={setBank} />
            <UnderlineField label="Tipo de cuenta" value={accountType} onChange={setAccountType} />
            <UnderlineField
              label="Nro. de cuenta"
              value={accountNumber}
              onChange={setAccountNumber}
              keyboard="number-pad"
            />
          </>
        ) : null}

        <PrimaryButton onPress={saving ? undefined : () => void save()}>
          {saving ? 'Guardando…' : 'Guardar destinatario'}
        </PrimaryButton>

        <Text style={[styles.section, { color: theme.text }]}>Retirar</Text>
        <Text style={[styles.rowSub, { color: theme.muted }]}>Disponible {availableLabel}</Text>
        <UnderlineField label="Monto en USDc" value={amount} onChange={setAmount} keyboard="decimal-pad" />
        <PrimaryButton onPress={withdrawing ? undefined : () => void onWithdraw(amount)}>
          {withdrawing ? 'Retirando…' : 'Retirar'}
        </PrimaryButton>
      </SheetFrame>
    </>
  );
}

function UnderlineField({
  label,
  value,
  onChange,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.underline, { borderBottomColor: theme.border }]}>
      <Text style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={theme.muted}
        keyboardType={keyboard}
        style={[styles.underlineInput, { color: theme.text }]}
      />
    </View>
  );
}

export function RecaudoTermsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.termsScrim} onPress={onClose}>
        <Pressable
          style={[styles.termsCard, { backgroundColor: theme.surface }]}
          onPress={() => undefined}>
          <Text style={[styles.sheetTitle, { color: theme.text, fontSize: 22 }]}>
            Condiciones y costos
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            <DigitalRailTerms embedded />
          </ScrollView>
          <PrimaryButton onPress={onClose}>Entendido</PrimaryButton>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, paddingHorizontal: 18 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  sheetSub: { fontSize: 15, lineHeight: 20, marginTop: 6, marginBottom: 8 },
  sheetBody: { paddingBottom: 40, gap: 4 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 22 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 13 },
  moreBtn: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  moreText: { fontSize: 15, fontWeight: '700' },
  disclaimer: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 22 },
  rails: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  field: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fieldValue: { flex: 1, fontSize: 16, fontWeight: '700' },
  empty: { fontSize: 14, lineHeight: 20, marginVertical: 16 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  section: { fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 4 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3, marginTop: 8 },
  segmentItem: { flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '700' },
  underline: { paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  underlineInput: { fontSize: 16, paddingVertical: 4 },
  termsScrim: {
    flex: 1,
    backgroundColor: 'rgba(11, 29, 58, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  termsCard: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    marginBottom: 12,
  },
});
