import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AppIcon,
  Card,
  Pill,
  PrimaryButton,
  ProgressBar,
  ScalePressable,
  Screen,
  SectionTitle,
  useAppTheme,
} from "@/components/ui";
import {
  amountToMinorUnits,
  contributionAmountPlaceholder,
  isZeroDecimalCurrency,
} from "@/lib/currencies";
import { useAuthStore } from "@/store/auth";
import {
  useRecaudosStore,
  type ContributionFrequency,
  type ContributionMode,
  type RecaudoCategory,
} from "@/store/recaudos";
import { useUnitFundingStore } from "@/store/unit-funding";

const categoryInfo: Record<
  RecaudoCategory,
  { label: string; icon: string; color: string }
> = {
  travel: { label: "Viaje", icon: "airplane", color: "#0878F9" },
  gift: { label: "Regalo", icon: "gift.fill", color: "#EE46BC" },
  event: { label: "Evento", icon: "ticket.fill", color: "#7F56D9" },
  purchase: { label: "Compra", icon: "cart.fill", color: "#F79009" },
  other: { label: "Otro", icon: "sparkles", color: "#0E9F6E" },
};

const frequencies: { value: ContributionFrequency; label: string }[] = [
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
];

const modes: { value: ContributionMode; label: string; icon: string }[] = [
  { value: "manual", label: "Manual", icon: "hand.raised.fill" },
  {
    value: "card_simulated",
    label: "Tarjeta simulada",
    icon: "creditcard.fill",
  },
];

const reminderTimes = ["08:00", "12:00", "18:00", "20:00"] as const;

function leaveRecaudo() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(tabs)/recaudos");
}

