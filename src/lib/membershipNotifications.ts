import { Platform } from "react-native";

import { db } from "./database";
import type { Member } from "./types";

const NOTIFICATION_SCOPE = "gym-membership";
const ALERT_HOUR = 9;
const EXPIRING_SOON_DAYS = 7;

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: NotificationsModule | null = null;
let notificationsUnavailableWarningShown = false;

function isNotificationsModule(value: unknown): value is NotificationsModule {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<NotificationsModule>;
  return (
    typeof candidate.setNotificationHandler === "function" &&
    typeof candidate.getPermissionsAsync === "function" &&
    typeof candidate.requestPermissionsAsync === "function" &&
    typeof candidate.scheduleNotificationAsync === "function" &&
    typeof candidate.getAllScheduledNotificationsAsync === "function" &&
    typeof candidate.cancelScheduledNotificationAsync === "function" &&
    typeof candidate.addNotificationResponseReceivedListener === "function" &&
    typeof candidate.SchedulableTriggerInputTypes === "object"
  );
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (!notificationsModule) {
    let imported: unknown;
    try {
      imported = await import("expo-notifications");
    } catch (error) {
      if (!notificationsUnavailableWarningShown) {
        console.warn("Membership reminders are unavailable in this app runtime.", error);
        notificationsUnavailableWarningShown = true;
      }
      return null;
    }

    const root = imported as { default?: unknown } | null;
    const defaultExport = root && typeof root === "object" ? root.default : undefined;
    const nestedDefault = defaultExport && typeof defaultExport === "object"
      ? (defaultExport as { default?: unknown }).default
      : undefined;
    const module = [imported, defaultExport, nestedDefault].find(isNotificationsModule);

    if (!module) {
      if (!notificationsUnavailableWarningShown) {
        console.warn("Membership reminders are disabled because this app build does not expose the Expo Notifications API.");
        notificationsUnavailableWarningShown = true;
      }
      return null;
    }
    notificationsModule = module;
    notificationsModule.setNotificationHandler?.({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return notificationsModule;
}

export async function addMembershipNotificationResponseListener(
  listener: (data: Record<string, unknown> | undefined) => void,
): Promise<{ remove?: () => void } | null> {
  if (Platform.OS === "web") return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  if (typeof Notifications.addNotificationResponseReceivedListener !== "function") return null;

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    listener(response.notification.request.content.data);
  });
  return subscription;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;

  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync("membership-alerts", {
    name: "Membership alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F5B700",
  });
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function notificationDate(dateValue: string, offsetDays: number): Date | null {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setDate(date.getDate() + offsetDays);
  date.setHours(ALERT_HOUR, 0, 0, 0);
  return date;
}

async function scheduleMembershipAlert(
  title: string,
  body: string,
  triggerDate: Date,
  memberId?: number,
) {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: {
        scope: NOTIFICATION_SCOPE,
        route: memberId ? "member-details" : "members",
        ...(memberId ? { memberId: String(memberId) } : {}),
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      ...(Platform.OS === "android" ? { channelId: "membership-alerts" } : {}),
    },
  });
}

async function clearScheduledMembershipAlerts() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const membershipAlerts = scheduled.filter(
    (request) => request.content.data?.scope === NOTIFICATION_SCOPE,
  );

  await Promise.all(
    membershipAlerts.map((request) =>
      Notifications.cancelScheduledNotificationAsync(request.identifier),
    ),
  );
}

async function syncGrantedMembershipNotifications(): Promise<void> {
  if (Platform.OS === "web") return;

  const Notifications = await getNotifications();
  if (!Notifications) return;
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;

  await ensureAndroidNotificationChannel();

  await clearScheduledMembershipAlerts();

  const members = db.getAllSync<Member>("SELECT * FROM members ORDER BY id");
  const now = new Date();
  const today = localDateKey(now);
  const expiringSoon: Member[] = [];
  const expired: Member[] = [];

  for (const member of members) {
    const expiryDate = notificationDate(member.end_date, 0);
    const reminderDate = notificationDate(member.end_date, -EXPIRING_SOON_DAYS);
    const expiredDate = notificationDate(member.end_date, 1);
    if (!expiryDate || !reminderDate || !expiredDate) continue;

    const endDay = member.end_date;
    if (endDay < today) {
      expired.push(member);
    } else if (endDay <= localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + EXPIRING_SOON_DAYS))) {
      expiringSoon.push(member);
    }

    if (reminderDate > now && endDay >= today) {
      await scheduleMembershipAlert(
        "Membership expiring soon",
        `${member.name}'s ${member.membership_plan} membership expires on ${member.end_date}.`,
        reminderDate,
        member.id,
      );
    }

    if (expiredDate > now && endDay >= today) {
      await scheduleMembershipAlert(
        "Membership expired",
        `${member.name}'s membership expired on ${member.end_date}.`,
        expiredDate,
        member.id,
      );
    }
  }

  if (expired.length === 0 && expiringSoon.length === 0) return;

  const alertKey = `status-summary:${today}`;
  const alreadySent = db.getFirstSync<{ alert_key: string }>(
    "SELECT alert_key FROM notification_log WHERE alert_key = ?",
    [alertKey],
  );
  if (alreadySent) return;

  const summaryParts = [];
  if (expiringSoon.length > 0) {
    summaryParts.push(`${expiringSoon.length} expiring soon`);
  }
  if (expired.length > 0) {
    summaryParts.push(`${expired.length} expired`);
  }

  await scheduleMembershipAlert(
    "Membership update",
    `${summaryParts.join(", ")}. Tap to review your members.`,
    new Date(Date.now() + 1500),
  );
  db.runSync(
    "INSERT OR IGNORE INTO notification_log (alert_key, created_at) VALUES (?, ?)",
    [alertKey, now.toISOString()],
  );
}

export async function initializeMembershipNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const Notifications = await getNotifications();
  if (!Notifications) return false;
  await ensureAndroidNotificationChannel();
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (!permissions.granted) return false;

  await syncGrantedMembershipNotifications();
  return true;
}

export async function syncMembershipNotifications(): Promise<void> {
  await syncGrantedMembershipNotifications();
}
