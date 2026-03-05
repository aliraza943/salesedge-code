import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View, Pressable, TouchableOpacity, StyleSheet, Platform, Linking, Alert, ActivityIndicator, TextInput, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import { getGreeting, getTodayStr, formatTime, formatTimeRange, formatCurrency, formatCurrencyLarge, countWorkDays, daysUntil } from "@/lib/utils";
import { parseLocalDate, formatDateShortTz } from "@/lib/timezone";
import { generateAttackPlanHTML } from "@/lib/pdf-html";
import { getApiBaseUrl } from "@/constants/oauth";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { events, rfps, deals, isLoading, refreshAll, salesGoal, updateSalesGoal, isCloudMode, isSyncing, syncLocalToCloud } = useData();
  const [exporting, setExporting] = useState<string | null>(null);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [editCurrentSales, setEditCurrentSales] = useState("");
  const [editGoalAmount, setEditGoalAmount] = useState("");
  const [editDeadline, setEditDeadline] = useState("");

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
      const body = type === "rfps" ? { rfps } : { events };
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
  }, [rfps, events]);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openEditGoalModal = () => {
    setEditCurrentSales(String(salesGoal.currentSales));
    setEditGoalAmount(String(salesGoal.goalAmount));
    setEditDeadline(salesGoal.goalDeadline);
    setShowEditGoal(true);
  };

  const handleSaveGoal = async () => {
    const current = parseFloat(editCurrentSales.replace(/[^0-9.-]/g, ""));
    const goal = parseFloat(editGoalAmount.replace(/[^0-9.-]/g, ""));
    const updates: Record<string, unknown> = {};
    if (!isNaN(current)) updates.currentSales = current;
    if (!isNaN(goal) && goal > 0) updates.goalAmount = goal;
    // Validate deadline is a valid YYYY-MM-DD date
    if (editDeadline && /^\d{4}-\d{2}-\d{2}$/.test(editDeadline)) {
      const d = new Date(editDeadline + "T12:00:00");
      if (!isNaN(d.getTime())) updates.goalDeadline = editDeadline;
    }
    if (Object.keys(updates).length > 0) await updateSalesGoal(updates as any);
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

        {/* ═══════════════════════════════════════════════════
            HEADER — Greeting + Date + Sync Badge
            ═══════════════════════════════════════════════════ */}
        <View style={s.headerContainer}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.greeting, { color: colors.foreground }]}>
                {getGreeting()}
              </Text>
              <View style={s.dateRow}>
                <Text style={[s.dateText, { color: colors.muted }]}>
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                </Text>
                {isCloudMode && (
                  <View style={[s.syncBadge, { backgroundColor: isSyncing ? colors.primary + '15' : colors.success + '15' }]}>
                    {isSyncing ? (
                      <ActivityIndicator size={8} color={colors.primary} />
                    ) : (
                      <View style={[s.syncDot, { backgroundColor: colors.success }]} />
                    )}
                    <Text style={[s.syncText, { color: isSyncing ? colors.primary : colors.success }]}>
                      {isSyncing ? 'Syncing' : 'Cloud'}
                    </Text>
                  </View>
                )}
                {!isCloudMode && (
                  <View style={[s.syncBadge, { backgroundColor: colors.muted + '15' }]}>
                    <View style={[s.syncDot, { backgroundColor: colors.muted }]} />
                    <Text style={[s.syncText, { color: colors.muted }]}>Local</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════
            SALES GOAL TRACKER — Hero Card
            ═══════════════════════════════════════════════════ */}
        <View style={s.sectionPadding}>
          <View style={[s.goalCard, { backgroundColor: colors.primary }]}>
            {/* Card header */}
            <View style={s.goalHeader}>
              <View style={s.goalTitleRow}>
                <IconSymbol name="chart.line.uptrend.xyaxis" size={16} color="rgba(255,255,255,0.85)" />
                <Text style={s.goalTitle}>Sales Goal Tracker</Text>
              </View>
              <TouchableOpacity onPress={() => { haptic(); openEditGoalModal(); }} activeOpacity={0.7} style={s.goalEditBtn}>
                <IconSymbol name="pencil" size={14} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* Big number */}
            <Text style={s.goalBigNumber}>
              {formatCurrencyLarge(salesGoal.currentSales)}
            </Text>
            <Text style={s.goalSubtext}>
              of {formatCurrencyLarge(salesGoal.goalAmount)} goal
            </Text>

            {/* Progress bar */}
            <View style={s.goalProgressTrack}>
              <View
                style={[
                  s.goalProgressFill,
                  { width: `${Math.min(100, salesCalc.progressPct)}%` },
                ]}
              />
            </View>
            <Text style={s.goalProgressLabel}>
              {salesCalc.progressPct.toFixed(1)}% achieved
            </Text>

            {/* Metrics row */}
            <View style={s.goalMetricsRow}>
              <View style={s.goalMetric}>
                <Text style={s.goalMetricValue}>{formatCurrencyLarge(salesCalc.remaining)}</Text>
                <Text style={s.goalMetricLabel}>Remaining</Text>
              </View>
              <View style={[s.goalMetricDivider]} />
              <View style={s.goalMetric}>
                <Text style={s.goalMetricValue}>{salesCalc.workDaysLeft}</Text>
                <Text style={s.goalMetricLabel}>Work Days</Text>
              </View>
              <View style={[s.goalMetricDivider]} />
              <View style={s.goalMetric}>
                <Text style={s.goalMetricValue}>{formatCurrencyLarge(Math.round(salesCalc.dailyTarget))}</Text>
                <Text style={s.goalMetricLabel}>Daily Target</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════
            STATS ROW — 3 compact metric tiles
            ═══════════════════════════════════════════════════ */}
        <View style={[s.sectionPadding, { marginTop: 4 }]}>
          <View style={s.statsRow}>
            <View style={[s.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.statIconWrap, { backgroundColor: colors.primary + '12' }]}>
                <IconSymbol name="calendar" size={16} color={colors.primary} />
              </View>
              <Text style={[s.statNumber, { color: colors.primary }]}>{todayEvents.length}</Text>
              <Text style={[s.statLabel, { color: colors.muted }]}>Today</Text>
            </View>
            <View style={[s.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.statIconWrap, { backgroundColor: colors.warning + '12' }]}>
                <IconSymbol name="doc.text.fill" size={16} color={colors.warning} />
              </View>
              <Text style={[s.statNumber, { color: colors.warning }]}>{activeRfps.length}</Text>
              <Text style={[s.statLabel, { color: colors.muted }]}>Active RFPs</Text>
            </View>
            <View style={[s.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.statIconWrap, { backgroundColor: colors.success + '12' }]}>
                <IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={colors.success} />
              </View>
              <Text style={[s.statNumber, { color: colors.success }]}>{formatCurrency(String(pipelineValue))}</Text>
              <Text style={[s.statLabel, { color: colors.muted }]}>Pipeline</Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════
            OVERDUE FOLLOW-UPS — Alert Section
            ═══════════════════════════════════════════════════ */}
        {overdueFollowUps.length > 0 && (
          <View style={[s.sectionPadding, { marginTop: 20 }]}>
            <View style={[s.alertBanner, { backgroundColor: colors.error + '08', borderColor: colors.error + '20' }]}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIconWrap, { backgroundColor: colors.error + '15' }]}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error} />
                </View>
                <Text style={[s.sectionTitle, { color: colors.error }]}>Overdue Follow-Ups</Text>
                <View style={[s.countBadge, { backgroundColor: colors.error }]}>
                  <Text style={s.countBadgeText}>{overdueFollowUps.length}</Text>
                </View>
              </View>
              <View style={{ gap: 8, marginTop: 12 }}>
                {overdueFollowUps.slice(0, 5).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => { haptic(); router.push("/(tabs)/rfps"); }}
                    style={({ pressed }) => [
                      s.overdueCard,
                      { backgroundColor: colors.surface, borderColor: colors.error + '30', opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={s.overdueCardHeader}>
                      <View style={[s.overdueBadge, { backgroundColor: colors.error + '15' }]}>
                        <Text style={[s.overdueBadgeText, { color: colors.error }]}>
                          {item.daysOverdue}d overdue
                        </Text>
                      </View>
                      <Text style={[s.overdueDateText, { color: colors.muted }]}>
                        Due: {formatDateShortTz(item.followUpDate)}
                      </Text>
                    </View>
                    <Text style={[s.overdueTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[s.overdueSubtitle, { color: colors.muted }]}>
                      {item.client}
                    </Text>
                  </Pressable>
                ))}
                {overdueFollowUps.length > 5 && (
                  <Text style={[s.moreText, { color: colors.muted }]}>
                    +{overdueFollowUps.length - 5} more overdue
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            TODAY'S SCHEDULE
            ═══════════════════════════════════════════════════ */}
        <View style={[s.sectionPadding, { marginTop: 24 }]}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIconWrap, { backgroundColor: colors.primary + '12' }]}>
              <IconSymbol name="calendar" size={14} color={colors.primary} />
            </View>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Today's Schedule</Text>
            {todayEvents.length > 0 && (
              <View style={[s.countBadge, { backgroundColor: colors.primary }]}>
                <Text style={s.countBadgeText}>{todayEvents.length}</Text>
              </View>
            )}
          </View>
          {todayEvents.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.emptyIconWrap, { backgroundColor: colors.muted + '10' }]}>
                <IconSymbol name="calendar" size={28} color={colors.muted} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.muted }]}>No events today</Text>
              <Text style={[s.emptySubtitle, { color: colors.muted }]}>Enjoy the open schedule or add something new</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 12 }}>
              {todayEvents.slice(0, 5).map((evt, idx) => (
                <Pressable
                  key={evt.id}
                  onPress={() => { haptic(); router.push("/(tabs)/calendar"); }}
                  style={({ pressed }) => [
                    s.scheduleCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={[s.scheduleAccent, { backgroundColor: colors.primary }]} />
                  <View style={s.scheduleContent}>
                    <Text style={[s.scheduleTime, { color: colors.primary }]}>
                      {formatTimeRange(evt.startTime, evt.endTime) || "All Day"}
                    </Text>
                    <Text style={[s.scheduleTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {evt.title}
                    </Text>
                    {evt.description ? (
                      <Text style={[s.scheduleDesc, { color: colors.muted }]} numberOfLines={1}>
                        {evt.description}
                      </Text>
                    ) : null}
                  </View>
                  <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                </Pressable>
              ))}
              {todayEvents.length > 5 && (
                <Text style={[s.moreText, { color: colors.muted }]}>
                  +{todayEvents.length - 5} more events
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════
            COMING UP — Urgent Items
            ═══════════════════════════════════════════════════ */}
        {urgentItems.length > 0 && (
          <View style={[s.sectionPadding, { marginTop: 24 }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconWrap, { backgroundColor: colors.warning + '12' }]}>
                <IconSymbol name="clock.fill" size={14} color={colors.warning} />
              </View>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Coming Up</Text>
            </View>
            <View style={{ gap: 8, marginTop: 12 }}>
              {urgentItems.map((item, i) => (
                <View
                  key={i}
                  style={[s.urgentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[s.urgentDayBadge, { backgroundColor: item.color + '12' }]}>
                    <Text style={[s.urgentDayNumber, { color: item.color }]}>
                      {item.days === 0 ? "!" : item.days}
                    </Text>
                    <Text style={[s.urgentDayLabel, { color: item.color }]}>
                      {item.days === 0 ? "" : item.days === 1 ? "day" : "days"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.urgentTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[s.urgentSubtitle, { color: colors.muted }]}>
                      {item.label} {item.days === 0 ? "— Today" : item.days === 1 ? "— Tomorrow" : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            QUICK ACTIONS
            ═══════════════════════════════════════════════════ */}
        <View style={[s.sectionPadding, { marginTop: 24 }]}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIconWrap, { backgroundColor: colors.primary + '12' }]}>
              <IconSymbol name="bolt.fill" size={14} color={colors.primary} />
            </View>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
          </View>
          <View style={{ gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => { haptic(); router.push("/(tabs)/chat"); }}
              activeOpacity={0.85}
              style={[s.primaryActionBtn, { backgroundColor: colors.primary }]}
            >
              <View style={s.actionBtnIconWrap}>
                <IconSymbol name="mic.fill" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.primaryActionTitle}>Talk to AI Assistant</Text>
                <Text style={s.primaryActionSub}>Voice or text — manage your day hands-free</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { haptic(); router.push("/weekly-summary"); }}
              activeOpacity={0.85}
              style={[s.secondaryActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[s.actionBtnIconWrapOutline, { backgroundColor: colors.primary + '10' }]}>
                <IconSymbol name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.secondaryActionTitle, { color: colors.foreground }]}>Weekly Overview</Text>
                <Text style={[s.secondaryActionSub, { color: colors.muted }]}>See your week at a glance</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════
            EXPORT SECTION
            ═══════════════════════════════════════════════════ */}
        <View style={[s.sectionPadding, { marginTop: 24 }]}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIconWrap, { backgroundColor: colors.muted + '12' }]}>
              <IconSymbol name="square.and.arrow.up" size={14} color={colors.muted} />
            </View>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Export</Text>
          </View>
          <View style={[s.exportContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => { haptic(); handleAttackPlan(); }}
              disabled={exporting === "pdf"}
              activeOpacity={0.7}
              style={[s.exportRow, { borderBottomColor: colors.border }]}
            >
              <View style={[s.exportIconWrap, { backgroundColor: colors.primary + '10' }]}>
                {exporting === "pdf" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <IconSymbol name="doc.text.fill" size={16} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.exportTitle, { color: colors.foreground }]}>Daily Attack Plan</Text>
                <Text style={[s.exportSub, { color: colors.muted }]}>PDF</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { haptic(); handleExcelExport("rfps"); }}
              disabled={exporting === "rfps"}
              activeOpacity={0.7}
              style={[s.exportRow, { borderBottomColor: colors.border }]}
            >
              <View style={[s.exportIconWrap, { backgroundColor: colors.success + '10' }]}>
                {exporting === "rfps" ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <IconSymbol name="doc.text.fill" size={16} color={colors.success} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.exportTitle, { color: colors.foreground }]}>RFPs & Sold Cases</Text>
                <Text style={[s.exportSub, { color: colors.muted }]}>Excel</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { haptic(); handleExcelExport("schedule"); }}
              disabled={exporting === "schedule"}
              activeOpacity={0.7}
              style={s.exportRowLast}
            >
              <View style={[s.exportIconWrap, { backgroundColor: colors.warning + '10' }]}>
                {exporting === "schedule" ? (
                  <ActivityIndicator size="small" color={colors.warning} />
                ) : (
                  <IconSymbol name="calendar" size={16} color={colors.warning} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.exportTitle, { color: colors.foreground }]}>Schedule</Text>
                <Text style={[s.exportSub, { color: colors.muted }]}>Excel</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ═══ Edit Sales Goal Modal ═══ */}
      <Modal visible={showEditGoal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.background }]}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditGoal(false)} activeOpacity={0.7}>
                <Text style={[s.modalCancel, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Edit Sales Goal</Text>
              <TouchableOpacity onPress={handleSaveGoal} activeOpacity={0.7}>
                <Text style={[s.modalSave, { color: colors.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.inputLabel, { color: colors.foreground }]}>Current Sales ($)</Text>
            <TextInput
              value={editCurrentSales}
              onChangeText={setEditCurrentSales}
              keyboardType="numeric"
              placeholder="e.g. 4900000"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[s.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />

            <Text style={[s.inputLabel, { color: colors.foreground }]}>Sales Goal ($)</Text>
            <TextInput
              value={editGoalAmount}
              onChangeText={setEditGoalAmount}
              keyboardType="numeric"
              placeholder="e.g. 12000000"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[s.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />

            <Text style={[s.inputLabel, { color: colors.foreground }]}>Goal Deadline (YYYY-MM-DD)</Text>
            <TextInput
              value={editDeadline}
              onChangeText={setEditDeadline}
              placeholder="e.g. 2026-12-01"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={[s.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            />

            <Text style={[s.modalFootnote, { color: colors.muted }]}>
              Work days are counted Mon-Fri. Daily target = remaining / work days left.
            </Text>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const s = StyleSheet.create({
  /* ─── Header ─────────────────────────────────────────── */
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  dateText: {
    fontSize: 15,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  syncDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  syncText: {
    fontSize: 10,
    fontWeight: "600",
  },

  /* ─── Section Shared ─────────────────────────────────── */
  sectionPadding: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  moreText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },

  /* ─── Sales Goal Card (Hero) ─────────────────────────── */
  goalCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  goalTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  goalEditBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  goalBigNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 12,
    letterSpacing: -1,
  },
  goalSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  goalProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 16,
    overflow: "hidden",
  },
  goalProgressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  goalProgressLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    marginTop: 6,
    textAlign: "right",
  },
  goalMetricsRow: {
    flexDirection: "row",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  goalMetric: {
    flex: 1,
    alignItems: "center",
  },
  goalMetricDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  goalMetricValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  goalMetricLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* ─── Stats Row ──────────────────────────────────────── */
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statTile: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },

  /* ─── Overdue Alert ──────────────────────────────────── */
  alertBanner: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  overdueCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  overdueCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overdueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overdueBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  overdueDateText: {
    fontSize: 11,
  },
  overdueTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },
  overdueSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  /* ─── Schedule Cards ─────────────────────────────────── */
  scheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  scheduleAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  scheduleContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  scheduleTime: {
    fontSize: 12,
    fontWeight: "700",
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 3,
  },
  scheduleDesc: {
    fontSize: 12,
    marginTop: 2,
  },

  /* ─── Empty State ────────────────────────────────────── */
  emptyCard: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },

  /* ─── Urgent Items ───────────────────────────────────── */
  urgentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  urgentDayBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentDayNumber: {
    fontSize: 16,
    fontWeight: "800",
  },
  urgentDayLabel: {
    fontSize: 8,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: -1,
  },
  urgentTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  urgentSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },

  /* ─── Quick Actions ──────────────────────────────────── */
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  actionBtnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  primaryActionSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  actionBtnIconWrapOutline: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryActionSub: {
    fontSize: 12,
    marginTop: 2,
  },

  /* ─── Export Section ─────────────────────────────────── */
  exportContainer: {
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  exportRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  exportRowLast: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  exportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  exportTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  exportSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* ─── Modal ──────────────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.3)",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalCancel: {
    fontSize: 15,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalSave: {
    fontSize: 15,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1,
  },
  modalFootnote: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
