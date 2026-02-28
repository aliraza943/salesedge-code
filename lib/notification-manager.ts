import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_MAP_KEY = "ai_planner_notif_map";

// Map of eventId → notificationId
type NotifMap = Record<string, string>;

async function getNotifMap(): Promise<NotifMap> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setNotifMap(map: NotifMap): Promise<void> {
  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
}

/**
 * Configure notification handler — call once at app startup.
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Schedule a local notification for an event.
 */
export async function scheduleEventReminder(
  eventId: string,
  title: string,
  date: string,
  startTime?: string,
  reminderMinutes: number = 15
): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    // Cancel existing notification for this event
    await cancelEventReminder(eventId);

    // Calculate trigger time
    const time = startTime || "09:00";
    const [hours, minutes] = time.split(":").map(Number);
    const eventDate = new Date(date + "T12:00:00");
    eventDate.setHours(hours, minutes, 0, 0);

    const triggerDate = new Date(eventDate.getTime() - reminderMinutes * 60 * 1000);

    // Don't schedule if in the past
    if (triggerDate.getTime() <= Date.now()) return;

    const reminderText =
      reminderMinutes === 0
        ? "Starting now"
        : reminderMinutes < 60
          ? `In ${reminderMinutes} minutes`
          : reminderMinutes === 60
            ? "In 1 hour"
            : reminderMinutes === 1440
              ? "Tomorrow"
              : `In ${Math.round(reminderMinutes / 60)} hours`;

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: reminderText,
        sound: true,
        data: { eventId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    // Save mapping
    const map = await getNotifMap();
    map[eventId] = notifId;
    await setNotifMap(map);
  } catch (err) {
    console.warn("[Notifications] Failed to schedule:", err);
  }
}

/**
 * Cancel a notification for an event.
 */
export async function cancelEventReminder(eventId: string): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const map = await getNotifMap();
    const notifId = map[eventId];
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId);
      delete map[eventId];
      await setNotifMap(map);
    }
  } catch (err) {
    console.warn("[Notifications] Failed to cancel:", err);
  }
}
