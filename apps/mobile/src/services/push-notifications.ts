import { Platform } from "react-native";

import { resolveCalendarReminderAt } from "@/data/calendar";
import { localStorage } from "@/services/persistence";

type ActivityKind =
  | "income"
  | "expense"
  | "calendar"
  | "recaudo"
  | "account"
  | "envelope"
  | "planning"
  | "goal"
  | "invite"
  | "system";
type RecaudoFrequency = "daily" | "weekly" | "biweekly" | "monthly";

/** Bundled via expo-notifications `sounds` in app.json (base filename only). */
const SOUND_INGRESO = "ingreso.wav";
const SOUND_GASTO = "gasto.wav";
const SOUND_CALENDARIO = "calendario.wav";
const SOUND_SOBRES = "sobres.wav";

export type NotificationSound =
  | "ingreso"
  | "gasto"
  | "calendario"
  | "sobres"
  | "default";

let handlerConfigured = false;
let listenersConfigured = false;

async function notificationsModule() {
  if (Platform.OS === "web") return null;
  return import("expo-notifications");
}

function resolveSoundFile(
  kind: ActivityKind,
  sound?: NotificationSound,
): string {
  if (sound === "ingreso") return SOUND_INGRESO;
  if (sound === "gasto") return SOUND_GASTO;
  if (sound === "calendario") return SOUND_CALENDARIO;
  if (sound === "sobres") return SOUND_SOBRES;
  if (sound === "default") return "default";
  if (kind === "income") return SOUND_INGRESO;
  if (kind === "expense") return SOUND_GASTO;
  if (kind === "calendar") return SOUND_CALENDARIO;
  if (
    kind === "account" ||
    kind === "envelope" ||
    kind === "planning" ||
    kind === "goal" ||
    kind === "invite"
  ) {
    return SOUND_SOBRES;
  }
  // Recaudo create uses sound:'sobres'; aportes/retiros pass explicit sounds.
  return "default";
}

function channelIdForSound(soundFile: string): string | undefined {
  if (Platform.OS !== "android") return undefined;
  if (soundFile === SOUND_INGRESO) return "activity-income";
  if (soundFile === SOUND_GASTO) return "activity-expense";
  if (soundFile === SOUND_CALENDARIO) return "activity-calendar";
  if (soundFile === SOUND_SOBRES) return "activity-create";
  return "activity";
}

async function remindersMasterEnabled() {
  return (await localStorage.get("prefs-reminders", true)) !== false;
}

async function reminderKindEnabled(kind: ActivityKind) {
  if (!(await remindersMasterEnabled())) return false;
  if (kind === "calendar") {
    return (await localStorage.get("prefs-reminder-calendar", true)) !== false;
  }
  if (kind === "recaudo") {
    return (await localStorage.get("prefs-reminder-payments", true)) !== false;
  }
  // Financial activity pings follow the payments preference.
  return (await localStorage.get("prefs-reminder-payments", true)) !== false;
}

export async function syncAppBadge(count: number) {
  try {
    const Notifications = await notificationsModule();
    if (!Notifications) return;

    // Badge requires notification permission (esp. iOS allowBadge).
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== "granted") {
      const result = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      if (result.status !== "granted") return;
    }

    const next = Math.max(0, Math.floor(count));
    await Notifications.setBadgeCountAsync(next);
  } catch {
    // Badge APIs can fail if permissions were denied.
  }
}

