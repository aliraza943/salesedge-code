import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import { formatTime, formatTimeRange } from "@/lib/utils";
import { getLocalTodayStr, parseLocalDate, formatDateShortTz } from "@/lib/timezone";

function formatCurrency(value: string | null | undefined) {
  if (!value) return "$0";
  const num = parseFloat(value);
  if (isNaN(num)) return "$0";
  if (num >= 1000000) return "$" + (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return "$" + (num / 1000).toFixed(0) + "K";
  return "$" + num.toFixed(0);
}

function getWeekDates(offset: number = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + offset * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    dates,
    startStr: startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz }),
    endStr: endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz }),
  };
}

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayItem = {
  type: "event" | "rfp_deadline" | "deal_closing" | "follow_up";
  id: string;
  title: string;
  subtitle?: string;
  time?: string;
  color: string;
  label: string;
  icon: "calendar" | "doc.text.fill" | "chart.line.uptrend.xyaxis" | "bell.fill";
};

export default function WeeklySummaryScreen() {
  const colors = useColors();
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);

  const { events, rfps, deals, refreshAll } = useData();

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  const week = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  // Build day-by-day items
  const dayByDay = useMemo(() => {
    const result: Array<{ date: string; dayName: string; shortDate: string; isToday: boolean; isPast: boolean; items: DayItem[] }> = [];

    week.dates.forEach((date, idx) => {
      const items: DayItem[] = [];

      // Events for this date
      const dayEvents = events
        .filter((e) => e.date === date)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

      dayEvents.forEach((e) => {
        const isFollowUp =
          e.title.toLowerCase().includes("follow up") ||
          e.title.toLowerCase().includes("follow-up") ||
          e.title.toLowerCase().includes("followup") ||
          e.title.toLowerCase().includes("reminder");

        items.push({
          type: isFollowUp ? "follow_up" : "event",
          id: e.id,
          title: e.title,
          subtitle: e.description,
          time: e.startTime ? formatTimeRange(e.startTime, e.endTime) : undefined,
          color: isFollowUp ? colors.success : colors.primary,
          label: isFollowUp ? "Follow-up" : "Meeting",
          icon: isFollowUp ? "bell.fill" : "calendar",
        });
      });

      // RFP deadlines on this date
      const dayRfps = rfps.filter((r) => r.effectiveDate === date && r.status !== "sold");
      dayRfps.forEach((r) => {
        items.push({
          type: "rfp_deadline",
          id: r.id,
          title: r.title,
          subtitle: `${r.client}${r.premium ? ` • ${formatCurrency(r.premium)}` : ""}`,
          color: colors.warning,
          label: "RFP Effective",
          icon: "doc.text.fill",
        });
      });

      // Deals closing on this date
      const dayDeals = deals.filter((d) => d.expectedCloseDate === date && d.stage !== "closed_won" && d.stage !== "closed_lost");
      dayDeals.forEach((d) => {
        items.push({
          type: "deal_closing",
          id: d.id,
          title: d.title,
          subtitle: `${d.client}${d.value ? ` • ${formatCurrency(d.value)}` : ""}`,
          color: "#F97316",
          label: "Deal Closing",
          icon: "chart.line.uptrend.xyaxis",
        });
      });

      const dateObj = new Date(date + "T12:00:00");
      result.push({
        date,
        dayName: DAY_NAMES[idx],
        shortDate: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isToday: date === todayStr,
        isPast: date < todayStr,
        items,
      });
    });

    return result;
  }, [events, rfps, deals, week.dates, todayStr, colors]);

  // Summary stats
  const summary = useMemo(() => {
    let totalMeetings = 0;
    let totalFollowUps = 0;
    let totalRfpDeadlines = 0;
    let totalDealsClosing = 0;
    let totalPipelineValue = 0;
    let busiestDay = "";
    let busiestDayCount = 0;

    dayByDay.forEach((day) => {
      let dayTotal = 0;
      day.items.forEach((item) => {
        if (item.type === "event") { totalMeetings++; dayTotal++; }
        if (item.type === "follow_up") { totalFollowUps++; dayTotal++; }
        if (item.type === "rfp_deadline") { totalRfpDeadlines++; dayTotal++; }
        if (item.type === "deal_closing") { totalDealsClosing++; dayTotal++; }
      });
      if (dayTotal > busiestDayCount) {
        busiestDayCount = dayTotal;
        busiestDay = day.dayName;
      }
    });

    // Pipeline value from deals closing this week
    deals.forEach((d) => {
      if (d.expectedCloseDate && week.dates.includes(d.expectedCloseDate) && d.stage !== "closed_won" && d.stage !== "closed_lost" && d.value) {
        totalPipelineValue += parseFloat(d.value) || 0;
      }
    });

    const totalItems = totalMeetings + totalFollowUps + totalRfpDeadlines + totalDealsClosing;

    return { totalMeetings, totalFollowUps, totalRfpDeadlines, totalDealsClosing, totalPipelineValue, busiestDay, busiestDayCount, totalItems };
  }, [dayByDay, deals, week.dates]);

  const navigateWeek = (dir: number) => {
    setWeekOffset((prev) => prev + dir);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.primary} />
        </Pressable>
        <View className="items-center">
          <Text className="text-xl font-bold" style={{ color: colors.foreground }}>
            Weekly Overview
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Week Navigation */}
      <View className="flex-row items-center justify-between px-5 mb-4">
        <Pressable
          onPress={() => navigateWeek(-1)}
          style={({ pressed }) => [styles.weekNav, { opacity: pressed ? 0.6 : 1, backgroundColor: colors.surface }]}
        >
          <IconSymbol name="chevron.left" size={16} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => { setWeekOffset(0); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <Text className="text-sm font-semibold" style={{ color: weekOffset === 0 ? colors.primary : colors.foreground }}>
            {weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Next Week" : weekOffset === -1 ? "Last Week" : `${week.startStr} — ${week.endStr}`}
          </Text>
          <Text className="text-xs text-center" style={{ color: colors.muted }}>
            {week.startStr} — {week.endStr}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => navigateWeek(1)}
          style={({ pressed }) => [styles.weekNav, { opacity: pressed ? 0.6 : 1, backgroundColor: colors.surface }]}
        >
          <IconSymbol name="chevron.right" size={16} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Summary Banner */}
        <View className="mx-5 mb-5 rounded-2xl p-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-lg font-bold mb-1" style={{ color: "#FFFFFF" }}>
            Week at a Glance
          </Text>
          {summary.totalItems === 0 ? (
            <Text className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              Nothing scheduled this week. Use AI Chat to plan your week!
            </Text>
          ) : (
            <>
              <Text className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.85)" }}>
                You have {summary.totalItems} item{summary.totalItems !== 1 ? "s" : ""} this week
                {summary.busiestDay ? ` — ${summary.busiestDay} is your busiest day with ${summary.busiestDayCount} item${summary.busiestDayCount !== 1 ? "s" : ""}` : ""}.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {summary.totalMeetings > 0 && (
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "rgba(255,255,255,0.9)" }} />
                    <Text className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                      {summary.totalMeetings} Meeting{summary.totalMeetings !== 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
                {summary.totalFollowUps > 0 && (
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "rgba(255,255,255,0.9)" }} />
                    <Text className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                      {summary.totalFollowUps} Follow-up{summary.totalFollowUps !== 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
                {summary.totalRfpDeadlines > 0 && (
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "rgba(255,255,255,0.9)" }} />
                    <Text className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                      {summary.totalRfpDeadlines} RFP Deadline{summary.totalRfpDeadlines !== 1 ? "s" : ""}
                    </Text>
                  </View>
                )}
                {summary.totalDealsClosing > 0 && (
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "rgba(255,255,255,0.9)" }} />
                    <Text className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                      {summary.totalDealsClosing} Deal{summary.totalDealsClosing !== 1 ? "s" : ""} Closing
                    </Text>
                  </View>
                )}
                {summary.totalPipelineValue > 0 && (
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: "rgba(255,255,255,0.9)" }} />
                    <Text className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                      {formatCurrency(String(summary.totalPipelineValue))} Pipeline
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Day-by-Day Breakdown */}
        {dayByDay.map((day) => (
          <View key={day.date} className="mb-1">
            {/* Day Header */}
            <View
              className="flex-row items-center px-5 py-2.5"
              style={{ backgroundColor: day.isToday ? colors.primary + "08" : "transparent" }}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: day.isToday ? colors.primary : day.isPast ? colors.muted + "20" : colors.surface }}
              >
                <Text className="text-xs font-bold" style={{ color: day.isToday ? "#FFFFFF" : day.isPast ? colors.muted : colors.foreground }}>
                  {DAY_NAMES_SHORT[new Date(day.date + "T12:00:00").getDay()]}
                </Text>
                <Text className="text-[10px]" style={{ color: day.isToday ? "rgba(255,255,255,0.8)" : colors.muted }}>
                  {day.shortDate.split(" ")[1]}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-base font-semibold"
                  style={{ color: day.isToday ? colors.primary : day.isPast ? colors.muted : colors.foreground }}
                >
                  {day.dayName}{day.isToday ? " (Today)" : ""}
                </Text>
                <Text className="text-xs" style={{ color: colors.muted }}>
                  {day.items.length === 0 ? "Nothing planned" : `${day.items.length} item${day.items.length !== 1 ? "s" : ""}`}
                </Text>
              </View>
            </View>

            {/* Day Items */}
            {day.items.length > 0 && (
              <View className="px-5 pb-2">
                {day.items.map((item) => (
                  <View
                    key={`${item.type}-${item.id}`}
                    className="flex-row items-center ml-5 pl-4 py-2.5 border-l-2"
                    style={{ borderColor: item.color }}
                  >
                    <View
                      className="w-7 h-7 rounded-lg items-center justify-center mr-3"
                      style={{ backgroundColor: item.color + "15" }}
                    >
                      <IconSymbol name={item.icon as any} size={14} color={item.color} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <View className="px-1.5 py-0.5 rounded mr-2" style={{ backgroundColor: item.color + "15" }}>
                          <Text className="text-[9px] font-bold" style={{ color: item.color }}>
                            {item.label.toUpperCase()}
                          </Text>
                        </View>
                        {item.time && (
                          <Text className="text-xs" style={{ color: colors.muted }}>{item.time}</Text>
                        )}
                      </View>
                      <Text
                        className="text-[14px] font-medium mt-0.5"
                        style={{ color: day.isPast ? colors.muted : colors.foreground }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {item.subtitle && (
                        <Text className="text-xs mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Divider */}
            <View className="mx-5 h-px" style={{ backgroundColor: colors.border + "60" }} />
          </View>
        ))}

        {/* Quick Actions */}
        <View className="px-5 mt-4 mb-6">
          <Pressable
            onPress={() => router.push("/(tabs)/chat")}
            style={({ pressed }) => [
              styles.quickAction,
              {
                backgroundColor: colors.primary + "10",
                borderColor: colors.primary + "30",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <IconSymbol name="mic.fill" size={20} color={colors.primary} />
            <Text className="text-sm font-semibold ml-2" style={{ color: colors.primary }}>
              Talk to AI to plan your week
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  weekNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
  },
});
