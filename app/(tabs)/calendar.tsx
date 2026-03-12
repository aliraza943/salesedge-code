import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Text,
  View,
  Pressable,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import type { LocalEvent } from "@/lib/local-store";
import { formatTime, formatTimeRange } from "@/lib/utils";
import { formatDateWithWeekday } from "@/lib/timezone";
import { REMINDER_OPTIONS } from "@/lib/notifications";

/** Allowed reminder values for calendar events (minutes). Picker shows only these. */
const ALLOWED_REMINDER_MINUTES = [0, 15, 30, 45, 60] as const;
const REMINDER_OPTIONS_CALENDAR: { label: string; value: number }[] = [
  { label: "None", value: 0 },
  { label: "15 minutes before", value: 15 },
  { label: "30 minutes before", value: 30 },
  { label: "45 minutes before", value: 45 },
  { label: "60 minutes before", value: 60 },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Allowed minute values for the time picker (60 = top of next hour). */
const TIME_PICKER_MINUTES = [0, 15, 30, 45, 60] as const;

function snapMinuteToPicker(m: number): number {
  if (m <= 7) return 0;
  if (m <= 22) return 15;
  if (m <= 37) return 30;
  if (m <= 52) return 45;
  return 60;
}

/** Parse 24h "HH:MM" to 12h components; if invalid/empty, return current time. Snaps minute to picker options. */
function parseTimeToPicker(timeStr: string): { hour12: number; minute: number; isPM: boolean } {
  const now = new Date();
  if (!timeStr?.trim()) {
    const h = now.getHours();
    const m = now.getMinutes();
    const hour12 = h % 12 || 12;
    return { hour12, minute: snapMinuteToPicker(m), isPM: h >= 12 };
  }
  const parts = timeStr.trim().split(":");
  const hour24 = parseInt(parts[0], 10);
  const minuteRaw = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
  const minute = snapMinuteToPicker(minuteRaw);
  if (isNaN(hour24)) return { hour12: now.getHours() % 12 || 12, minute: snapMinuteToPicker(now.getMinutes()), isPM: now.getHours() >= 12 };
  const h = hour24 % 24;
  const hour12 = h % 12 || 12;
  return { hour12, minute, isPM: h >= 12 };
}

/** Convert 12h picker values to 24h "HH:MM". Minute 60 is treated as next hour :00. */
function pickerToTime24(hour12: number, minute: number, isPM: boolean): string {
  let hour24 = hour12;
  if (isPM && hour12 !== 12) hour24 += 12;
  if (!isPM && hour12 === 12) hour24 = 0;
  let m = minute;
  if (minute === 60) {
    hour24 = (hour24 + 1) % 24;
    m = 0;
  }
  return `${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type DayItem = {
  type: "event";
  id: string;
  title: string;
  subtitle?: string;
  time?: string;
  color: string;
  label: string;
  isFollowUp?: boolean;
  sourceRfpId?: string;
};

export default function CalendarScreen() {
  const colors = useColors();
  const router = useRouter();
  const { events, rfps, refreshAll, createEvent: createEventData, updateEvent: updateEventData, deleteEvent: deleteEventData } = useData();
  const FOLLOW_UP_COLOR = "#F97316"; // Orange for follow-up events
  // Reminder state managed locally with notification-manager
  const [reminderMap, setReminderMap] = useState<Record<string, number>>({});
  const permissionGranted = true; // Simplified — permissions requested in DataProvider
  const requestPermission = async () => true;
  const getReminderMinutes = (eventId: string) => {
    // Check from event data directly
    const ev = events.find(e => e.id === eventId);
    return ev?.reminderMinutes || 0;
  };
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(
    formatDate(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LocalEvent | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartTime, setFormStartTime] = useState("");

  const [formReminder, setFormReminder] = useState<number>(0);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pickerPM, setPickerPM] = useState(true);
  const [formErrors, setFormErrors] = useState<{ title?: string; time?: string; reminder?: string }>({});

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  // Map of date -> event info (for dot indicators with color coding)
  const datesWithItems = useMemo(() => {
    const map: Record<string, { hasEvents: boolean; hasFollowUp: boolean }> = {};
    events.forEach((e) => {
      const isFollowUp = e.sourceType === "follow-up" || e.title.startsWith("Follow up:");
      if (!map[e.date]) map[e.date] = { hasEvents: false, hasFollowUp: false };
      map[e.date].hasEvents = true;
      if (isFollowUp) map[e.date].hasFollowUp = true;
    });
    return map;
  }, [events]);

  // All items for the selected date
  const selectedDayItems = useMemo(() => {
    const items: DayItem[] = [];

    // Events for this date
    const dayEvents = events
      .filter((e) => e.date === selectedDate)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    dayEvents.forEach((e) => {
      const isFollowUp = e.sourceType === "follow-up" || e.title.startsWith("Follow up:");
      items.push({
        type: "event",
        id: e.id,
        title: e.title,
        subtitle: e.description,
        time: e.startTime ? formatTimeRange(e.startTime, e.endTime) : undefined,
        color: isFollowUp ? FOLLOW_UP_COLOR : colors.primary,
        label: isFollowUp ? "Follow-Up" : "Event",
        isFollowUp,
        sourceRfpId: e.sourceRfpId,
      });
    });

    return items;
  }, [events, selectedDate, colors]);

  const navigateMonth = (dir: number) => {
    let m = currentMonth + dir;
    let y = currentYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setCurrentMonth(m);
    setCurrentYear(y);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const calendarDays = useMemo(() => {
    const days: Array<{ day: number; date: string } | null> = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, date: formatDate(currentYear, currentMonth, d) });
    }
    return days;
  }, [currentYear, currentMonth, daysInMonth, firstDay]);

  const openAddModal = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDescription("");
    setFormStartTime("");
    setFormReminder(15);
    setFormErrors({});
    setShowAddModal(true);
  };

  const openEditModal = (event: LocalEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || "");
    setFormStartTime(event.startTime || "");
    const reminder = event.reminderMinutes ?? 0;
    setFormReminder((ALLOWED_REMINDER_MINUTES as readonly number[]).includes(reminder) ? reminder : 15);
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleSave = async () => {
    const title = formTitle.trim();
    const time = formStartTime.trim();
    const errors: { title?: string; time?: string; reminder?: string } = {};
    if (!title) errors.title = "Title cannot be empty.";
    if (!time) errors.time = "Please select a time for the event.";
    if (!(ALLOWED_REMINDER_MINUTES as readonly number[]).includes(formReminder)) {
      errors.reminder = "Please select a reminder.";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setFormErrors({});
    setIsSaving(true);

    try {
      let eventId: string;

      if (editingEvent) {
        await updateEventData(editingEvent.id, {
          title,
          description: formDescription.trim() || undefined,
          startTime: time || undefined,
          reminderMinutes: formReminder > 0 ? formReminder : undefined,
        });
        eventId = editingEvent.id;
      } else {
        const newEvent = await createEventData({
          title,
          description: formDescription.trim() || undefined,
          date: selectedDate,
          startTime: time || undefined,
          reminderMinutes: formReminder > 0 ? formReminder : undefined,
        });
        eventId = newEvent.id;
      }

      await refreshAll();
      setShowAddModal(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Error", "Failed to save event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = (id: string) => {
    const doDelete = async () => {
      await deleteEventData(id);
      await refreshAll();
    };

    if (Platform.OS === "web") {
      doDelete();
    } else {
      Alert.alert("Delete Event", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const selectedReminderLabel = REMINDER_OPTIONS_CALENDAR.find((o) => o.value === formReminder)?.label ?? "None";

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>
          Calendar
        </Text>
        <Pressable
          onPress={openAddModal}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="plus" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Month Navigation */}
        <View className="flex-row items-center justify-between px-5 mb-4">
          <Pressable
            onPress={() => navigateMonth(-1)}
            style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1, backgroundColor: colors.surface }]}
          >
            <IconSymbol name="chevron.left" size={18} color={colors.foreground} />
          </Pressable>
          <Text className="text-lg font-semibold" style={{ color: colors.foreground }}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <Pressable
            onPress={() => navigateMonth(1)}
            style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.6 : 1, backgroundColor: colors.surface }]}
          >
            <IconSymbol name="chevron.right" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Day headers */}
        <View className="flex-row px-3 mb-2">
          {DAYS.map((d) => (
            <View key={d} className="flex-1 items-center">
              <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                {d}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View className="flex-row flex-wrap px-3 mb-6">
          {calendarDays.map((item, idx) => {
            if (!item) {
              return <View key={`empty-${idx}`} style={styles.dayCell} />;
            }
            const isToday = item.date === todayStr;
            const isSelected = item.date === selectedDate;
            const dateInfo = datesWithItems[item.date];
            const hasAny = dateInfo?.hasEvents;

            return (
              <Pressable
                key={item.date}
                onPress={() => {
                  setSelectedDate(item.date);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => [
                  styles.dayCell,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View
                  className="w-9 h-9 rounded-full items-center justify-center"
                  style={[
                    isSelected && { backgroundColor: colors.primary },
                    isToday && !isSelected && { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Text
                    className="text-sm"
                    style={{
                      color: isSelected ? "#FFFFFF" : isToday ? colors.primary : colors.foreground,
                      fontWeight: isToday || isSelected ? "600" : "400",
                    }}
                  >
                    {item.day}
                  </Text>
                </View>
                {/* Dot indicator for events */}
                {hasAny && (
                  <View className="flex-row items-center gap-0.5 mt-0.5">
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dateInfo?.hasFollowUp ? FOLLOW_UP_COLOR : colors.primary }} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Selected Date - All Items */}
        <View className="px-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
              {selectedDate === todayStr ? "Today" : formatDateWithWeekday(selectedDate)}
            </Text>
            <Text className="text-sm" style={{ color: colors.muted }}>
              {selectedDayItems.length} item{selectedDayItems.length !== 1 ? "s" : ""}
            </Text>
          </View>



          {selectedDayItems.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-sm" style={{ color: colors.muted }}>
                Nothing planned for this day
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.muted }}>
                Tap + to add an event, or use AI Chat to schedule
              </Text>
            </View>
          ) : (
            selectedDayItems.map((item) => {
              const isEvent = item.type === "event";
              const reminderMin = isEvent ? getReminderMinutes(item.id) : 0;
              const reminderLabel = reminderMin > 0
                ? REMINDER_OPTIONS.find((o) => o.value === reminderMin)?.label || `${reminderMin}m`
                : null;

              return (
                <Pressable
                  key={`${item.type}-${item.id}`}
                  onPress={() => {
                    if (isEvent) {
                      if (item.isFollowUp) {
                        // Navigate to RFPs tab for follow-up events
                        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push("/(tabs)/rfps");
                      } else {
                        const ev = events.find((e) => e.id === item.id);
                        if (ev) openEditModal(ev);
                      }
                    }
                  }}
                  style={({ pressed }) => [
                    styles.itemCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View className="w-1 rounded-full self-stretch mr-3" style={{ backgroundColor: item.color }} />
                  <View className="flex-1">
                    <View className="flex-row items-center mb-0.5">
                      <View
                        className="px-2 py-0.5 rounded-full mr-2"
                        style={{ backgroundColor: item.color + "18" }}
                      >
                        <Text className="text-[10px] font-semibold" style={{ color: item.color }}>
                          {item.label}
                        </Text>
                      </View>
                      {item.time && (
                        <Text className="text-xs" style={{ color: colors.muted }}>
                          {item.time}
                        </Text>
                      )}
                    </View>
                    <Text className="text-[15px] font-semibold" style={{ color: colors.foreground }}>
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text className="text-sm mt-0.5" style={{ color: colors.muted }} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    )}
                    {reminderLabel && (
                      <View className="flex-row items-center mt-1.5">
                        <IconSymbol name="bell.fill" size={12} color={colors.primary} />
                        <Text className="text-xs ml-1" style={{ color: colors.primary }}>
                          {reminderLabel}
                        </Text>
                      </View>
                    )}
                    {item.isFollowUp && (
                      <View className="flex-row items-center mt-1.5">
                        <IconSymbol name="doc.text.fill" size={12} color={FOLLOW_UP_COLOR} />
                        <Text className="text-xs ml-1 font-medium" style={{ color: FOLLOW_UP_COLOR }}>
                          Tap to view RFP
                        </Text>
                      </View>
                    )}
                  </View>
                  {isEvent && (
                    <Pressable
                      onPress={() => handleDeleteEvent(item.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.5 : 0.6, padding: 4 }]}
                    >
                      <IconSymbol name="trash.fill" size={18} color={colors.error} />
                    </Pressable>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Event Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <View
              className="rounded-t-3xl px-5 pt-5 pb-10"
              style={{ backgroundColor: colors.background }}
            >
              <View className="flex-row items-center justify-between mb-5">
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  activeOpacity={0.6}
                  disabled={isSaving}
                >
                  <Text className="text-base" style={{ color: isSaving ? colors.muted + "80" : colors.muted }}>Cancel</Text>
                </TouchableOpacity>
                <Text className="text-lg font-semibold" style={{ color: colors.foreground }}>
                  {editingEvent ? "Edit Event" : "New Event"}
                </Text>
                <TouchableOpacity
                  onPress={handleSave}
                  activeOpacity={0.6}
                  disabled={isSaving}
                  style={{ minWidth: 44, alignItems: "flex-end" }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text className="text-base font-semibold" style={{ color: colors.primary }}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                <View className="gap-4">
                  <View>
                    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.muted }}>Title</Text>
                    <TextInput
                      className="rounded-xl px-4 py-3 text-[15px] border"
                      style={{
                        borderColor: formErrors.title ? colors.error : colors.border,
                        borderWidth: formErrors.title ? 1.5 : 1,
                        backgroundColor: colors.surface,
                        color: colors.foreground,
                      }}
                      placeholder="Event title"
                      placeholderTextColor={colors.muted}
                      value={formTitle}
                      onChangeText={(text) => {
                        setFormTitle(text);
                        if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: undefined }));
                      }}
                    />
                    {formErrors.title ? (
                      <Text className="text-sm mt-1" style={{ color: colors.error }}>
                        {formErrors.title}
                      </Text>
                    ) : null}
                  </View>
                  <View>
                    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.muted }}>Description</Text>
                    <TextInput
                      className="rounded-xl px-4 py-3 text-[15px] border"
                      style={{ borderColor: colors.border, backgroundColor: colors.surface, color: colors.foreground }}
                      placeholder="Optional description"
                      placeholderTextColor={colors.muted}
                      value={formDescription}
                      onChangeText={setFormDescription}
                      multiline
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.muted }}>Time</Text>
                    <Pressable
                      onPress={() => {
                        const { hour12, minute, isPM } = parseTimeToPicker(formStartTime);
                        setPickerHour(hour12);
                        setPickerMinute(minute);
                        setPickerPM(isPM);
                        setShowTimePicker(true);
                      }}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderWidth: formErrors.time ? 1.5 : 1,
                          borderColor: formErrors.time ? colors.error : colors.border,
                          backgroundColor: colors.surface,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Text
                        className="text-[15px]"
                        style={{ color: formStartTime.trim() ? colors.foreground : colors.muted }}
                      >
                        {formStartTime.trim() ? formatTime(formStartTime) : "Select time"}
                      </Text>
                      <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                    </Pressable>
                    {formErrors.time ? (
                      <Text className="text-sm mt-1" style={{ color: colors.error }}>
                        {formErrors.time}
                      </Text>
                    ) : null}
                  </View>

                  {/* Reminder Picker */}
                  <View>
                    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.muted }}>Reminder</Text>
                    <Pressable
                      onPress={() => setShowReminderPicker(true)}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderWidth: formErrors.reminder ? 1.5 : 1,
                          borderColor: formErrors.reminder ? colors.error : colors.border,
                          backgroundColor: colors.surface,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <View className="flex-row items-center">
                        <IconSymbol name="bell.fill" size={18} color={formReminder > 0 ? colors.primary : colors.muted} />
                        <Text
                          className="text-[15px] ml-2"
                          style={{ color: formReminder > 0 ? colors.foreground : colors.muted }}
                        >
                          {selectedReminderLabel}
                        </Text>
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                    </Pressable>
                    {formErrors.reminder ? (
                      <Text className="text-sm mt-1" style={{ color: colors.error }}>
                        {formErrors.reminder}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </ScrollView>

              {/* Time Picker overlay (inside Add Modal so it shows on top) */}
              {showTimePicker && (
                <Pressable
                  style={[
                    StyleSheet.absoluteFill,
                    { justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
                  ]}
                  onPress={() => setShowTimePicker(false)}
                >
                  <Pressable
                    style={[
                      styles.timePickerSheet,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => { }}
                  >
                    <View style={styles.timePickerHeader}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowTimePicker(false);
                          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Text className="text-base" style={{ color: colors.muted }}>Cancel</Text>
                      </TouchableOpacity>
                      <Text className="text-lg font-semibold" style={{ color: colors.foreground }}>
                        Set time
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setFormStartTime(pickerToTime24(pickerHour, pickerMinute, pickerPM));
                          setFormErrors((prev) => ({ ...prev, time: undefined }));
                          setShowTimePicker(false);
                          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Text className="text-base font-semibold" style={{ color: colors.primary }}>Done</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.timePickerPreview}>
                      <Text className="text-2xl font-medium tabular-nums" style={{ color: colors.foreground }}>
                        {pickerHour}:{String(pickerMinute).padStart(2, "0")} {pickerPM ? "PM" : "AM"}
                      </Text>
                    </View>

                    <View style={styles.timePickerRow}>
                      <View style={styles.timePickerColumn}>
                        <Text className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Hour</Text>
                        <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                            const isSelected = pickerHour === h;
                            return (
                              <Pressable
                                key={h}
                                onPress={() => {
                                  setPickerHour(h);
                                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                style={[
                                  styles.timePickerOption,
                                  isSelected && { backgroundColor: colors.primary + "18" },
                                ]}
                              >
                                <Text
                                  className="text-[15px]"
                                  style={{
                                    color: isSelected ? colors.primary : colors.foreground,
                                    fontWeight: isSelected ? "600" : "400",
                                  }}
                                >
                                  {h}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                      <View style={styles.timePickerColumn}>
                        <Text className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Minute</Text>
                        <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                          {TIME_PICKER_MINUTES.map((m) => {
                            const isSelected = pickerMinute === m;
                            const label = m === 60 ? "60" : String(m).padStart(2, "0");
                            return (
                              <Pressable
                                key={m}
                                onPress={() => {
                                  setPickerMinute(m);
                                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                style={[
                                  styles.timePickerOption,
                                  isSelected && { backgroundColor: colors.primary + "18" },
                                ]}
                              >
                                <Text
                                  className="text-[15px] tabular-nums"
                                  style={{
                                    color: isSelected ? colors.primary : colors.foreground,
                                    fontWeight: isSelected ? "600" : "400",
                                  }}
                                >
                                  {label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                      <View style={styles.timePickerColumnPeriod}>
                        <Text className="text-xs font-medium mb-2" style={{ color: colors.muted }}>Period</Text>
                        <View style={{ gap: 8 }}>
                          <Pressable
                            onPress={() => {
                              setPickerPM(false);
                              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={[
                              styles.timePickerPeriodOption,
                              !pickerPM && { backgroundColor: colors.primary + "18" },
                            ]}
                          >
                            <Text
                              className="text-[15px] font-medium"
                              style={{
                                color: !pickerPM ? colors.primary : colors.foreground,
                                fontWeight: !pickerPM ? "600" : "400",
                              }}
                            >
                              AM
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setPickerPM(true);
                              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={[
                              styles.timePickerPeriodOption,
                              pickerPM && { backgroundColor: colors.primary + "18" },
                            ]}
                          >
                            <Text
                              className="text-[15px] font-medium"
                              style={{
                                color: pickerPM ? colors.primary : colors.foreground,
                                fontWeight: pickerPM ? "600" : "400",
                              }}
                            >
                              PM
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Pressable>
              )}

              {/* Reminder Picker overlay (inside Add Modal so it shows on top) */}
              {showReminderPicker && (
                <Pressable
                  style={[
                    StyleSheet.absoluteFill,
                    { justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
                  ]}
                  onPress={() => setShowReminderPicker(false)}
                >
                  <Pressable
                    style={[
                      styles.timePickerSheet,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => { }}
                  >
                    <View style={styles.timePickerHeader}>
                      <TouchableOpacity
                        onPress={() => setShowReminderPicker(false)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Text className="text-base" style={{ color: colors.muted }}>Cancel</Text>
                      </TouchableOpacity>
                      <Text className="text-lg font-semibold" style={{ color: colors.foreground }}>
                        Set Reminder
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowReminderPicker(false)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <Text className="text-base font-semibold" style={{ color: colors.primary }}>Done</Text>
                      </TouchableOpacity>
                    </View>

                    {!permissionGranted && Platform.OS !== "web" && (
                      <Pressable
                        onPress={requestPermission}
                        style={({ pressed }) => [
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: colors.warning + "15",
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 12,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <IconSymbol name="bell.fill" size={18} color={colors.warning} />
                        <Text className="text-sm ml-2 flex-1" style={{ color: colors.warning }}>
                          Tap to enable notification permissions
                        </Text>
                      </Pressable>
                    )}

                    <View className="gap-1">
                      {REMINDER_OPTIONS_CALENDAR.map((option) => {
                        const isSelected = formReminder === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => {
                              setFormReminder(option.value);
                              setFormErrors((prev) => ({ ...prev, reminder: undefined }));
                              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setShowReminderPicker(false);
                            }}
                            style={({ pressed }) => [
                              {
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingVertical: 14,
                                paddingHorizontal: 16,
                                borderRadius: 12,
                                backgroundColor: isSelected ? colors.primary + "12" : "transparent",
                                opacity: pressed ? 0.7 : 1,
                              },
                            ]}
                          >
                            <Text
                              className="text-[15px]"
                              style={{
                                color: isSelected ? colors.primary : colors.foreground,
                                fontWeight: isSelected ? "600" : "400",
                              }}
                            >
                              {option.label}
                            </Text>
                            {isSelected && (
                              <IconSymbol name="checkmark" size={18} color={colors.primary} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </Pressable>
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  timePickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  timePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    minHeight: 44,
  },
  timePickerPreview: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 12,
  },
  timePickerRow: {
    flexDirection: "row",
    gap: 16,
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerColumnPeriod: {
    width: 72,
  },
  timePickerScroll: {
    maxHeight: 180,
  },
  timePickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  timePickerPeriodOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
  },
});
