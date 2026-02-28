import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Reminder options in minutes before event
export const REMINDER_OPTIONS = [
  { label: "None", value: 0 },
  { label: "At time of event", value: 1 },
  { label: "5 minutes before", value: 5 },
  { label: "15 minutes before", value: 15 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "2 hours before", value: 120 },
  { label: "1 day before", value: 1440 },
] as const;

export type ReminderMinutes = (typeof REMINDER_OPTIONS)[number]["value"];

/**
 * Configure notification handler for foreground display
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Event Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

/**
 * Schedule a local notification for an event
 * Returns the notification identifier (used to cancel later)
 */
export async function scheduleEventReminder(params: {
  eventId: number;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  reminderMinutes: number;
}): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (params.reminderMinutes <= 0) return null;

  try {
    // Build the event datetime
    const timeStr = params.startTime || "09:00";
    const [hours, minutes] = timeStr.split(":").map(Number);
    const eventDate = new Date(`${params.date}T${timeStr}:00`);

    if (isNaN(eventDate.getTime())) return null;

    // Subtract reminder minutes
    const triggerDate = new Date(eventDate.getTime() - params.reminderMinutes * 60 * 1000);

    // Don't schedule if the trigger time is in the past
    if (triggerDate.getTime() <= Date.now()) return null;

    const bodyParts: string[] = [];
    if (params.startTime) bodyParts.push(`at ${params.startTime}`);
    if (params.description) bodyParts.push(params.description);

    const reminderLabel = REMINDER_OPTIONS.find((o) => o.value === params.reminderMinutes)?.label || `${params.reminderMinutes} min before`;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Reminder: ${params.title}`,
        body: bodyParts.length > 0 ? bodyParts.join(" — ") : `Event on ${params.date}`,
        subtitle: reminderLabel,
        data: { eventId: params.eventId, type: "event_reminder" },
        sound: "default",
        ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error("Failed to schedule notification:", error);
    return null;
  }
}

/**
 * Cancel a scheduled notification by its identifier
 */
export async function cancelEventReminder(notificationId: string | null) {
  if (!notificationId || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error("Failed to cancel notification:", error);
  }
}

/**
 * Cancel all scheduled notifications (useful for cleanup)
 */
export async function cancelAllReminders() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Failed to cancel all notifications:", error);
  }
}

/**
 * Get all currently scheduled notifications
 */
export async function getScheduledReminders() {
  if (Platform.OS === "web") return [];
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return [];
  }
}
