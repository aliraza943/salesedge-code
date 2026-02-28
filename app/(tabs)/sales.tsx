import { useCallback, useMemo, useState } from "react";
import {
  Text,
  View,
  Pressable,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import type { LocalRfp } from "@/lib/local-store";
import { formatDateMedium } from "@/lib/timezone";

function formatCurrency(value: string | null | undefined) {
  if (!value) return "—";
  const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return "—";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCurrencyLarge(num: number): string {
  if (num >= 1000000) {
    return "$" + (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return "$" + (num / 1000).toFixed(0) + "K";
  }
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  try {
    return formatDateMedium(dateStr);
  } catch {
    return dateStr;
  }
}

export default function SalesScreen() {
  const colors = useColors();
  const { rfps, salesGoal, refreshAll } = useData();
  const [detailRfp, setDetailRfp] = useState<LocalRfp | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  // Sold RFPs — the core data for this screen
  const soldRfps = useMemo(() => {
    return rfps
      .filter((r) => r.status === "sold")
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [rfps]);

  // Stats
  const stats = useMemo(() => {
    const totalSold = soldRfps.reduce(
      (sum, r) => sum + (parseFloat((r.premium || "0").replace(/[^0-9.-]/g, "")) || 0),
      0
    );
    const totalLives = soldRfps.reduce((sum, r) => sum + (r.lives || 0), 0);
    return { totalSold, totalLives, count: soldRfps.length };
  }, [soldRfps]);

  // Sales goal progress
  const goalProgress = useMemo(() => {
    const pct = salesGoal.goalAmount > 0
      ? Math.min(100, (salesGoal.currentSales / salesGoal.goalAmount) * 100)
      : 0;
    const remaining = Math.max(0, salesGoal.goalAmount - salesGoal.currentSales);
    return { pct, remaining };
  }, [salesGoal]);

  const renderSoldCard = useCallback(
    ({ item }: { item: LocalRfp }) => {
      return (
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDetailRfp(item);
          }}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {/* Green left accent bar */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 8,
              bottom: 8,
              width: 4,
              borderRadius: 2,
              backgroundColor: colors.success,
            }}
          />

          <View style={{ paddingLeft: 8 }}>
            {/* Top row: case name + premium */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {item.client}
                  {item.brokerContact ? ` — ${item.brokerContact}` : ""}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.success }}>
                {formatCurrency(item.premium)}
              </Text>
            </View>

            {/* Bottom row: lives + effective date */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {item.lives != null && item.lives > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <IconSymbol name="person.fill" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {item.lives.toLocaleString()} lives
                    </Text>
                  </View>
                )}
                {item.effectiveDate && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <IconSymbol name="calendar" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      Eff: {formatDate(item.effectiveDate)}
                    </Text>
                  </View>
                )}
              </View>
              <View
                style={{
                  backgroundColor: colors.success + "20",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: colors.success }}>SOLD</Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [colors]
  );

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 12,
          paddingTop: 8,
          borderBottomWidth: 0.5,
          borderColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>
          Sales
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {stats.count} deal{stats.count !== 1 ? "s" : ""} closed
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sales Goal Progress Card */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View
            style={{
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Sales Goal Progress
                </Text>
                <Text style={{ fontSize: 28, fontWeight: "800", color: colors.foreground, marginTop: 4 }}>
                  {formatCurrencyLarge(salesGoal.currentSales)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>Goal</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                  {formatCurrencyLarge(salesGoal.goalAmount)}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.border,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(100, goalProgress.pct)}%`,
                  borderRadius: 5,
                  backgroundColor: goalProgress.pct >= 100 ? colors.success : colors.primary,
                }}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {goalProgress.pct.toFixed(1)}% achieved
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {formatCurrencyLarge(goalProgress.remaining)} remaining
              </Text>
            </View>
          </View>
        </View>

        {/* Summary Stats Row */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <IconSymbol name="dollarsign.circle.fill" size={24} color={colors.success} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.success, marginTop: 6 }}>
              {formatCurrencyLarge(stats.totalSold)}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Total Premium</Text>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <IconSymbol name="checkmark" size={24} color={colors.primary} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginTop: 6 }}>
              {stats.count}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Deals Closed</Text>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <IconSymbol name="person.fill" size={24} color={colors.warning} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginTop: 6 }}>
              {stats.totalLives.toLocaleString()}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Total Lives</Text>
          </View>
        </View>

        {/* Section Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>
            Sold Deals
          </Text>
        </View>

        {/* Sold RFP List */}
        {soldRfps.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <IconSymbol name="dollarsign.circle.fill" size={48} color={colors.muted} />
            <Text style={{ fontSize: 16, fontWeight: "500", color: colors.muted, marginTop: 12 }}>
              No sold deals yet
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center", paddingHorizontal: 40 }}>
              Move an RFP to "Sold" status and it will appear here automatically
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {soldRfps.map((item) => (
              <View key={item.id}>{renderSoldCard({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!detailRfp} animationType="slide" presentationStyle="pageSheet">
        {detailRfp && (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 12,
                borderBottomWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <TouchableOpacity onPress={() => setDetailRfp(null)} activeOpacity={0.6}>
                <Text style={{ fontSize: 16, color: colors.primary }}>Close</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                Sold Deal Details
              </Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
              {/* Sold badge */}
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: colors.success + "20",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.success }}>
                  SOLD
                </Text>
              </View>

              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>
                {detailRfp.title}
              </Text>
              <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 20 }}>
                {detailRfp.client}
                {detailRfp.brokerContact ? ` — ${detailRfp.brokerContact}` : ""}
              </Text>

              {/* Detail fields */}
              <View style={{ gap: 16 }}>
                {detailRfp.premium && (
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Premium
                    </Text>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: colors.success }}>
                      {formatCurrency(detailRfp.premium)}
                    </Text>
                  </View>
                )}

                {detailRfp.lives != null && detailRfp.lives > 0 && (
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Lives
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
                      {detailRfp.lives.toLocaleString()}
                    </Text>
                  </View>
                )}

                {detailRfp.effectiveDate && (
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Effective Date
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.foreground }}>
                      {formatDate(detailRfp.effectiveDate)}
                    </Text>
                  </View>
                )}

                {detailRfp.notes && (
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Notes
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.foreground, lineHeight: 22 }}>
                      {detailRfp.notes}
                    </Text>
                  </View>
                )}

                {detailRfp.createdAt && (
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      Created
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.muted }}>
                      {new Date(detailRfp.createdAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
});