export async function configureActivityNotifications(): Promise<boolean> {
  if (!(await remindersMasterEnabled())) return false;
  const Notifications = await notificationsModule();
  if (!Notifications) return false;

  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerConfigured = true;
  }

  if (!listenersConfigured) {
    listenersConfigured = true;
    // Scheduled reminders also land in the in-app bell when they fire.
    Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = (content.data ?? {}) as Record<string, string>;
      if (data.notificationId) return; // Already recorded via recordActivity
      const rawKind = data.kind as ActivityKind | undefined;
      const kind: ActivityKind =
        rawKind === "income" ||
        rawKind === "expense" ||
        rawKind === "calendar" ||
        rawKind === "recaudo" ||
        rawKind === "account" ||
        rawKind === "envelope" ||
        rawKind === "planning" ||
        rawKind === "goal"
          ? rawKind
          : "system";
      void import("@/store/notifications").then(({ recordActivity }) =>
        recordActivity({
          kind,
          title: content.title ?? "Recordatorio",
          body: content.body ?? "",
          icon:
            kind === "calendar"
              ? "calendar"
              : kind === "recaudo"
                ? "person.3.fill"
                : "bell.fill",
          tone: kind === "calendar" ? "purple" : kind === "recaudo" ? "green" : "blue",
          route: data.route,
          push: false,
        }),
      );
    });
  }

  if (Platform.OS === "android") {
    const channelBase = {
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250] as number[],
      showBadge: true,
    };
    await Notifications.setNotificationChannelAsync("activity", {
      name: "Actividad financiera",
      ...channelBase,
      lightColor: "#0878F9",
      sound: "default",
    });
    // Android 8+ binds sound to the channel; custom sounds need their own channels.
    await Notifications.setNotificationChannelAsync("activity-income", {
      name: "Ingresos y aportes",
      ...channelBase,
      lightColor: "#12B76A",
      sound: SOUND_INGRESO,
    });
    await Notifications.setNotificationChannelAsync("activity-expense", {
      name: "Gastos y retiros",
      ...channelBase,
      lightColor: "#F04438",
      sound: SOUND_GASTO,
    });
    await Notifications.setNotificationChannelAsync("activity-calendar", {
      name: "Calendario y recordatorios",
      ...channelBase,
      lightColor: "#7F56D9",
      sound: SOUND_CALENDARIO,
    });
    await Notifications.setNotificationChannelAsync("activity-create", {
      name: "Altas (sobres, cuentas, metas…)",
      ...channelBase,
      lightColor: "#0878F9",
      sound: SOUND_SOBRES,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const result =
    current.status === "granted"
      ? current
      : await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });

  return result.status === "granted";
}

async function sendActivityNotification(input: {
  kind: ActivityKind;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: NotificationSound;
}) {
  try {
    if (!(await reminderKindEnabled(input.kind))) return;
    const enabled = await configureActivityNotifications();
    if (!enabled) return;
    const Notifications = await notificationsModule();
    if (!Notifications) return;

    const sound = resolveSoundFile(input.kind, input.sound);
    const channelId = channelIdForSound(sound);

    // Absolute unread count so the home-screen icon badge updates with the push.
    let badge = 0;
    try {
      const { useNotificationsStore } = await import("@/store/notifications");
      await useNotificationsStore.getState().syncBadge();
      badge = Math.max(0, await Notifications.getBadgeCountAsync());
    } catch {
      try {
        badge = Math.max(0, (await Notifications.getBadgeCountAsync()) + 1);
      } catch {
        badge = 1;
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        sound,
        badge,
        ...(channelId ? { channelId } : {}),
        data: { kind: input.kind, ...input.data },
      },
      trigger: null,
    });
  } catch {
    // A notification must never roll back a saved financial/calendar action.
  }
}

export function notifyActivity(input: {
  kind: ActivityKind;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: NotificationSound;
}) {
  return sendActivityNotification(input);
}

export function notifyTransactionAdded(input: {
  kind: "income" | "expense";
  concept: string;
  amount: number;
  ledgerName: string;
}) {
  const amount = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(input.amount);

  return sendActivityNotification({
    kind: input.kind,
    title: input.kind === "income" ? "Ingreso registrado" : "Gasto registrado",
    body: `${input.concept} · ${amount} · ${input.ledgerName}`,
    data: { route: "/(tabs)/movimientos" },
  });
}

export function notifyCalendarItemAdded(input: {
  title: string;
  date: string;
}) {
  return sendActivityNotification({
    kind: "calendar",
    title: "Nuevo elemento en el calendario",
    body: `${input.title} · ${input.date}`,
    data: { route: "/(tabs)/calendario" },
  });
}