function formatMinor(value: number, currency: string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: isZeroDecimalCurrency(currency) ? 0 : 2,
  }).format(value / 100);
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function RecaudoDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recaudos = useRecaudosStore((state) => state.recaudos);
  const hydrated = useRecaudosStore((state) => state.hydrated);
  const hydrate = useRecaudosStore((state) => state.hydrate);
  const invite = useRecaudosStore((state) => state.invite);
  const addContribution = useRecaudosStore((state) => state.addContribution);
  const withdraw = useRecaudosStore((state) => state.withdraw);
  const updateMyPlan = useRecaudosStore((state) => state.updateMyPlan);
  const refreshRecaudos = useRecaudosStore((state) => state.refresh);
  const profile = useAuthStore((state) => state.profile);
  const demo = useAuthStore((state) => state.demo);
  const recaudo = recaudos.find((item) => item.id === id);

  const identity = useUnitFundingStore((state) => state.identity);
  const counterparties = useUnitFundingStore((state) => state.counterparties);
  const wallet = useUnitFundingStore((state) => state.wallet);
  const balancesByRecaudo = useUnitFundingStore(
    (state) => state.balancesByRecaudo,
  );
  const setupBusy = useUnitFundingStore((state) => state.setupBusy);
  const bootstrapForRecaudo = useUnitFundingStore(
    (state) => state.bootstrapForRecaudo,
  );
  const activatePayments = useUnitFundingStore(
    (state) => state.activatePayments,
  );
  const ensureWorkspaceWallet = useUnitFundingStore(
    (state) => state.ensureWorkspaceWallet,
  );
  const linkBankAccount = useUnitFundingStore((state) => state.linkBankAccount);
  const fundContribution = useUnitFundingStore(
    (state) => state.fundContribution,
  );
  const fundWithdrawal = useUnitFundingStore((state) => state.fundWithdrawal);
  const refreshBalances = useUnitFundingStore((state) => state.refreshBalances);
  const refreshIdentity = useUnitFundingStore((state) => state.refreshIdentity);

  const myParticipant = useMemo(() => {
    if (!recaudo) return undefined;
    return (
      recaudo.participants.find(
        (participant) =>
          participant.email.toLowerCase() === profile.email.toLowerCase(),
      ) ?? (recaudo.isOrganizer ? recaudo.participants[0] : undefined)
    );
  }, [profile.email, recaudo]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [contributing, setContributing] = useState(false);
  const [fundingContribution, setFundingContribution] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showManualContribute, setShowManualContribute] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [frequency, setFrequency] = useState<ContributionFrequency>("monthly");
  const [mode, setMode] = useState<ContributionMode>("manual");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [savingPlan, setSavingPlan] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("011401533");
  const [accountNumber, setAccountNumber] = useState("123456789");

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!recaudo || demo) return;
    void bootstrapForRecaudo(recaudo.id);
  }, [bootstrapForRecaudo, demo, recaudo?.id]);

  useEffect(() => {
    if (
      demo ||
      !recaudo?.isOrganizer ||
      identity.status !== "approved" ||
      !identity.unitCustomerId ||
      counterparties.every((item) => !item.active) ||
      (wallet?.unitWalletId && wallet.status === "open") ||
      setupBusy
    ) {
      return;
    }
    void ensureWorkspaceWallet().catch(() => undefined);
  }, [
    counterparties,
    demo,
    ensureWorkspaceWallet,
    identity.status,
    identity.unitCustomerId,
    recaudo?.isOrganizer,
    setupBusy,
    wallet?.status,
    wallet?.unitWalletId,
  ]);

  useEffect(() => {
    if (!recaudo || demo) return;
    const balances = balancesByRecaudo[recaudo.id];
    const inFlight =
      (balances?.pendingMinor ?? 0) + (balances?.processingMinor ?? 0);
    if (inFlight <= 0) return;
    const timer = setInterval(() => {
      void refreshBalances(recaudo.id).then(() => refreshRecaudos());
    }, 12_000);
    return () => clearInterval(timer);
  }, [balancesByRecaudo, demo, recaudo?.id, refreshBalances, refreshRecaudos]);

  useEffect(() => {
    if (!myParticipant || !recaudo) return;
    setMonthlyAmount(String(myParticipant.monthlyCommitmentMinor / 100));
    setFrequency(myParticipant.frequency);
    setMode(myParticipant.mode);
    setRemindersEnabled(myParticipant.remindersEnabled);
    setReminderTime(myParticipant.reminderTime || "09:00");
    setBankName((current) => current || profile.name || "Mi cuenta");
  }, [
    myParticipant?.id,
    myParticipant?.frequency,
    myParticipant?.mode,
    myParticipant?.remindersEnabled,
    myParticipant?.reminderTime,
    profile.name,
    recaudo?.currency,
  ]);

  if (!hydrated || !recaudo) {
    return (
      <Screen
        title={hydrated ? "Recaudo no encontrado" : "Cargando recaudo…"}
        right={
          <Pressable
            accessibilityLabel="Volver"
            onPress={leaveRecaudo}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}
          >
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
        }
      >
        {hydrated ? (
          <Card>
            <Text style={[styles.centerText, { color: theme.muted }]}>
              Este recaudo ya no está disponible.
            </Text>
          </Card>
        ) : null}
      </Screen>
    );
  }

  const category = categoryInfo[recaudo.category];
  const fundingReady = useUnitFundingStore
    .getState()
    .isFundingReady(recaudo.isOrganizer);
  const balances = balancesByRecaudo[recaudo.id];
  const availableMinor = balances?.availableMinor ?? 0;
  const pendingMinor = balances?.pendingMinor ?? 0;
  const processingMinor = balances?.processingMinor ?? 0;
  const inTransitMinor = pendingMinor + processingMinor;
  const withdrawableMinor = fundingReady
    ? availableMinor
    : recaudo.collectedMinor;
  const ratio =
    recaudo.targetMinor > 0 ? recaudo.collectedMinor / recaudo.targetMinor : 0;
  const percent = Math.min(100, Math.round(ratio * 100));
  const remaining = Math.max(0, recaudo.targetMinor - recaudo.collectedMinor);
  const contributions = [...recaudo.contributions].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const activeBank = counterparties.find((item) => item.active);
  const needsIdentity =
    !demo &&
    (identity.status === "none" ||
      identity.status === "denied" ||
      identity.status === "canceled");
  const identityPending =
    !demo &&
    (identity.status === "pending" ||
      identity.status === "awaitingDocuments");
  // Order: identity → recaudo digital account (organizer) → source bank link.
  const needsWallet =
    !demo &&
    recaudo.isOrganizer &&
    identity.status === "approved" &&
    !(wallet?.unitWalletId && wallet.status === "open");
  const walletReady = Boolean(wallet?.unitWalletId && wallet.status === "open");
  const needsBank =
    !demo &&
    identity.status === "approved" &&
    !activeBank &&
    (!recaudo.isOrganizer || walletReady);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert(
        "Falta el correo",
        "Escribe el correo de la persona que quieres invitar.",
      );
      return;
    }
    setInviting(true);
    try {
      const result = await invite(recaudo.id, inviteEmail);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInviteEmail("");
      Alert.alert(
        "Invitación enviada",
        result.previewLink
          ? `En modo demo puedes previsualizarla en:\n${result.previewLink}`
          : `Enviamos la invitación por correo a ${inviteEmail.trim().toLowerCase()}.`,
      );
    } catch (error) {
      Alert.alert(
        "No se pudo invitar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setInviting(false);
    }
  };

  const activateUnit = async () => {
    try {
      const next = await activatePayments();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (next.status === "approved") {
        Alert.alert(
          "Cuenta digital lista",
          "Ya puedes vincular tu banco para aportar al recaudo.",
        );
      } else {
        Alert.alert(
          "Solicitud enviada",
          "Estamos revisando tu solicitud. Actualiza en unos segundos.",
        );
      }
    } catch (error) {
      Alert.alert(
        "No se pudo abrir la cuenta",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    }
  };

  const openWallet = async () => {
    try {
      await ensureWorkspaceWallet();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Cuenta digital lista",
        "El recaudo ya puede recibir aportes con cuenta bancaria.",
      );
    } catch (error) {
      Alert.alert(
        "No se pudo abrir la cuenta digital",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    }
  };

  const linkBank = async () => {
    if (!bankName.trim() || !routingNumber.trim() || !accountNumber.trim()) {
      Alert.alert(
        "Datos incompletos",
        "Completa nombre, routing y número de cuenta.",
      );
      return;
    }
    try {
      await linkBankAccount({
        name: bankName,
        routingNumber,
        accountNumber,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Cuenta vinculada", "Ya puedes aportar desde esa cuenta.");
    } catch (error) {
      Alert.alert(
        "No se pudo vincular",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    }
  };

  const contributeFunded = async () => {
    const amountMinor = amountToMinorUnits(contributionAmount, recaudo.currency);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      Alert.alert("Aporte inválido", "Escribe un monto mayor a cero.");
      return;
    }
    setFundingContribution(true);
    try {
      const result = await fundContribution({
        recaudoId: recaudo.id,
        amountMinor,
        note: contributionNote.trim() || undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setContributionAmount("");
      setContributionNote("");
      await refreshRecaudos();
      const settled = result.intent.status === "settled";
      Alert.alert(
        settled ? "Aporte acreditado" : "Aporte en tránsito",
        settled
          ? "El dinero ya suma al pozo disponible."
          : "El débito ACH quedó pendiente. El pozo disponible se actualizará cuando Unit lo confirme.",
      );
    } catch (error) {
      Alert.alert(
        "No se pudo aportar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setFundingContribution(false);
    }
  };

  const contribute = async () => {
    const amountMinor = amountToMinorUnits(contributionAmount, recaudo.currency);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      Alert.alert("Aporte inválido", "Escribe un monto mayor a cero.");
      return;
    }
    setContributing(true);
    try {
      await addContribution(recaudo.id, amountMinor, contributionNote);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setContributionAmount("");
      setContributionNote("");
      Alert.alert(
        "Aporte registrado",
        "El aporte manual ya aparece en el pozo (no mueve dinero bancario).",
      );
    } catch (error) {
      Alert.alert(
        "No se pudo aportar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setContributing(false);
    }
  };

  const withdrawFunds = async () => {
    const amountMinor = amountToMinorUnits(withdrawAmount, recaudo.currency);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      Alert.alert("Retiro inválido", "Escribe un monto mayor a cero.");
      return;
    }
    if (amountMinor > withdrawableMinor) {
      Alert.alert(
        "Monto demasiado alto",
        `Solo hay ${formatMinor(withdrawableMinor, recaudo.currency)} disponible para retirar.`,
      );
      return;
    }
    setWithdrawing(true);
    try {
      if (fundingReady && !demo) {
        const result = await fundWithdrawal({
          recaudoId: recaudo.id,
          amountMinor,
          note: withdrawNote.trim() || undefined,
        });
        await refreshRecaudos();
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setWithdrawAmount("");
        setWithdrawNote("");
        setShowWithdraw(false);
        setSuccessMessage(
          result.intent.status === "settled"
            ? `Retiro acreditado por ${formatMinor(amountMinor, recaudo.currency)}.`
            : `Retiro ACH en tránsito por ${formatMinor(amountMinor, recaudo.currency)}.`,
        );
      } else {
        await withdraw(recaudo.id, amountMinor, withdrawNote);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setWithdrawAmount("");
        setWithdrawNote("");
        setShowWithdraw(false);
        setSuccessMessage(
          amountMinor >= withdrawableMinor
            ? "Retiraste el pozo completo. El recaudo quedó cerrado."
            : `Retiraste ${formatMinor(amountMinor, recaudo.currency)} del pozo.`,
        );
      }
    } catch (error) {
      Alert.alert(
        "No se pudo retirar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const savePlan = async () => {
    const monthlyCommitmentMinor = amountToMinorUnits(
      monthlyAmount,
      recaudo.currency,
    );
    if (
      !Number.isSafeInteger(monthlyCommitmentMinor) ||
      monthlyCommitmentMinor <= 0
    ) {
      Alert.alert(
        "Meta mensual inválida",
        "Define un aporte mensual mayor a cero.",
      );
      return;
    }
    if (remindersEnabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
      Alert.alert(
        "Hora inválida",
        "Selecciona o escribe una hora válida en formato HH:mm.",
      );
      return;
    }
    setSavingPlan(true);
    try {
      const result = await updateMyPlan(recaudo.id, {
        monthlyCommitmentMinor,
        frequency,
        mode,
        remindersEnabled,
        reminderTime,
        simulatedCard:
          mode === "card_simulated"
            ? { brand: "Visa", last4: "4242" }
            : undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const frequencyLabel =
        frequencies.find((item) => item.value === frequency)?.label ??
        "Mensual";
      const modeLabel =
        modes.find((item) => item.value === mode)?.label ?? "Manual";
      const reminderCopy = remindersEnabled
        ? result.reminderScheduled
          ? `Recibirás una notificación ${frequencyLabel.toLowerCase()} a las ${reminderTime}.`
          : "La configuración se guardó, pero debes habilitar las notificaciones del dispositivo para recibir recordatorios."
        : "Los recordatorios quedaron desactivados.";
      setSuccessMessage(
        `Tu aporte ${frequencyLabel.toLowerCase()} quedó configurado como ${modeLabel.toLowerCase()}. ${reminderCopy}`,
      );
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <Screen
      title={recaudo.title}
      subtitle={`${category.label}${
        recaudo.deadline ? ` · Meta ${formatDate(recaudo.deadline)}` : ""
      }`}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={leaveRecaudo}
          style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}
        >
          <AppIcon name="arrow.left" color={theme.text} />
        </Pressable>
      }
    >
      <Card style={[styles.hero, { backgroundColor: category.color }]}>
        <View style={styles.between}>
          <View style={styles.heroIcon}>
            <AppIcon name={category.icon} color="#FFFFFF" size={27} />
          </View>
          <Pill tone={recaudo.status === "completed" ? "green" : "neutral"}>
            {percent}% completado
          </Pill>
        </View>
        <Text style={styles.heroLabel}>
          {fundingReady ? "Pozo disponible" : "Pozo recaudado"}
        </Text>
        <Text style={styles.heroValue}>
          {formatMinor(
            fundingReady ? availableMinor : recaudo.collectedMinor,
            recaudo.currency,
          )}
        </Text>
        <Text style={styles.heroHint}>
          de {formatMinor(recaudo.targetMinor, recaudo.currency)} · faltan{" "}
          {formatMinor(remaining, recaudo.currency)}
          {fundingReady && inTransitMinor > 0
            ? ` · ${formatMinor(inTransitMinor, recaudo.currency)} en tránsito`
            : ""}
        </Text>
        <View style={styles.heroTrack}>
          <View
            style={[
              styles.heroFill,
              { width: `${Math.min(100, ratio * 100)}%` },
            ]}
          />
        </View>
      </Card>

      {!demo ? (
        <Card style={styles.balanceCard}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Dinero del recaudo
          </Text>
          <View style={styles.stats}>
            <View
              style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
            >
              <Text style={[styles.statLabel, { color: theme.muted }]}>
                Disponible
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatMinor(availableMinor, recaudo.currency)}
              </Text>
            </View>
            <View
              style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
            >
              <Text style={[styles.statLabel, { color: theme.muted }]}>
                En tránsito
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatMinor(inTransitMinor, recaudo.currency)}
              </Text>
            </View>
            <View
              style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
            >
              <Text style={[styles.statLabel, { color: theme.muted }]}>
                Registrado
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {formatMinor(recaudo.collectedMinor, recaudo.currency)}
              </Text>
            </View>
          </View>
          <Text style={[styles.rowMeta, { color: theme.muted }]}>
            Solo lo disponible (confirmado por Unit) se puede retirar a tu
            cuenta. Los registros manuales no mueven dinero bancario.
          </Text>
        </Card>
      ) : null}

      {!demo &&
      (needsIdentity || identityPending || needsBank || needsWallet) ? (
        <Card style={styles.formCard}>
          <View style={styles.formHeading}>
            <View
              style={[styles.smallIcon, { backgroundColor: theme.primarySoft }]}
            >
              <AppIcon name="building.columns.fill" color={theme.primary} size={19} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Cuenta de banco digital del recaudo
              </Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                Primero se crea la cuenta digital del recaudo y después vinculas
                el banco de origen para aportar con débito ACH.
              </Text>
            </View>
          </View>

          {needsIdentity ? (
            <PrimaryButton
              icon="person.crop.circle.badge.checkmark"
              onPress={setupBusy ? undefined : () => void activateUnit()}
            >
              {setupBusy
                ? "Abriendo cuenta…"
                : "1. Abrir cuenta de banco digital"}
            </PrimaryButton>
          ) : null}

          {identityPending ? (
            <>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                Estado: {identity.status}. Estamos revisando tu solicitud.
              </Text>
              <PrimaryButton
                icon="arrow.clockwise"
                onPress={setupBusy ? undefined : () => void refreshIdentity()}
              >
                Actualizar estado
              </PrimaryButton>
            </>
          ) : null}

          {needsWallet ? (
            <PrimaryButton
              icon="wallet.pass.fill"
              onPress={setupBusy ? undefined : () => void openWallet()}
            >
              {setupBusy
                ? "Abriendo…"
                : "2. Abrir la cuenta digital del recaudo"}
            </PrimaryButton>
          ) : null}

          {needsBank ? (
            <>
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                {recaudo.isOrganizer
                  ? "3. Vincular banco de origen (sandbox)"
                  : "2. Vincular banco de origen (sandbox)"}
              </Text>
              <TextInput
                value={bankName}
                onChangeText={setBankName}
                placeholder="Nombre en la cuenta"
                placeholderTextColor={theme.muted}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceSecondary,
                  },
                ]}
              />
              <TextInput
                value={routingNumber}
                onChangeText={setRoutingNumber}
                placeholder="Routing number"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceSecondary,
                  },
                ]}
              />
              <TextInput
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Account number"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceSecondary,
                  },
                ]}
              />
              <PrimaryButton
                icon="link"
                onPress={setupBusy ? undefined : () => void linkBank()}
              >
                {setupBusy ? "Vinculando…" : "Vincular banco de origen"}
              </PrimaryButton>
            </>
          ) : null}

          {activeBank ? (
            <Text style={[styles.rowMeta, { color: theme.muted }]}>
              Banco de origen: {activeBank.name}
              {activeBank.accountNumberMask
                ? ` · •••• ${activeBank.accountNumberMask}`
                : ""}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {recaudo.isOrganizer &&
      recaudo.status !== "closed" &&
      withdrawableMinor > 0 ? (
        <Card style={styles.actionCard}>
          <View style={styles.actionRow}>
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel="Retirar dinero del pozo"
              onPress={() => setShowWithdraw((value) => !value)}
              style={[
                styles.actionButton,
                {
                  backgroundColor: showWithdraw
                    ? theme.danger
                    : theme.surfaceSecondary,
                },
              ]}
            >
              <AppIcon
                name="arrow.up.circle.fill"
                color={showWithdraw ? "#FFFFFF" : theme.danger}
                size={20}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: showWithdraw ? "#FFFFFF" : theme.text },
                ]}
              >
                Retirar dinero
              </Text>
            </ScalePressable>
          </View>
          {showWithdraw ? (
            <View style={styles.withdrawForm}>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                Disponible para retirar:{" "}
                {formatMinor(withdrawableMinor, recaudo.currency)}
                {fundingReady ? " (ACH a tu cuenta)" : " (registro manual)"}
              </Text>
              <View
                style={[
                  styles.amountInput,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceSecondary,
                  },
                ]}
              >
                <Text style={[styles.currency, { color: theme.muted }]}>
                  {recaudo.currency}
                </Text>
                <TextInput
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  keyboardType="decimal-pad"
                  placeholder={contributionAmountPlaceholder(recaudo.currency)}
                  placeholderTextColor={theme.muted}
                  style={[styles.amountField, { color: theme.text }]}
                />
              </View>
              <View style={styles.withdrawQuick}>
                <Pressable
                  onPress={() =>
                    setWithdrawAmount(String(withdrawableMinor / 100))
                  }
                  style={[
                    styles.quickChip,
                    { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <Text style={{ color: theme.primary, fontWeight: "700" }}>
                    Retirar todo
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={withdrawNote}
                onChangeText={setWithdrawNote}
                placeholder="Motivo (opcional)"
                placeholderTextColor={theme.muted}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceSecondary,
                  },
                ]}
              />
              <PrimaryButton
                icon="arrow.up.circle.fill"
                onPress={withdrawing ? undefined : () => void withdrawFunds()}
              >
                {withdrawing ? "Retirando…" : "Confirmar retiro"}
              </PrimaryButton>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Progreso del recaudo
          </Text>
          <Text style={[styles.percent, { color: category.color }]}>
            {percent}%
          </Text>
        </View>
        <ProgressBar
          value={ratio}
          color={category.color}
          label={`Progreso ${percent}%`}
        />
        <View style={styles.stats}>
          <View
            style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
          >
            <Text style={[styles.statLabel, { color: theme.muted }]}>
              Meta mensual
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatMinor(recaudo.monthlyTargetMinor, recaudo.currency)}
            </Text>
          </View>
          <View
            style={[styles.stat, { backgroundColor: theme.surfaceSecondary }]}
          >
            <Text style={[styles.statLabel, { color: theme.muted }]}>
              Participantes
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {recaudo.participants.length}
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle>Participantes</SectionTitle>
      <Card style={styles.listCard}>
        {recaudo.participants.map((participant, index) => (
          <View
            key={participant.id}
            style={[
              styles.personRow,
              index > 0 && {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: `${category.color}20` },
              ]}
            >
              <Text style={[styles.avatarText, { color: category.color }]}>
                {initials(participant.name)}
              </Text>
            </View>
            <View style={styles.copy}>
              <View style={styles.nameLine}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {participant.name}
                </Text>
                {participant.role === "organizer" ? (
                  <Pill tone="blue">Organiza</Pill>
                ) : null}
              </View>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                {formatMinor(participant.contributedMinor, recaudo.currency)}{" "}
                aportados ·{" "}
                {
                  frequencies.find(
                    (item) => item.value === participant.frequency,
                  )?.label
                }
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {recaudo.isOrganizer ? (
        <Card style={styles.formCard}>
          <View style={styles.formHeading}>
            <View
              style={[styles.smallIcon, { backgroundColor: theme.primarySoft }]}
            >
              <AppIcon
                name="person.badge.plus"
                color={theme.primary}
                size={19}
              />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Invitar por correo
              </Text>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                La invitación se envía mediante TecnoWallet.
              </Text>
            </View>
          </View>
          <TextInput
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="persona@correo.com"
            placeholderTextColor={theme.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.surfaceSecondary,
              },
            ]}
          />
          <PrimaryButton
            icon="paperplane.fill"
            onPress={inviting ? undefined : () => void sendInvite()}
          >
            {inviting ? "Enviando…" : "Enviar invitación"}
          </PrimaryButton>
        </Card>
      ) : null}

      <SectionTitle>Mi aporte</SectionTitle>
      <Card style={styles.formCard}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {fundingReady
            ? "Aportar desde mi cuenta"
            : demo
              ? "Registrar aporte"
              : "Aportar (completa la activación arriba)"}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.muted }]}>
          {fundingReady
            ? "Débito ACH a la cuenta digital del recaudo. No suma a disponible hasta que el banco lo confirme."
            : demo
              ? "En demo el aporte se registra al instante en el pozo."
              : "Abre tu cuenta de banco digital y vincula tu banco para aportar dinero real."}
        </Text>
        <View
          style={[
            styles.amountInput,
            {
              borderColor: theme.border,
              backgroundColor: theme.surfaceSecondary,
            },
          ]}
        >
          <Text style={[styles.currency, { color: theme.muted }]}>
            {recaudo.currency}
          </Text>
          <TextInput
            value={contributionAmount}
            onChangeText={setContributionAmount}
            keyboardType="decimal-pad"
            placeholder={contributionAmountPlaceholder(recaudo.currency)}
            placeholderTextColor={theme.muted}
            style={[styles.amountField, { color: theme.text }]}
          />
        </View>
        <TextInput
          value={contributionNote}
          onChangeText={setContributionNote}
          placeholder="Nota (opcional)"
          placeholderTextColor={theme.muted}
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.surfaceSecondary,
            },
          ]}
        />
        {fundingReady ? (
          <PrimaryButton
            icon="building.columns.fill"
            onPress={
              fundingContribution ? undefined : () => void contributeFunded()
            }
          >
            {fundingContribution ? "Enviando ACH…" : "Aportar con cuenta"}
          </PrimaryButton>
        ) : demo ? (
          <PrimaryButton
            icon="plus"
            onPress={contributing ? undefined : () => void contribute()}
          >
            {contributing ? "Registrando…" : "Registrar aporte"}
          </PrimaryButton>
        ) : (
          <Text style={[styles.rowMeta, { color: theme.muted }]}>
            El botón de aporte con cuenta se habilita al terminar la activación.
          </Text>
        )}

        {!demo ? (
          <>
            <Pressable
              onPress={() => setShowManualContribute((value) => !value)}
              style={styles.manualToggle}
            >
              <Text style={{ color: theme.primary, fontWeight: "700" }}>
                {showManualContribute
                  ? "Ocultar registro manual"
                  : "Solo registrar (sin mover dinero)"}
              </Text>
            </Pressable>
            {showManualContribute ? (
              <PrimaryButton
                icon="plus"
                onPress={contributing ? undefined : () => void contribute()}
              >
                {contributing ? "Registrando…" : "Registrar aporte manual"}
              </PrimaryButton>
            ) : null}
          </>
        ) : null}
      </Card>

      <SectionTitle>Mi configuración</SectionTitle>
      <Card style={styles.formCard}>
        <View>
          <Text style={[styles.fieldLabel, { color: theme.muted }]}>
            Compromiso mensual
          </Text>
          <View
            style={[
              styles.amountInput,
              {
                borderColor: theme.border,
                backgroundColor: theme.surfaceSecondary,
              },
            ]}
          >
            <Text style={[styles.currency, { color: theme.muted }]}>
              {recaudo.currency}
            </Text>
            <TextInput
              value={monthlyAmount}
              onChangeText={setMonthlyAmount}
              keyboardType="decimal-pad"
              placeholder="Monto mensual"
              placeholderTextColor={theme.muted}
              style={[styles.amountField, { color: theme.text }]}
            />
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: theme.muted }]}>
          Frecuencia
        </Text>
        <View style={styles.options}>
          {frequencies.map((item) => {
            const selected = frequency === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setFrequency(item.value)}
                style={[
                  styles.option,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected
                      ? theme.primarySoft
                      : theme.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? theme.primary : theme.text,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { color: theme.muted }]}>
          Forma de aporte
        </Text>
        <View style={styles.modeOptions}>
          {modes.map((item) => {
            const selected = mode === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setMode(item.value)}
                style={[
                  styles.modeOption,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected
                      ? theme.primarySoft
                      : theme.surfaceSecondary,
                  },
                ]}
              >
                <AppIcon
                  name={item.icon}
                  color={selected ? theme.primary : theme.muted}
                  size={18}
                />
                <Text
                  style={{
                    color: selected ? theme.primary : theme.text,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {mode === "card_simulated" ? (
          <View style={[styles.simulatedCard, { backgroundColor: "#14213D" }]}>
            <AppIcon name="creditcard.fill" color="#FFFFFF" size={22} />
            <View style={styles.copy}>
              <Text style={styles.cardBrand}>Visa simulada</Text>
              <Text style={styles.cardNumber}>•••• 4242 · Sin cobro real</Text>
            </View>
            <AppIcon name="checkmark.circle.fill" color="#32D583" size={20} />
          </View>
        ) : null}

        <View style={[styles.reminderRow, { borderColor: theme.border }]}>
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>
              Recordatorios
            </Text>
            <Text style={[styles.rowMeta, { color: theme.muted }]}>
              Según la frecuencia seleccionada
            </Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            trackColor={{ true: theme.primary }}
          />
        </View>
        {remindersEnabled ? (
          <View style={styles.reminderTimeBlock}>
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>
              Hora del recordatorio
            </Text>
            <View style={styles.timeOptions}>
              {reminderTimes.map((item) => {
                const selected = reminderTime === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setReminderTime(item)}
                    style={[
                      styles.timeOption,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected
                          ? theme.primarySoft
                          : theme.surfaceSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        { color: selected ? theme.primary : theme.text },
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={reminderTime}
              onChangeText={setReminderTime}
              placeholder="HH:mm"
              placeholderTextColor={theme.muted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceSecondary,
                },
              ]}
            />
          </View>
        ) : null}
        <PrimaryButton
          icon="checkmark"
          onPress={savingPlan ? undefined : () => void savePlan()}
        >
          {savingPlan ? "Guardando…" : "Guardar configuración"}
        </PrimaryButton>
      </Card>

      <SectionTitle>Historial</SectionTitle>
      <Card style={styles.listCard}>
        {contributions.length === 0 ? (
          <Text style={[styles.centerText, { color: theme.muted }]}>
            Aún no hay aportes en este recaudo.
          </Text>
        ) : (
          contributions.map((contribution, index) => {
            const isWithdrawal = contribution.method === "withdrawal";
            return (
            <View
              key={contribution.id}
              style={[
                styles.historyRow,
                index > 0 && {
                  borderTopColor: theme.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View
                style={[
                  styles.historyIcon,
                  {
                    backgroundColor: isWithdrawal
                      ? `${theme.danger}22`
                      : theme.successSoft,
                  },
                ]}
              >
                <AppIcon
                  name={
                    isWithdrawal
                      ? "arrow.up.circle.fill"
                      : "arrow.down.circle.fill"
                  }
                  color={isWithdrawal ? theme.danger : theme.success}
                  size={20}
                />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {isWithdrawal ? "Retiro del pozo" : contribution.participantName}
                </Text>
                <Text style={[styles.rowMeta, { color: theme.muted }]}>
                  {formatDate(contribution.occurredAt, true)} ·{" "}
                  {isWithdrawal
                    ? contribution.participantName
                    : contribution.method === "manual"
                      ? "Manual"
                      : "Tarjeta simulada"}
                  {contribution.pending ? " · Pendiente de sincronizar" : ""}
                </Text>
                {contribution.note ? (
                  <Text style={[styles.note, { color: theme.muted }]}>
                    {contribution.note}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.historyAmount,
                  { color: isWithdrawal ? theme.danger : theme.success },
                ]}
              >
                {isWithdrawal ? "−" : "+"}
                {formatMinor(contribution.amountMinor, recaudo.currency)}
              </Text>
            </View>
            );
          })
        )}
      </Card>

      <Modal
        visible={Boolean(successMessage)}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessMessage(undefined)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.successModal, { backgroundColor: theme.surface }]}
          >
            <View
              style={[
                styles.successIcon,
                { backgroundColor: theme.successSoft },
              ]}
            >
              <AppIcon
                name="checkmark.circle.fill"
                color={theme.success}
                size={36}
              />
            </View>
            <Text style={[styles.successTitle, { color: theme.text }]}>
              Configuración guardada
            </Text>
            <Text style={[styles.successText, { color: theme.muted }]}>
              {successMessage}
            </Text>
            <PrimaryButton onPress={() => setSuccessMessage(undefined)}>
              Entendido
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingVertical: 10,
  },
  hero: { borderWidth: 0, gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#FFFFFF25",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: { color: "#FFFFFFCC", fontSize: 13, fontWeight: "600" },
  heroValue: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  heroHint: { color: "#FFFFFFCC", fontSize: 12 },
  heroTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: "#FFFFFF35",
    overflow: "hidden",
  },
  heroFill: { height: 8, borderRadius: 5, backgroundColor: "#FFFFFF" },
  balanceCard: { gap: 12 },
  manualToggle: { paddingVertical: 4 },
  actionCard: { gap: 12 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: { fontSize: 14, fontWeight: "800" },
  withdrawForm: { gap: 10 },
  withdrawQuick: { flexDirection: "row" },
  quickChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: { gap: 13 },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  percent: { fontSize: 18, fontWeight: "800" },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 13, padding: 12, gap: 3 },
  statLabel: { fontSize: 11, fontWeight: "600" },
  statValue: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  listCard: { paddingVertical: 3 },
  personRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  avatar: {
    width: 41,
    height: 41,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "800" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowMeta: { fontSize: 11, lineHeight: 16 },
  formCard: { gap: 11 },
  formHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
  },
  amountInput: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },
  currency: { fontSize: 11, fontWeight: "800", marginRight: 9 },
  amountField: { flex: 1, paddingVertical: 10, fontSize: 15 },
  fieldLabel: { fontSize: 11, fontWeight: "700", marginBottom: 7 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: {
    minWidth: "47%",
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  modeOptions: { flexDirection: "row", gap: 8 },
  modeOption: {
    flex: 1,
    minHeight: 50,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  simulatedCard: {
    minHeight: 61,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardBrand: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  cardNumber: { color: "#FFFFFFAA", fontSize: 11 },
  reminderRow: {
    minHeight: 60,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  reminderTimeBlock: { gap: 8 },
  timeOptions: { flexDirection: "row", gap: 7 },
  timeOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  timeOptionText: { fontSize: 12, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000066",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successModal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 14,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 21, fontWeight: "800", textAlign: "center" },
  successText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  historyRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { fontSize: 11, fontStyle: "italic" },
  historyAmount: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
