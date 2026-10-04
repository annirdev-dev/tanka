import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";

// expo-notifications' own auto push-registration side-effect module throws
// (not just warns) as soon as it's imported when running in Expo Go on
// Android — push support was removed from Expo Go there in SDK 53. Guard the
// import itself with a conditional require so the module never loads in that
// environment; local/foreground notifications still work everywhere else
// (iOS Expo Go, and real dev/production builds on both platforms).
const isExpoGoAndroid =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS === "android";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Notifications: typeof ExpoNotifications | null = isExpoGoAndroid
  ? null
  : require("expo-notifications");

const UNGRANTED: ExpoNotifications.NotificationPermissionsStatus = {
  granted: false,
  canAskAgain: true,
  expires: "never",
  status: "undetermined" as ExpoNotifications.PermissionStatus,
};

export function setNotificationHandler(handler: ExpoNotifications.NotificationHandler | null): void {
  Notifications?.setNotificationHandler(handler);
}

export function requestPermissionsAsync(): Promise<ExpoNotifications.NotificationPermissionsStatus> {
  if (!Notifications) return Promise.resolve(UNGRANTED);
  return Notifications.requestPermissionsAsync();
}

export function getPermissionsAsync(): Promise<ExpoNotifications.NotificationPermissionsStatus> {
  if (!Notifications) return Promise.resolve(UNGRANTED);
  return Notifications.getPermissionsAsync();
}

export function scheduleNotificationAsync(
  request: ExpoNotifications.NotificationRequestInput
): Promise<string | undefined> {
  if (!Notifications) return Promise.resolve(undefined);
  return Notifications.scheduleNotificationAsync(request);
}

// Fires once at a specific future moment — unlike the channel-only trigger
// used for price alerts (which fires immediately), this works even if the
// app is closed the whole time, since it's scheduled at the OS level.
export function scheduleDateNotificationAsync(
  content: ExpoNotifications.NotificationContentInput,
  date: Date,
  channelId?: string
): Promise<string | undefined> {
  if (!Notifications) return Promise.resolve(undefined);
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(channelId ? { channelId } : {}),
    },
  });
}

export function cancelScheduledNotificationAsync(id: string): Promise<void> {
  if (!Notifications) return Promise.resolve();
  return Notifications.cancelScheduledNotificationAsync(id);
}

export function setNotificationChannelAsync(
  channelId: string,
  channel: ExpoNotifications.NotificationChannelInput
): Promise<ExpoNotifications.NotificationChannel | null> {
  if (!Notifications) return Promise.resolve(null);
  return Notifications.setNotificationChannelAsync(channelId, channel);
}

// Only ever resolves to a real token in a build that includes the native
// push module (a rebuilt dev client or a store build) — returns null
// anywhere else, including Expo Go and a stale dev client.
export async function getExpoPushTokenAsync(projectId: string): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