async function cancelStoredNotifications(storageKey: string) {
  const Notifications = await notificationsModule();
  if (!Notifications) return;
  const previous = await localStorage.get<string | string[] | null>(
    storageKey,
    null,
  );
  const previousIds = Array.isArray(previous)
    ? previous
    : previous
      ? [previous]
      : [];
  for (const previousId of previousIds) {
    await Notifications.cancelScheduledNotificationAsync(previousId);
  }
  if (previousIds.length) {
    await localStorage.remove(storageKey);
  }
}

export async function cancelCalendarReminder(itemId: string) {
  try {
    await cancelStoredNotifications(`calendar-reminder:${itemId}`);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleCalendarReminder(input: {
  itemId: string;
  title: string;
  typeLabel: string;
  date: string;
  allDay: boolean;
  startHour?: number;
  reminder?: string;
}) {
  try {
    if (!(await reminderKindEnabled("calendar"))) return false;
    const Notifications = await notificationsModule();
    if (!Notifications) return false;
    const storageKey = `calendar-reminder:${input.itemId}`;
    await cancelStoredNotifications(storageKey);

    const fireAt = resolveCalendarReminderAt({
      date: input.date,
      allDay: input.allDay,
      startHour: input.startHour,
      reminder: input.reminder,
    });
    if (!fireAt) return true;
    if (fireAt.getTime() <= Date.now() + 5_000) return false;
    if (!(await configureActivityNotifications())) return false;

    const timeLabel = new Intl.DateTimeFormat("es-CO", {
      hour: "numeric",
      minute: "2-digit",
    }).format(fireAt);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Recordatorio · ${input.typeLabel}`,
        body: `${input.title} · aviso a las ${timeLabel}`,
        sound: SOUND_CALENDARIO,
        ...(Platform.OS === "android" ? { channelId: "activity-calendar" } : {}),
        data: {
          kind: "calendar",
          route: "/(tabs)/calendario",
          itemId: input.itemId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    await localStorage.set(storageKey, [identifier]);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleRecaudoReminder(input: {
  recaudoId: string;
  title: string;
  frequency: RecaudoFrequency;
  enabled: boolean;
  time: string;
}) {
  try {
    const Notifications = await notificationsModule();
    if (!Notifications) return false;
    const storageKey = `recaudo-reminder:${input.recaudoId}`;
    await cancelStoredNotifications(storageKey);
    if (!input.enabled) return true;
    if (!(await reminderKindEnabled("recaudo"))) return false;
    if (!(await configureActivityNotifications())) return false;

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(input.time);
    if (!match) return false;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const content = {
      title: "Tu aporte al recaudo está pendiente",
      body: `Recuerda aportar a ${input.title}.`,
      sound: SOUND_INGRESO,
      ...(Platform.OS === "android" ? { channelId: "activity-income" } : {}),
      data: {
        kind: "recaudo",
        route: `/(tabs)/recaudo/${input.recaudoId}`,
        recaudoId: input.recaudoId,
      },
    };
    const identifiers: string[] = [];

    if (input.frequency === "biweekly") {
      const next = new Date();
      next.setHours(hour, minute, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 14);
      for (let index = 0; index < 26; index += 1) {
        const date = new Date(next);
        date.setDate(next.getDate() + index * 14);
        identifiers.push(
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date,
            },
          }),
        );
      }
    } else {
      const now = new Date();
      if (input.frequency === "daily") {
        identifiers.push(
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
            },
          }),
        );
      } else if (input.frequency === "weekly") {
        identifiers.push(
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: now.getDay() + 1,
              hour,
              minute,
            },
          }),
        );
      } else {
        identifiers.push(
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
              day: Math.min(now.getDate(), 28),
              hour,
              minute,
            },
          }),
        );
      }
    }

    await localStorage.set(storageKey, identifiers);
    return true;
  } catch {
    // Reminder scheduling must never block saving the contribution plan.
    return false;
  }
}
