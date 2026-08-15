import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { safeGoBack } from "@/lib/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AppIcon,
  Card,
  IconButton,
  Pill,
  PrimaryButton,
  ScalePressable,
  Screen,
  SectionTitle,
  useAppTheme,
} from "@/components/ui";
import { RecaudoHeroCard } from "@/components/recaudo-hero-card";
import {
  RecaudoReceiveSheet,
  RecaudoTermsModal,
  RecaudoWithdrawSheet,
} from "@/components/recaudo-money-flows";
import { useAppCopy } from "@/i18n/app-copy";
import { intlLocale } from "@/i18n/locale-format";
import { amountToMinorUnits, isZeroDecimalCurrency } from "@/lib/currencies";
import { recaudoIntlCurrency } from "@/lib/recaudo-digital-pricing";
import {
  fetchRecaudoActivation,
  formatActivationAmount,
  startRecaudoActivationCheckout,
  type RecaudoActivation,
} from "@/lib/recaudo-activation";
import { ApiError } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { useLanguageStore } from "@/store/language";
import {
  fetchRecaudoKyc,
  hostedVerificationUrl,
  kycCanRestart,
  kycStatusLabel,
  openHostedVerificationUrl,
  startRecaudoKyc,
  type RecaudoKyc,
} from '@/lib/recaudo-kyc';
import {
  useRecaudosStore,
  type ContributionFrequency,
  type ContributionMode,
  type RecaudoCategory,
} from "@/store/recaudos";
import { useUnitFundingStore } from "@/store/unit-funding";

const categoryIcons: Record<
  RecaudoCategory,
  { icon: string; color: string }
> = {
  travel: { icon: "airplane", color: "#0878F9" },
  gift: { icon: "gift.fill", color: "#EE46BC" },
  event: { icon: "ticket.fill", color: "#7F56D9" },
  purchase: { icon: "cart.fill", color: "#F79009" },
  other: { icon: "sparkles", color: "#0E9F6E" },
};

function frequencyOptions(locale: string): { value: ContributionFrequency; label: string }[] {
  return locale === "es"
    ? [
        { value: "daily", label: "Diario" },
        { value: "weekly", label: "Semanal" },
        { value: "biweekly", label: "Quincenal" },
        { value: "monthly", label: "Mensual" },
      ]
    : [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "biweekly", label: "Biweekly" },
        { value: "monthly", label: "Monthly" },
      ];
}

function modeOptions(locale: string): { value: ContributionMode; label: string; icon: string }[] {
  return locale === "es"
    ? [
        { value: "manual", label: "Manual", icon: "hand.raised.fill" },
        {
          value: "bank_auto",
          label: "Débito automático",
          icon: "building.columns.fill",
        },
      ]
    : [
        { value: "manual", label: "Manual", icon: "hand.raised.fill" },
        {
          value: "bank_auto",
          label: "Auto debit",
          icon: "building.columns.fill",
        },
      ];
}

const reminderTimes = ["08:00", "12:00", "18:00", "20:00"] as const;

/** Bridge APIs are not approved yet. Hide Unit KYC / ACH until then. */
const BRIDGE_PAYMENTS_LIVE = false;

function leaveRecaudo() {
  safeGoBack('/(tabs)/recaudos');
}

function formatMinor(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: recaudoIntlCurrency(currency),
    maximumFractionDigits: isZeroDecimalCurrency(currency) ? 0 : 2,
  }).format(value / 100);
}

function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** How many contribution periods fit in the current month for a frequency. */
function periodsInCurrentMonth(frequency: ContributionFrequency) {
  const days = daysInMonth();
  switch (frequency) {
    case "daily":
      return days;
    case "weekly":
      return days / 7;
    case "biweekly":
      return 2;
    case "monthly":
    default:
      return 1;
  }
}

function perPersonMonthlyMinor(monthlyTargetMinor: number, memberCount: number) {
  const n = Math.max(memberCount, 1);
  return Math.round(monthlyTargetMinor / n);
}

function installmentMinor(
  monthlyShareMinor: number,
  frequency: ContributionFrequency,
) {
  const periods = periodsInCurrentMonth(frequency);
  if (periods <= 0) return monthlyShareMinor;
  return Math.round(monthlyShareMinor / periods);
}

