import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View, Pressable, TouchableOpacity, StyleSheet, Platform, Linking, Alert, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useData } from "@/lib/data-provider";
import { getGreeting, getTodayStr, formatTime, formatTimeRange, formatCurrency, formatCurrencyLarge, countWorkDays, daysUntil } from "@/lib/utils";
import { parseLocalDate, formatDateShortTz } from "@/lib/timezone";
import { generateAttackPlanHTML } from "@/lib/pdf-html";
import { getApiBaseUrl } from "@/constants/oauth";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth({ autoFetch: true });
  const { events, rfps, deals, isLoading, refreshAll, salesGoal, updateSalesGoal, isCloudMode, isSyncing, syncLocalToCloud, rfpFieldLabels } = useData();
  const [exporting, setExporting] = useState<string | null>(null);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [editCurrentSales, setEditCurrentSales] = useState("");
  const [editGoalAmount, setEditGoalAmount] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [goalFormErrors, setGoalFormErrors] = useState<{ currentSales?: string; goalAmount?: string; deadline?: string }>({});

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  const today = getTodayStr();

  const todayEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === today)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [events, today]
  );

  const activeRfps = useMemo(() => rfps.filter((r) => r.status !== "sold"), [rfps]);
  const openDeals = useMemo(
    () => deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost"),
    [deals]
  );
  const pipelineValue = useMemo(
    () => rfps
      .filter((r) => r.status === "draft" || r.status === "recommended")
      .reduce((sum, r) => sum + (parseFloat((r.premium || "0").replace(/[^0-9.-]/g, "")) || 0), 0),
    [rfps]
  );

  // ─── Sales Goal Calculations ────────────────────────
  const salesCalc = useMemo(() => {
    const remaining = Math.max(0, salesGoal.goalAmount - salesGoal.currentSales);
    const todayDate = new Date();
    const deadline = new Date(salesGoal.goalDeadline + "T23:59:59");
    const workDaysLeft = countWorkDays(todayDate, deadline);
    const dailyTarget = workDaysLeft > 0 ? remaining / workDaysLeft : 0;
    const progressPct = salesGoal.goalAmount > 0
      ? Math.min(100, (salesGoal.currentSales / salesGoal.goalAmount) * 100)
      : 0;
    return { remaining, workDaysLeft, dailyTarget, progressPct };
  }, [salesGoal]);

  // ─── Overdue Follow-Ups ─────────────────────────────
  const overdueFollowUps = useMemo(() => {
    return activeRfps
      .filter((r) => {
        if (!r.followUpDate) return false;
        const d = daysUntil(r.followUpDate);
        return d < 0; // past due
      })
      .map((r) => ({
        id: r.id,
        title: r.title,
        client: r.client,
        followUpDate: r.followUpDate!,
        daysOverdue: Math.abs(daysUntil(r.followUpDate!)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [activeRfps]);

  const urgentItems = useMemo(() => {
    const items: Array<{ label: string; title: string; days: number; color: string }> = [];
    activeRfps.forEach((r) => {
      if (r.effectiveDate) {
        const d = daysUntil(r.effectiveDate);
        if (d >= 0 && d <= 14) {
          items.push({ label: "RFP", title: r.title, days: d, color: colors.warning });
        }
      }
    });
    openDeals.forEach((d) => {
      if (d.expectedCloseDate) {
        const days = daysUntil(d.expectedCloseDate);
        if (days >= 0 && days <= 14) {
          items.push({ label: "Deal", title: d.title, days, color: colors.primary });
        }
      }
    });
    return items.sort((a, b) => a.days - b.days).slice(0, 5);
  }, [activeRfps, openDeals, colors]);

  // ─── Export Handlers ────────────────────────────────

  const handleAttackPlan = useCallback(async () => {
    setExporting("pdf");
    try {
      const html = generateAttackPlanHTML({ events, rfps, deals, date: today });
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/attack-plan-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const data = await res.json();
      if (data.url) {
        if (Platform.OS === "web") {
          window.open(data.url, "_blank");
        } else {
          await Linking.openURL(data.url);
        }
      }
    } catch (err) {
      Alert.alert("Error", "Failed to generate attack plan. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [events, rfps, deals, today]);

  const handleExcelExport = useCallback(async (type: "rfps" | "schedule") => {
    setExporting(type);
    try {
      const baseUrl = getApiBaseUrl();
      const endpoint = type === "rfps" ? "/api/export/rfps" : "/api/export/schedule";
      const body =
        type === "rfps"
          ? { rfps, labels: rfpFieldLabels }
          : { events };
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.url) {
        if (Platform.OS === "web") {
          window.open(data.url, "_blank");
        } else {
          await Linking.openURL(data.url);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to export. Please try again.");
    } finally {
      setExporting(null);
    }
  }, [rfps, events, rfpFieldLabels]);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openEditGoalModal = () => {
    setEditCurrentSales(String(salesGoal.currentSales));
    setEditGoalAmount(String(salesGoal.goalAmount));
    setEditDeadline(salesGoal.goalDeadline);
    setGoalFormErrors({});
    setShowEditGoal(true);
  };

  const handleSaveGoal = async () => {
    const currentStr = editCurrentSales.trim();
    const goalStr = editGoalAmount.trim();
    const deadlineStr = editDeadline.trim();
    const errors: { currentSales?: string; goalAmount?: string; deadline?: string } = {};

    const current = currentStr === "" ? NaN : parseFloat(currentStr.replace(/[^0-9.-]/g, ""));
    if (currentStr === "") errors.currentSales = "Current sales is required.";
    else if (isNaN(current) || current < 0) errors.currentSales = "Must be a number ≥ 0.";

    const goal = goalStr === "" ? NaN : parseFloat(goalStr.replace(/[^0-9.-]/g, ""));
    if (goalStr === "") errors.goalAmount = "Sales goal is required.";
    else if (isNaN(goal) || goal < 0) errors.goalAmount = "Must be a number ≥ 0.";

    if (deadlineStr === "") errors.deadline = "Goal deadline is required.";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineStr)) errors.deadline = "Must be a valid date (YYYY-MM-DD).";
    else {
      const d = new Date(deadlineStr + "T12:00:00");
      if (isNaN(d.getTime())) errors.deadline = "Must be a valid date (YYYY-MM-DD).";
    }

    if (Object.keys(errors).length > 0) {
      setGoalFormErrors(errors);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setGoalFormErrors({});
    const updates: Record<string, unknown> = {
      currentSales: current,
      goalAmount: goal,
      goalDeadline: deadlineStr,
    };
    await updateSalesGoal(updates as any);
    setShowEditGoal(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <View className="items-center gap-4">
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 120, height: 120, borderRadius: 24 }}
            contentFit="contain"
          />
          <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>SalesEdge</Text>
          <Text className="text-sm" style={{ color: colors.muted }}>Sales Command Center</Text>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 16 }} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>
              {getGreeting()}
            </Text>
            <View className="flex-row items-center mt-1 gap-2">
              <Text className="text-base" style={{ color: colors.muted }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
              </Text>
              {isCloudMode && (
                <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.success + '20' }}>
                  {isSyncing ? (
                    <ActivityIndicator size={10} color={colors.primary} />
                  ) : (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
                  )}
                  <Text className="text-[10px] font-medium" style={{ color: isSyncing ? colors.primary : colors.success }}>
                    {isSyncing ? 'Syncing...' : 'Cloud'}
                  </Text>
                </View>
              )}
              {!isCloudMode && (
                <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.muted + '20' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted }} />
                  <Text className="text-[10px] font-medium" style={{ color: colors.muted }}>Local</Text>
                </View>
              )}
            </View>
          </View>
          <Pressable
            onPress={() => {
              haptic();
              router.push("/profile");
            }}
            className="p-2 rounded-full"
            style={{ backgroundColor: colors.surface }}
          >
            <IconSymbol name="person.fill" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        {/* ═══ Sales Goal Tracker ═══ */}
        <View className="px-5 mt-4">
          <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
            {/* Header row */}
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
              <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                Sales Goal Tracker
              </Text>
              <TouchableOpacity onPress={() => { haptic(); openEditGoalModal(); }} activeOpacity={0.7}>
                <IconSymbol name="pencil" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View className="px-4 pb-2">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-medium" style={{ color: colors.muted }}>
                  {formatCurrencyLarge(salesGoal.currentSales)} of {formatCurrencyLarge(salesGoal.goalAmount)}
                </Text>
                <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                  {salesCalc.progressPct.toFixed(1)}%
                </Text>
              </View>
              <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                <View
                  className="h-3 rounded-full"
                  style={{
                    backgroundColor: colors.primary,
                    width: `${Math.min(100, salesCalc.progressPct)}%`,
                  }}
                />
              </View>
            </View>

            {/* Key metrics */}
            <View className="flex-row px-2 pb-4 pt-2">
              <View className="flex-1 items-center px-1">
                <Text className="text-lg font-bold" style={{ color: colors.error }}>
                  {formatCurrencyLarge(salesCalc.remaining)}
                </Text>
                <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
                  Remaining
                </Text>
              </View>
              <View className="flex-1 items-center px-1 border-l border-r" style={{ borderColor: colors.border }}>
                <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                  {salesCalc.workDaysLeft}
                </Text>
                <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
                  Work Days Left
                </Text>
              </View>
              <View className="flex-1 items-center px-1">
                <Text className="text-lg font-bold" style={{ color: colors.success }}>
                  {formatCurrencyLarge(Math.round(salesCalc.dailyTarget))}
                </Text>
                <Text className="text-[10px] mt-0.5 text-center" style={{ color: colors.muted }}>
                  Daily Target
                </Text>
              </View>
            </View>


          </View>
        </View>

        {/* Stats Row */}
        <View className="flex-row px-5 mt-4 gap-3">
          <View className="flex-1 rounded-2xl p-4" style={{ backgroundColor: colors.surface }}>
            <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
              {todayEvents.length}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.muted }}>
              Today's Events
            </Text>
          </View>
          <View className="flex-1 rounded-2xl p-4" style={{ backgroundColor: colors.surface }}>
            <Text className="text-2xl font-bold" style={{ color: colors.warning }}>
              {activeRfps.length}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.muted }}>
              Active RFPs
            </Text>
          </View>
          <View className="flex-1 rounded-2xl p-4" style={{ backgroundColor: colors.surface }}>
            <Text className="text-2xl font-bold" style={{ color: colors.success }}>
              {formatCurrency(String(pipelineValue))}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.muted }}>
              Pipeline
            </Text>
          </View>
        </View>

        {/* Overdue Follow-Ups */}
        {overdueFollowUps.length > 0 && (
          <View className="px-5 mt-5">
            <View className="flex-row items-center mb-3">
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
              <Text className="text-lg font-bold ml-2" style={{ color: colors.error }}>
                Overdue Follow-Ups
              </Text>
              <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.error + "20" }}>
                <Text className="text-xs font-bold" style={{ color: colors.error }}>
                  {overdueFollowUps.length}
                </Text>
              </View>
            </View>
            <View className="gap-2">
              {overdueFollowUps.slice(0, 5).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => { haptic(); router.push("/(tabs)/rfps"); }}
                  style={({ pressed }) => [
                    styles.eventCard,
                    { backgroundColor: colors.error + "08", borderLeftColor: colors.error, borderWidth: 1, borderColor: colors.error + "25", opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold" style={{ color: colors.error }}>
                      {item.daysOverdue} day{item.daysOverdue !== 1 ? "s" : ""} overdue
                    </Text>
                    <Text className="text-[10px]" style={{ color: colors.muted }}>
                      Due: {formatDateShortTz(item.followUpDate)}
                    </Text>
                  </View>
                  <Text className="text-base font-semibold mt-1" style={{ color: colors.foreground }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-xs mt-0.5" style={{ color: colors.muted }}>
                    Brokerage: {item.client}
                  </Text>
                </Pressable>
              ))}
              {overdueFollowUps.length > 5 && (
                <Text className="text-xs text-center" style={{ color: colors.muted }}>
                  +{overdueFollowUps.length - 5} more overdue
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Today's Schedule */}
        <View className="px-5 mt-6">
          <Text className="text-lg font-bold mb-3" style={{ color: colors.foreground }}>
            Today's Schedule
          </Text>
          {todayEvents.length === 0 ? (
            <View className="rounded-2xl p-5 items-center" style={{ backgroundColor: colors.surface }}>
              <IconSymbol name="calendar" size={32} color={colors.muted} />
              <Text className="text-sm mt-2" style={{ color: colors.muted }}>
                No events today
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {todayEvents.slice(0, 5).map((evt) => (
                <Pressable
                  key={evt.id}
                  onPress={() => { haptic(); router.push("/(tabs)/calendar"); }}
                  style={({ pressed }) => [
                    styles.eventCard,
                    { backgroundColor: colors.surface, borderLeftColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                    {formatTimeRange(evt.startTime, evt.endTime) || "All Day"}
                  </Text>
                  <Text className="text-base font-semibold mt-1" style={{ color: colors.foreground }} numberOfLines={1}>
                    {evt.title}
                  </Text>
                  {evt.description ? (
                    <Text className="text-xs mt-0.5" style={{ color: colors.muted }} numberOfLines={1}>
                      {evt.description}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              {todayEvents.length > 5 && (
                <Text className="text-xs text-center" style={{ color: colors.muted }}>
                  +{todayEvents.length - 5} more events
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Urgent Items */}
        {urgentItems.length > 0 && (
          <View className="px-5 mt-6">
            <Text className="text-lg font-bold mb-3" style={{ color: colors.foreground }}>
              Coming Up
            </Text>
            <View className="gap-2">
              {urgentItems.map((item, i) => (
                <View
                  key={i}
                  className="flex-row items-center rounded-xl p-3"
                  style={{ backgroundColor: colors.surface }}
                >
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: item.color + "15" }}
                  >
                    <Text className="text-xs font-bold" style={{ color: item.color }}>
                      {item.days === 0 ? "!" : item.days}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium" style={{ color: colors.foreground }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-xs" style={{ color: colors.muted }}>
                      {item.label} — {item.days === 0 ? "Today" : item.days === 1 ? "Tomorrow" : `${item.days} days`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View className="px-5 mt-6">
          <Text className="text-lg font-bold mb-3" style={{ color: colors.foreground }}>
            Quick Actions
          </Text>
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => { haptic(); router.push("/(tabs)/chat"); }}
              activeOpacity={0.9}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.primary },
              ]}
            >
              <IconSymbol name="mic.fill" size={20} color="#FFFFFF" />
              <Text className="text-base font-semibold ml-3" style={{ color: "#FFFFFF" }}>
                Talk to AI Assistant
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { haptic(); router.push("/weekly-summary"); }}
              activeOpacity={0.8}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <Text className="text-base font-semibold ml-3" style={{ color: colors.foreground }}>
                Weekly Overview
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Export Section */}
        <View className="px-5 mt-6">
          <Text className="text-lg font-bold mb-3" style={{ color: colors.foreground }}>
            Export
          </Text>
          <View className="gap-2">
            <TouchableOpacity
              onPress={() => { haptic(); handleAttackPlan(); }}
              disabled={exporting === "pdf"}
              activeOpacity={0.7}
              style={[
                styles.exportBtn,
                { backgroundColor: colors.surface, opacity: exporting === "pdf" ? 0.7 : 1 },
              ]}
            >
              {exporting === "pdf" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol name="doc.text.fill" size={18} color={colors.primary} />
              )}
              <Text className="text-sm font-medium ml-3" style={{ color: colors.foreground }}>
                Daily Attack Plan (PDF)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { haptic(); handleExcelExport("rfps"); }}
              disabled={exporting === "rfps"}
              activeOpacity={0.7}
              style={[
                styles.exportBtn,
                { backgroundColor: colors.surface, opacity: exporting === "rfps" ? 0.7 : 1 },
              ]}
            >
              {exporting === "rfps" ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <IconSymbol name="doc.text.fill" size={18} color={colors.success} />
              )}
              <Text className="text-sm font-medium ml-3" style={{ color: colors.foreground }}>
                RFPs & Sold Cases (Excel)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { haptic(); handleExcelExport("schedule"); }}
              disabled={exporting === "schedule"}
              activeOpacity={0.7}
              style={[
                styles.exportBtn,
                { backgroundColor: colors.surface, opacity: exporting === "schedule" ? 0.7 : 1 },
              ]}
            >
              {exporting === "schedule" ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <IconSymbol name="calendar" size={18} color={colors.warning} />
              )}
              <Text className="text-sm font-medium ml-3" style={{ color: colors.foreground }}>
                Schedule (Excel)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ═══ Edit Sales Goal Modal ═══ */}
      <Modal visible={showEditGoal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
              <View className="rounded-t-3xl p-5 pb-10" style={{ backgroundColor: colors.background }}>
                <View className="flex-row items-center justify-between mb-5">
                  <TouchableOpacity onPress={() => setShowEditGoal(false)} activeOpacity={0.7}>
                    <Text className="text-base" style={{ color: colors.muted }}>Cancel</Text>
                  </TouchableOpacity>
                  <Text className="text-lg font-bold" style={{ color: colors.foreground }}>Edit Sales Goal</Text>
                  <TouchableOpacity onPress={handleSaveGoal} activeOpacity={0.7}>
                    <Text className="text-base font-bold" style={{ color: colors.primary }}>Save</Text>
                  </TouchableOpacity>
                </View>

                <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                  Current Sales ($)
                </Text>
                <TextInput
                  value={editCurrentSales}
                  onChangeText={(text) => {
                    setEditCurrentSales(text);
                    if (goalFormErrors.currentSales) setGoalFormErrors((prev) => ({ ...prev, currentSales: undefined }));
                  }}
                  // keyboardType="numeric"
                  placeholder="e.g. 4900000"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  className="rounded-xl p-4 mb-4 text-base"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderWidth: goalFormErrors.currentSales ? 1.5 : 1,
                    borderColor: goalFormErrors.currentSales ? colors.error : colors.border,
                  }}
                />
                {goalFormErrors.currentSales ? (
                  <Text className="text-sm mb-4" style={{ color: colors.error }}>{goalFormErrors.currentSales}</Text>
                ) : null}

                <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                  Sales Goal ($)
                </Text>
                <TextInput
                  value={editGoalAmount}
                  onChangeText={(text) => {
                    setEditGoalAmount(text);
                    if (goalFormErrors.goalAmount) setGoalFormErrors((prev) => ({ ...prev, goalAmount: undefined }));
                  }}
                  // keyboardType="numeric"
                  placeholder="e.g. 12000000"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  className="rounded-xl p-4 mb-4 text-base"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderWidth: goalFormErrors.goalAmount ? 1.5 : 1,
                    borderColor: goalFormErrors.goalAmount ? colors.error : colors.border,
                  }}
                />
                {goalFormErrors.goalAmount ? (
                  <Text className="text-sm mb-4" style={{ color: colors.error }}>{goalFormErrors.goalAmount}</Text>
                ) : null}

                <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                  Goal Deadline (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={editDeadline}
                  onChangeText={(text) => {
                    setEditDeadline(text);
                    if (goalFormErrors.deadline) setGoalFormErrors((prev) => ({ ...prev, deadline: undefined }));
                  }}
                  placeholder="e.g. 2026-12-01"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  className="rounded-xl p-4 mb-4 text-base"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.foreground,
                    borderWidth: goalFormErrors.deadline ? 1.5 : 1,
                    borderColor: goalFormErrors.deadline ? colors.error : colors.border,
                  }}
                />
                {goalFormErrors.deadline ? (
                  <Text className="text-sm mb-4" style={{ color: colors.error }}>{goalFormErrors.deadline}</Text>
                ) : null}

                <Text className="text-xs text-center mt-2" style={{ color: colors.muted }}>
                  Work days are counted Mon–Fri. Daily target = remaining ÷ work days left.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    borderLeftWidth: 3,
    borderRadius: 12,
    padding: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
