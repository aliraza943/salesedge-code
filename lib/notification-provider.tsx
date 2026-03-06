import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  setupNotificationHandler,
  requestNotificationPermissions,
  scheduleEventReminder,
  cancelEventReminder,
} from "./notifications";

const STORAGE_KEY = "@ai_planner_reminders";

type ReminderMap = Record<string, { notificationId: string; reminderMinutes: number }>;

type NotificationContextType = {
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  setReminder: (params: {
    eventId: string | number;
    title: string;
    description?: string;
    date: string;
    startTime?: string;
    reminderMinutes: number;
  }) => Promise<void>;
  removeReminder: (eventId: string | number) => Promise<void>;
  getReminderMinutes: (eventId: string | number) => number;
};

const NotificationContext = createContext<NotificationContextType>({
  permissionGranted: false,
  requestPermission: async () => false,
  setReminder: async () => {},
  removeReminder: async () => {},
  getReminderMinutes: () => 0,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [reminders, setReminders] = useState<ReminderMap>({});
  const loadedRef = useRef(false);

  // Use refs to avoid stale closures in callbacks without adding state to deps
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  const permissionRef = useRef(permissionGranted);
  permissionRef.current = permissionGranted;

  // Setup notification handler on mount
  useEffect(() => {
    if (Platform.OS !== "web") {
      setupNotificationHandler();
    }
  }, []);

  // Load saved reminders from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setReminders(JSON.parse(stored));
        }
      } catch {}
      loadedRef.current = true;
    })();
  }, []);

  // Save reminders whenever they change
  useEffect(() => {
    if (!loadedRef.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders)).catch(() => {});
  }, [reminders]);

  // Check existing permission on mount and proactively request if not granted
  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
      } else {
        // Proactively request permission on first launch
        const granted = await requestNotificationPermissions();
        setPermissionGranted(granted);
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermissions();
    setPermissionGranted(granted);
    return granted;
  }, []);

  const setReminder = useCallback(
    async (params: {
      eventId: string | number;
      title: string;
      description?: string;
      date: string;
      startTime?: string;
      reminderMinutes: number;
    }) => {
      const key = String(params.eventId);
      // Cancel existing reminder for this event if any (use ref for current value)
      const existing = remindersRef.current[key];
      if (existing) {
        await cancelEventReminder(existing.notificationId);
      }

      if (params.reminderMinutes <= 0) {
        // Remove reminder
        setReminders((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return;
      }

      // Request permission if not granted
      if (!permissionRef.current) {
        const granted = await requestNotificationPermissions();
        setPermissionGranted(granted);
        if (!granted) return;
      }

      const notificationId = await scheduleEventReminder({
        ...params,
        eventId: typeof params.eventId === "string" ? 0 : params.eventId,
      });
      if (notificationId) {
        setReminders((prev) => ({
          ...prev,
          [key]: { notificationId, reminderMinutes: params.reminderMinutes },
        }));
      }
    },
    []
  );

  const removeReminder = useCallback(
    async (eventId: string | number) => {
      const key = String(eventId);
      const existing = remindersRef.current[key];
      if (existing) {
        await cancelEventReminder(existing.notificationId);
        setReminders((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    []
  );

  const getReminderMinutes = useCallback(
    (eventId: string | number) => {
      return remindersRef.current[String(eventId)]?.reminderMinutes || 0;
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      permissionGranted,
      requestPermission,
      setReminder,
      removeReminder,
      getReminderMinutes,
    }),
    [permissionGranted, requestPermission, setReminder, removeReminder, getReminderMinutes]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}