function formatDate(value: string, locale: string, withTime = false) {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
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
  const copy = useAppCopy();
  const locale = useLanguageStore((state) => state.locale);
  const t = (es: string, en: string) => (locale === "es" ? es : en);
  const frequencies = frequencyOptions(locale);
  const modes = modeOptions(locale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const recaudos = useRecaudosStore((state) => state.recaudos);
  const hydrated = useRecaudosStore((state) => state.hydrated);
  const hydrate = useRecaudosStore((state) => state.hydrate);
  const addContribution = useRecaudosStore((state) => state.addContribution);
  const withdraw = useRecaudosStore((state) => state.withdraw);
  const updateMyPlan = useRecaudosStore((state) => state.updateMyPlan);
  const deleteRecaudo = useRecaudosStore((state) => state.deleteRecaudo);
  const refreshRecaudos = useRecaudosStore((state) => state.refresh);
  const updateRecaudo = useRecaudosStore((state) => state.updateRecaudo);
  const provisionRail = useRecaudosStore((state) => state.provisionRail);
  const profile = useAuthStore((state) => state.profile);
  const demo = useAuthStore((state) => state.demo);
  const recaudo = recaudos.find((item) => item.id === id);

  const identity = useUnitFundingStore((state) => state.identity);
  const counterparties = useUnitFundingStore((state) => state.counterparties);
  const walletsByRecaudo = useUnitFundingStore(
    (state) => state.walletsByRecaudo,
  );
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
  const ensureRecaudoWallet = useUnitFundingStore(
    (state) => state.ensureRecaudoWallet,
  );
  const wallet = id ? walletsByRecaudo[id] : undefined;
  const linkBankAccount = useUnitFundingStore((state) => state.linkBankAccount);
  const fundContribution = useUnitFundingStore(
    (state) => state.fundContribution,
  );
  const fundWithdrawal = useUnitFundingStore((state) => state.fundWithdrawal);
  const syncSchedule = useUnitFundingStore((state) => state.syncSchedule);
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

  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [contributing, setContributing] = useState(false);
  const [fundingContribution, setFundingContribution] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showManualContribute, setShowManualContribute] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [frequency, setFrequency] = useState<ContributionFrequency>("monthly");
  const [mode, setMode] = useState<ContributionMode>("manual");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [savingPlan, setSavingPlan] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();
  const [kycLive, setKycLive] = useState<RecaudoKyc>();
  const [ensuringRail, setEnsuringRail] = useState(false);
  const [kycBusy, setKycBusy] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activation, setActivation] = useState<RecaudoActivation>();
  const [bankName, setBankName] = useState(profile.name || "Sandbox Account");
  const [routingNumber, setRoutingNumber] = useState("011401533");
  const [accountNumber, setAccountNumber] = useState("1000000001");

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!recaudo || demo || !recaudo.isOrganizer) return;
    const loadActivation = () => {
      void fetchRecaudoActivation()
        .then((next) => setActivation(next))
        .catch(() => undefined);
    };
    loadActivation();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") loadActivation();
    });
    return () => sub.remove();
  }, [demo, recaudo?.id, recaudo?.isOrganizer]);

  useEffect(() => {
    if (!recaudo || demo || !recaudo.isOrganizer) return;
    if (activation?.paid !== true) {
      setKycLive(undefined);
      return;
    }
    void fetchRecaudoKyc()
      .then((next) => setKycLive(next))
      .catch(() => undefined);
  }, [demo, recaudo?.id, recaudo?.isOrganizer, activation?.paid]);

  useEffect(() => {
    if (!BRIDGE_PAYMENTS_LIVE || !recaudo || demo) return;
    void bootstrapForRecaudo(recaudo.id);
  }, [bootstrapForRecaudo, demo, recaudo?.id]);

  useEffect(() => {
    if (!BRIDGE_PAYMENTS_LIVE || !recaudo || demo) return;
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
    setFrequency(myParticipant.frequency);
    setMode(
      myParticipant.mode === "card_simulated" ||
        (!BRIDGE_PAYMENTS_LIVE && myParticipant.mode === "bank_auto")
        ? "manual"
        : myParticipant.mode,
    );
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
        withTabBar
        title={hydrated ? copy.collectionDetail.notFound : copy.collectionDetail.loading}
        right={
          <Pressable
            accessibilityLabel={copy.collectionDetail.back}
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
              {locale === "es"
                ? "Este recaudo ya no está disponible."
                : "This collection is no longer available."}
            </Text>
          </Card>
        ) : null}
      </Screen>
    );
  }

  const category = categoryIcons[recaudo.category];
  const needsEnable =
    !demo &&
    recaudo.isOrganizer &&
    recaudo.payoutMethod === "digital" &&
    activation?.paid !== true;
  const activationAmountLabel = activation
    ? formatActivationAmount(activation.amount, activation.currency)
    : formatActivationAmount(2.99, "USD");
  const fundingReady =
    BRIDGE_PAYMENTS_LIVE &&
    useUnitFundingStore
      .getState()
      .isFundingReady(recaudo.id, recaudo.isOrganizer);
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
  const needsWallet = false;
  const walletReady = Boolean(wallet?.unitWalletId && wallet.status === "open");
  const needsBank =
    !demo &&
    identity.status === "approved" &&
    !activeBank &&
    (!recaudo.isOrganizer || walletReady);

  const fmt = (value: number) => formatMinor(value, recaudo.currency, locale);
  const fmtDate = (value: string, withTime = false) =>
    formatDate(value, locale, withTime);
  const memberCount = Math.max(recaudo.participants.length, 1);
  const monthlyShareMinor = perPersonMonthlyMinor(
    recaudo.monthlyTargetMinor,
    memberCount,
  );
  const planInstallmentMinor = installmentMinor(monthlyShareMinor, frequency);
  const commitmentLabel =
    frequency === "daily"
      ? t("Compromiso diario", "Daily commitment")
      : frequency === "weekly"
        ? t("Compromiso semanal", "Weekly commitment")
        : frequency === "biweekly"
          ? t("Compromiso quincenal", "Biweekly commitment")
          : t("Compromiso mensual", "Monthly commitment");

  const activateUnit = async () => {
    try {
      const next = await activatePayments();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (next.status === "approved") {
        Alert.alert(
          "Cuenta TecnoWallet lista",
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
      await ensureRecaudoWallet(recaudo.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Cuenta TecnoWallet lista",
        "Este recaudo ya tiene su cuenta para recibir aportes.",
      );
    } catch (error) {
      Alert.alert(
        "No se pudo abrir la cuenta TecnoWallet",
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
        `Solo hay ${fmt(withdrawableMinor)} disponible para retirar.`,
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
            ? `Retiro acreditado por ${fmt(amountMinor)}.`
            : `Retiro ACH en tránsito por ${fmt(amountMinor)}.`,
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
            : `Retiraste ${fmt(amountMinor)} del pozo.`,
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

  const ensureRail = async (
    currency: 'cop' | 'usd' | 'eur' | 'mxn' | 'brl' | 'crypto',
  ) => {
    if (demo) return;
    setEnsuringRail(true);
    try {
      if (recaudo.isOrganizer) {
        const next = await fetchRecaudoKyc();
        setKycLive(next);
        if (!next.verified) return;
      }
      await provisionRail(recaudo.id, currency);
    } catch (error) {
      Alert.alert(
        'No se pudo abrir este medio',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setEnsuringRail(false);
    }
  };

  const payActivation = async () => {
    setActivating(true);
    try {
      const result = await startRecaudoActivationCheckout();
      if (result.paid) {
        setActivation(await fetchRecaudoActivation());
        return;
      }
      const next = await fetchRecaudoActivation();
      setActivation(next);
      if (!next.paid) {
        Alert.alert(
          "Pago en Mercado Pago",
          "Si ya pagaste, espera unos segundos y vuelve a abrir esta pantalla. La wallet se activa cuando Mercado Pago confirma el cobro.",
        );
      }
    } catch (error) {
      Alert.alert(
        "No se pudo abrir Mercado Pago",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setActivating(false);
    }
  };

  const verifyForReceive = async () => {
    setKycBusy(true);
    try {
      const retry = Boolean(
        kycLive && !kycLive.verified && (kycLive.kycLinkId || kycLive.customerId),
      );
      const next =
        kycLive && !kycCanRestart(kycLive)
          ? await fetchRecaudoKyc()
          : await startRecaudoKyc(retry);
      setKycLive(next);
      if (next.verified) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      const url = hostedVerificationUrl(next);
      if (url) await openHostedVerificationUrl(url);
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        await payActivation();
        return;
      }
      Alert.alert(
        "No se pudo verificar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setKycBusy(false);
    }
  };

  const contributeFromSheet = async (raw: string) => {
    const amountMinor = amountToMinorUnits(raw, recaudo.currency);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      Alert.alert("Aporte inválido", "Escribe un monto mayor a cero.");
      return;
    }
    setContributing(true);
    try {
      await addContribution(recaudo.id, amountMinor);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReceiveOpen(false);
    } catch (error) {
      Alert.alert(
        "No se pudo registrar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setContributing(false);
    }
  };

  const withdrawFromSheet = async (raw: string) => {
    setWithdrawAmount(raw);
    const amountMinor = amountToMinorUnits(raw, recaudo.currency);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      Alert.alert("Retiro inválido", "Escribe un monto mayor a cero.");
      return;
    }
    if (amountMinor > withdrawableMinor) {
      Alert.alert(
        "Monto demasiado alto",
        `Solo hay ${fmt(withdrawableMinor)} disponible para retirar.`,
      );
      return;
    }
    setWithdrawing(true);
    try {
      await withdraw(recaudo.id, amountMinor);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWithdrawOpen(false);
    } catch (error) {
      Alert.alert(
        "No se pudo retirar",
        error instanceof Error ? error.message : "Inténtalo de nuevo.",
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const potBalanceMinor = fundingReady
    ? availableMinor + inTransitMinor
    : recaudo.collectedMinor;

  const confirmDeleteRecaudo = () => {
    if (!recaudo.isOrganizer) return;
    if (potBalanceMinor > 0) {
      Alert.alert(
        copy.collectionDetail.deleteBlockedTitle,
        copy.collectionDetail.deleteBlockedBody,
      );
      return;
    }
    Alert.alert(copy.collectionDetail.deleteTitle, copy.collectionDetail.deleteConfirm, [
      { text: copy.common.close, style: "cancel" },
      {
        text: copy.common.delete,
        style: "destructive",
        onPress: () => void runDeleteRecaudo(),
      },
    ]);
  };

  const runDeleteRecaudo = async () => {
    setDeleting(true);
    try {
      await deleteRecaudo(recaudo.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      leaveRecaudo();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Inténtalo de nuevo.";
      if (/fondos|funds|retir/i.test(message)) {
        Alert.alert(copy.collectionDetail.deleteBlockedTitle, message);
      } else {
        Alert.alert(copy.collectionDetail.deleteTitle, message);
      }
    } finally {
      setDeleting(false);
    }
  };

  const savePlan = async () => {
    const monthlyCommitmentMinor = planInstallmentMinor;
    if (
      !Number.isSafeInteger(monthlyCommitmentMinor) ||
      monthlyCommitmentMinor <= 0
    ) {
      Alert.alert(
        "Monto inválido",
        "Este recaudo aún no tiene una meta mensual para calcular tu compromiso.",
      );
      return;
    }
    if (mode === "bank_auto" && (!BRIDGE_PAYMENTS_LIVE || !fundingReady || demo)) {
      Alert.alert(
        "Activa el débito con cuenta",
        "Completa la cuenta digital y vincula tu banco antes de programar el débito automático.",
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
      let scheduleCopy = "";
      if (mode === "bank_auto" && !demo) {
        const schedule = await syncSchedule(recaudo.id);
        const next = schedule?.nextRunAt
          ? new Date(schedule.nextRunAt).toLocaleString(intlLocale(locale), {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null;
        scheduleCopy = next
          ? ` Débito ACH programado (próximo: ${next}). Usa el mismo riel que “Aportar con cuenta”.`
          : " Débito ACH programado con la frecuencia elegida (mismo riel que “Aportar con cuenta”).";
      }
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
        `Tu aporte ${frequencyLabel.toLowerCase()} quedó configurado como ${modeLabel.toLowerCase()}.${scheduleCopy} ${reminderCopy}`,
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
      withTabBar
      title={recaudo.title}
      right={
        <View style={styles.headerActions}>
          {recaudo.isOrganizer ? (
            <>
              <IconButton
                icon="pencil"
                label={t("Editar recaudo", "Edit collection")}
                onPress={() =>
                  router.push({
                    pathname: "/add-recaudo",
                    params: { id: recaudo.id },
                  })
                }
              />
              <IconButton
                icon="person.badge.plus"
                label={copy.common.inviteTo(recaudo.title)}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/recaudos",
                    params: { focus: recaudo.id, tab: "share" },
                  })
                }
              />
            </>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.collectionDetail.back}
            onPress={leaveRecaudo}
            style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}
          >
            <AppIcon name="arrow.left" color={theme.text} />
          </Pressable>
        </View>
      }
    >
      <RecaudoHeroCard
        categoryIcon={category.icon}
        collectedMinor={fundingReady ? availableMinor : recaudo.collectedMinor}
        targetMinor={recaudo.targetMinor}
        percent={percent}
        ratio={ratio}
      />

      <View style={styles.ctaRow}>
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={needsEnable ? "Comprar wallet digital" : "Recargar recaudo"}
          onPress={() => {
            if (needsEnable) {
              void payActivation();
              return;
            }
            setReceiveOpen(true);
          }}
          style={[styles.ctaPrimary, { backgroundColor: theme.primary }]}>
          <Text style={styles.ctaPrimaryText}>
            {needsEnable ? (activating ? "Abriendo…" : "Comprar wallet") : "+ Recargar"}
          </Text>
        </ScalePressable>
        {recaudo.isOrganizer && !needsEnable ? (
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Retirar del recaudo"
            onPress={() => setWithdrawOpen(true)}
            style={[styles.ctaSecondary, { backgroundColor: theme.surfaceSecondary }]}>
            <Text style={[styles.ctaSecondaryText, { color: theme.text }]}>Retirar</Text>
          </ScalePressable>
        ) : null}
      </View>

      {needsEnable ? (
        <Card style={styles.kycBanner}>
          <Text style={[styles.kycText, { color: theme.text }]}>
            Wallet digital TecnoWallet
          </Text>
          <Text style={[styles.rowMeta, { color: theme.muted }]}>
            Por {activationAmountLabel} compras una wallet digital. Cuando completes la
            verificación, podrás recibir aportes en USD, EUR, COP, MXN y R$.
          </Text>
          <PrimaryButton onPress={activating ? undefined : () => void payActivation()}>
            {activating ? "Abriendo Mercado Pago…" : `Comprar wallet · ${activationAmountLabel}`}
          </PrimaryButton>
        </Card>
      ) : !demo && recaudo.payoutMethod === "digital" ? (
        <Card style={styles.kycBanner}>
          <Text style={[styles.kycText, { color: theme.text }]}>
            Verificación: {kycStatusLabel(kycLive?.kycStatus || recaudo.tecnoAccount?.kycStatus)}
          </Text>
          {kycLive?.verified || recaudo.tecnoAccount?.kycStatus === "approved" ? (
            <Text style={[styles.rowMeta, { color: theme.muted }]}>
              Identidad confirmada. Recarga para abrir el medio de depósito que uses.
            </Text>
          ) : (
            <Text style={[styles.rowMeta, { color: theme.muted }]}>
              El siguiente paso es Recargar: ahí verificas tu identidad y eliges cómo recibir.
            </Text>
          )}
        </Card>
      ) : null}

      <SectionTitle>{copy.collectionDetail.participants}</SectionTitle>
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
                  <Pill tone="blue">{copy.collectionDetail.organizes}</Pill>
                ) : null}
              </View>
              <Text style={[styles.rowMeta, { color: theme.muted }]}>
                {fmt(participant.contributedMinor)}{" "}
                {locale === "es" ? "aportados" : "contributed"} ·{" "}
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

      <Pressable onPress={() => setPlanOpen((value) => !value)}>
        <Text style={[styles.planToggle, { color: theme.primary }]}>
          {planOpen ? "Ocultar mi aporte mensual" : "Mi aporte mensual"}
        </Text>
      </Pressable>
      {planOpen ? (
        <Card style={styles.formCard}>
          <Text style={[styles.planQuestion, { color: theme.text }]}>
            {t(
              "¿Cómo vas a completar tu parte este mes?",
              "How will you cover your share this month?",
            )}
          </Text>
          <View>
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>{commitmentLabel}</Text>
            <View
              style={[
                styles.amountInput,
                { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
              ]}>
              <Text style={[styles.currency, { color: theme.muted }]}>USDc</Text>
              <TextInput
                value={String(planInstallmentMinor / 100)}
                editable={false}
                style={[styles.amountField, { color: theme.text }]}
              />
            </View>
          </View>
          <PrimaryButton
            icon="checkmark"
            onPress={savingPlan ? undefined : () => void savePlan()}>
            {savingPlan ? t("Guardando…", "Saving…") : t("Guardar", "Save")}
          </PrimaryButton>
        </Card>
      ) : null}

      <SectionTitle>{t("Historial", "History")}</SectionTitle>
      <Card style={styles.listCard}>
        {contributions.length === 0 ? (
          <Text style={[styles.centerText, { color: theme.muted }]}>
            {t(
              "Aún no hay aportes en este recaudo.",
              "No contributions in this collection yet.",
            )}
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
                  {fmtDate(contribution.occurredAt, true)} ·{" "}
                  {isWithdrawal
                    ? contribution.participantName
                    : contribution.method === "manual"
                      ? "Manual"
                      : locale === "es"
                        ? "Tarjeta simulada"
                        : "Simulated card"}
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
                {fmt(contribution.amountMinor)}
              </Text>
            </View>
            );
          })
        )}
      </Card>

      {recaudo.isOrganizer ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.collectionDetail.delete}
          disabled={deleting}
          onPress={confirmDeleteRecaudo}
          style={[
            styles.deleteBtn,
            { borderColor: theme.danger, opacity: deleting ? 0.6 : 1 },
          ]}
        >
          <AppIcon name="trash" color={theme.danger} size={16} />
          <Text style={[styles.deleteText, { color: theme.danger }]}>
            {deleting
              ? copy.collectionDetail.deleting
              : copy.collectionDetail.delete}
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={() => setTermsOpen(true)} style={styles.termsLinkWrap}>
        <Text style={[styles.termsLink, { color: theme.muted }]}>Condiciones y costos</Text>
      </Pressable>

      <RecaudoReceiveSheet
        visible={receiveOpen}
        recaudo={recaudo}
        onClose={() => setReceiveOpen(false)}
        onRegister={contributeFromSheet}
        registering={contributing}
        onEnsureRail={ensureRail}
        ensuring={ensuringRail}
        kyc={kycLive}
        onVerify={recaudo.isOrganizer ? verifyForReceive : undefined}
        verifying={kycBusy}
        isOrganizer={recaudo.isOrganizer}
        activationPaid={demo || !recaudo.isOrganizer ? true : Boolean(activation?.paid)}
        activationLabel={
          activation
            ? formatActivationAmount(activation.amount, activation.currency)
            : undefined
        }
        onActivate={payActivation}
        activating={activating}
      />
      <RecaudoWithdrawSheet
        visible={withdrawOpen}
        recaudo={recaudo}
        availableLabel={`$${(withdrawableMinor / 100).toLocaleString(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        onClose={() => setWithdrawOpen(false)}
        onSaveDestination={(details) =>
          updateRecaudo(recaudo.id, { payoutAccountDetails: details }).then(() => undefined)
        }
        onWithdraw={withdrawFromSheet}
        withdrawing={withdrawing}
      />
      <RecaudoTermsModal visible={termsOpen} onClose={() => setTermsOpen(false)} />

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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  ctaPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  ctaSecondary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSecondaryText: { fontSize: 14, fontWeight: "700" },
  kycBanner: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  kycText: { fontSize: 13, fontWeight: "700" },
  planToggle: { fontSize: 14, fontWeight: "700", paddingVertical: 4 },
  termsLinkWrap: { alignItems: "center", paddingVertical: 10 },
  termsLink: { fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
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
  payoutDetails: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
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
  comingSoonBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
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
  planQuestion: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2, lineHeight: 22 },
  amountReadout: { fontWeight: "700", fontVariant: ["tabular-nums"] },
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
  modeOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeOption: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 108,
    minHeight: 50,
    paddingHorizontal: 8,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
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
  deleteBtn: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteText: { fontSize: 15, fontWeight: "700" },
});
