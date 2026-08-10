import { Platform } from "react-native";

import { resolveCalendarReminderAt } from "@/data/calendar";
import { localStorage } from "@/services/persistence";

type ActivityKind = "income" | "expense" | "calendar" | "recaudo";
type RecaudoFrequency = "daily" | "weekly" | "biweekly" | "monthly";

let handlerConfigured = false;

async function notificationsModule() {
  if (Platform.OS === "web") return null;
  return import("expo-notifications");
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
  // income/expense activity pings follow the payments preference.
  return (await localStorage.get("prefs-reminder-payments", true)) !== false;
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
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("activity", {
      name: "Actividad financiera",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#0878F9",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const result =
    current.status === "granted"
      ? current
      : await Notifications.requestPermissionsAsync();

  return result.status === "granted";
}

async function sendActivityNotification(input: {
  kind: ActivityKind;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    if (!(await reminderKindEnabled(input.kind))) return;
    const enabled = await configureActivityNotifications();
    if (!enabled) return;
    const Notifications = await notificationsModule();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        sound: "default",
        data: { kind: input.kind, ...input.data },
      },
      trigger: null,
    });
  } catch {
    // A notification must never roll back a saved financial/calendar action.
  }
}

export function notifyTransactionAdded(input: {
  kind: "income" | "expense";
  concept: string;
  amount: number;
  ledgerName: string;
}) {
  const amount = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
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
        sound: "default",
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
      sound: "default" as const,
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
