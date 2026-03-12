import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Text,
  View,
  Pressable,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import type { LocalBroker, LocalRfp } from "@/lib/local-store";
import { timeAgoTz, formatDateTimeTz } from "@/lib/timezone";

// ─── Helpers ──────────────────────────────────────────

function formatCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return "$" + (num / 1_000).toFixed(0) + "K";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const timeAgo = timeAgoTz;
const formatNoteDate = formatDateTimeTz;

// ─── Broker Stats ──────────────────────────────────────

function getBrokerStats(broker: LocalBroker, rfps: LocalRfp[]) {
  const brokerName = broker.name.toLowerCase().trim();
  // Match strictly by broker contact name only — each person's RFPs stay with them
  const brokerRfps = rfps.filter(
    (r) => r.brokerContact?.toLowerCase().trim() === brokerName
  );
  const soldRfps = brokerRfps.filter((r) => r.status === "sold");
  const totalSoldPremium = soldRfps.reduce((sum, r) => {
    const p = parseFloat(r.premium || "0");
    return sum + (isNaN(p) ? 0 : p);
  }, 0);
  return {
    totalRfps: brokerRfps.length,
    soldCases: soldRfps.length,
    activeRfps: brokerRfps.filter((r) => r.status !== "sold").length,
    totalSoldPremium,
    rfps: brokerRfps,
  };
}

// ─── Main Screen ──────────────────────────────────────

export default function BrokersScreen() {
  const colors = useColors();
  const router = useRouter();
  const { brokers, rfps, createBroker, deleteBroker, addBrokerNote, removeBrokerNote, refreshAll } = useData();

  const [search, setSearch] = useState("");
  const [selectedBroker, setSelectedBroker] = useState<LocalBroker | null>(null);
  const [showAddBroker, setShowAddBroker] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState("");
  const [newBrokerCompany, setNewBrokerCompany] = useState("");
  const [brokerFormErrors, setBrokerFormErrors] = useState<{ name?: string }>({});

  const [newNote, setNewNote] = useState("");

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  const filteredBrokers = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? brokers.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            (b.company || "").toLowerCase().includes(q)
        )
      : brokers;
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [brokers, search]);

  const handleAddBroker = async () => {
    const name = newBrokerName.trim();
    const errors: { name?: string } = {};
    if (!name) errors.name = "Name cannot be empty.";
    if (Object.keys(errors).length > 0) {
      setBrokerFormErrors(errors);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setBrokerFormErrors({});
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await createBroker({
      name,
      company: newBrokerCompany.trim() || undefined,
    });
    setNewBrokerName("");
    setNewBrokerCompany("");
    setShowAddBroker(false);
  };

  const handleDeleteBroker = (broker: LocalBroker) => {
    const doDelete = async () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await deleteBroker(broker.id);
      setSelectedBroker(null);
    };
    if (Platform.OS === "web") {
      if (confirm(`Delete ${broker.name}?`)) doDelete();
    } else {
      Alert.alert("Delete Broker", `Remove ${broker.name} and all notes?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleAddNote = async () => {
    if (!selectedBroker || !newNote.trim()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addBrokerNote(selectedBroker.id, newNote.trim());
    setNewNote("");
    // Refresh to get updated broker
    await refreshAll();
    // Update selected broker from refreshed data
    const updated = brokers.find((b) => b.id === selectedBroker.id);
    if (updated) setSelectedBroker(updated);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedBroker) return;
    const doDelete = async () => {
      await removeBrokerNote(selectedBroker.id, noteId);
      await refreshAll();
      const updated = brokers.find((b) => b.id === selectedBroker.id);
      if (updated) setSelectedBroker(updated);
    };
    if (Platform.OS === "web") {
      if (confirm("Delete this note?")) doDelete();
    } else {
      Alert.alert("Delete Note", "Remove this conversation note?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // Keep selectedBroker in sync with brokers state
  const currentBroker = useMemo(() => {
    if (!selectedBroker) return null;
    return brokers.find((b) => b.id === selectedBroker.id) || selectedBroker;
  }, [brokers, selectedBroker]);

  const brokerStats = useMemo(() => {
    if (!currentBroker) return null;
    return getBrokerStats(currentBroker, rfps);
  }, [currentBroker, rfps]);

  // ─── Render Broker Card ──────────────────────────────

  const renderBrokerCard = ({ item }: { item: LocalBroker }) => {
    const stats = getBrokerStats(item, rfps);
    const lastNote = item.notes.length > 0
      ? item.notes[item.notes.length - 1]
      : null;

    return (
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedBroker(item);
        }}
        style={({ pressed }) => [
          styles.brokerCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={styles.brokerCardHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.brokerInfo}>
            <Text style={[styles.brokerName, { color: colors.foreground }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.company ? (
              <Text style={[styles.brokerCompany, { color: colors.muted }]} numberOfLines={1}>
                {item.company}
              </Text>
            ) : null}
          </View>
          <View style={styles.brokerStats}>
            {stats.soldCases > 0 ? (
              <Text style={[styles.statBadge, { color: colors.success }]}>
                {stats.soldCases} sold
              </Text>
            ) : null}
            {stats.totalRfps > 0 ? (
              <Text style={[styles.statBadge, { color: colors.primary }]}>
                {stats.totalRfps} RFPs
              </Text>
            ) : null}
          </View>
        </View>
        {lastNote ? (
          <View style={styles.lastNoteRow}>
            <Text style={[styles.lastNoteText, { color: colors.muted }]} numberOfLines={2}>
              {lastNote.content}
            </Text>
            <Text style={[styles.lastNoteTime, { color: colors.muted }]}>
              {timeAgo(lastNote.createdAt)}
            </Text>
          </View>
        ) : null}
        {stats.totalSoldPremium > 0 ? (
          <View style={[styles.premiumRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.premiumLabel, { color: colors.muted }]}>Total Sold Premium</Text>
            <Text style={[styles.premiumValue, { color: colors.success }]}>
              {formatCurrency(stats.totalSoldPremium)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  // ─── Broker Detail Modal ────────────────────────────

  const renderDetailModal = () => {
    if (!currentBroker || !brokerStats) return null;

    return (
      <Modal visible={!!selectedBroker} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setSelectedBroker(null)} style={styles.modalClose}>
              <IconSymbol name="chevron.left" size={20} color={colors.primary} />
              <Text style={[styles.modalCloseText, { color: colors.primary }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteBroker(currentBroker)}
              style={styles.modalDelete}
            >
              <IconSymbol name="trash.fill" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 100 }}>
            {/* Broker Info */}
            <View style={styles.detailHeader}>
              <View style={[styles.avatarLarge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.avatarLargeText, { color: colors.primary }]}>
                  {currentBroker.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.detailName, { color: colors.foreground }]}>
                {currentBroker.name}
              </Text>
              {currentBroker.company ? (
                <Text style={[styles.detailCompany, { color: colors.muted }]}>
                  {currentBroker.company}
                </Text>
              ) : null}

            </View>

            {/* Last Conversation Summary */}
            {currentBroker.notes.length > 0 ? (
              <View style={[styles.lastConvoSection, { marginHorizontal: 16, marginBottom: 16 }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 8 }]}>Last Conversation</Text>
                <View style={[styles.lastConvoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <Text style={[styles.lastConvoDate, { color: colors.primary }]}>
                    {formatNoteDate(currentBroker.notes[currentBroker.notes.length - 1].createdAt)}
                  </Text>
                  <Text style={[styles.lastConvoText, { color: colors.foreground }]} numberOfLines={5}>
                    {currentBroker.notes[currentBroker.notes.length - 1].content}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{brokerStats.totalRfps}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Total RFPs</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statNumber, { color: colors.success }]}>{brokerStats.soldCases}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Sold Cases</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statNumber, { color: colors.warning }]}>{brokerStats.activeRfps}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Active RFPs</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statNumber, { color: colors.success }]}>
                  {formatCurrency(brokerStats.totalSoldPremium)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Sold Premium</Text>
              </View>
            </View>

            {/* RFP List */}
            {brokerStats.rfps.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>RFPs</Text>
                {brokerStats.rfps.map((rfp) => (
                  <TouchableOpacity
                    key={rfp.id}
                    activeOpacity={0.6}
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedBroker(null);
                      router.push("/(tabs)/rfps" as any);
                    }}
                    style={[styles.rfpItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.rfpItemHeader}>
                      <Text style={[styles.rfpTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {rfp.title}
                      </Text>
                      <View
                        style={[
                          styles.rfpStatusBadge,
                          {
                            backgroundColor:
                              rfp.status === "sold"
                                ? colors.success + "20"
                                : rfp.status === "recommended"
                                ? colors.warning + "20"
                                : colors.muted + "20",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.rfpStatusText,
                            {
                              color:
                                rfp.status === "sold"
                                  ? colors.success
                                  : rfp.status === "recommended"
                                  ? colors.warning
                                  : colors.muted,
                            },
                          ]}
                        >
                          {rfp.status.charAt(0).toUpperCase() + rfp.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      {rfp.premium ? (
                        <Text style={[styles.rfpPremium, { color: colors.muted }]}>
                          Premium: {formatCurrency(rfp.premium)}
                        </Text>
                      ) : <View />}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.primary }}>View RFP</Text>
                        <IconSymbol name="chevron.right" size={12} color={colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {/* Conversation Notes */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Conversation Notes ({currentBroker.notes.length})
              </Text>

              {currentBroker.notes.length === 0 ? (
                <View style={[styles.emptyNotes, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <IconSymbol name="bubble.left.fill" size={32} color={colors.muted + "40"} />
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    No notes yet. Add a conversation note below.
                  </Text>
                </View>
              ) : (
                [...currentBroker.notes].reverse().map((note) => (
                  <View
                    key={note.id}
                    style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.noteHeader}>
                      <Text style={[styles.noteDate, { color: colors.muted }]}>
                        {formatNoteDate(note.createdAt)}
                      </Text>
                      <TouchableOpacity onPress={() => handleDeleteNote(note.id)}>
                        <IconSymbol name="trash.fill" size={14} color={colors.error + "80"} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.noteContent, { color: colors.foreground }]}>
                      {note.content}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {/* Add Note Input */}
          <View style={[styles.noteInputBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.noteInput, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Add a conversation note..."
              placeholderTextColor={colors.muted}
              value={newNote}
              onChangeText={setNewNote}
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleAddNote}
            />
            <TouchableOpacity
              onPress={handleAddNote}
              style={[styles.sendButton, { backgroundColor: newNote.trim() ? colors.primary : colors.muted + "40" }]}
              disabled={!newNote.trim()}
            >
              <IconSymbol name="paperplane.fill" size={18} color={newNote.trim() ? "#fff" : colors.muted} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ─── Add Broker Modal ────────────────────────────────

  const renderAddBrokerModal = () => (
    <Modal visible={showAddBroker} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
      >
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowAddBroker(false)} style={styles.modalClose}>
            <Text style={[styles.modalCloseText, { color: colors.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Broker</Text>
          <TouchableOpacity onPress={handleAddBroker} style={styles.modalSave}>
            <Text style={[styles.modalSaveText, { color: newBrokerName.trim() ? colors.primary : colors.muted }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Name *</Text>
            <TextInput
              style={[
                styles.fieldInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: brokerFormErrors.name ? colors.error : colors.border,
                  borderWidth: brokerFormErrors.name ? 1.5 : 1,
                },
              ]}
              placeholder="John Doe"
              placeholderTextColor={colors.muted}
              value={newBrokerName}
              onChangeText={(text) => {
                setNewBrokerName(text);
                if (brokerFormErrors.name) setBrokerFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              autoFocus
            />
            {brokerFormErrors.name ? (
              <Text style={[styles.fieldError, { color: colors.error }]}>{brokerFormErrors.name}</Text>
            ) : null}
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Company</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Acme Insurance"
              placeholderTextColor={colors.muted}
              value={newBrokerCompany}
              onChangeText={setNewBrokerCompany}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─── Main Render ────────────────────────────────────

  return (
    <ScreenContainer className="px-4 pt-4">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Brokers</Text>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBrokerFormErrors({});
            setShowAddBroker(true);
          }}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <IconSymbol name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search brokers..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <IconSymbol name="xmark" size={16} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: colors.muted }]}>
          {filteredBrokers.length} broker{filteredBrokers.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Broker List */}
      <FlatList
        data={filteredBrokers}
        keyExtractor={(item) => item.id}
        renderItem={renderBrokerCard}
        contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="person.fill" size={48} color={colors.muted + "40"} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Brokers Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
              Add a broker to start tracking conversations and deals.
            </Text>
          </View>
        }
      />

      {renderDetailModal()}
      {renderAddBrokerModal()}
    </ScreenContainer>
  );
}

// ─── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  summaryRow: {
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
  },
  brokerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  brokerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  brokerInfo: {
    flex: 1,
  },
  brokerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  brokerCompany: {
    fontSize: 13,
    marginTop: 2,
  },
  brokerStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  statBadge: {
    fontSize: 12,
    fontWeight: "600",
  },
  lastNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
    gap: 8,
  },
  lastNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  lastNoteTime: {
    fontSize: 11,
  },
  premiumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  premiumLabel: {
    fontSize: 12,
  },
  premiumValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  modalClose: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalCloseText: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  modalSave: {},
  modalSaveText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalDelete: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  // Detail
  detailHeader: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 4,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarLargeText: {
    fontSize: 28,
    fontWeight: "700",
  },
  detailName: {
    fontSize: 22,
    fontWeight: "bold",
  },
  detailCompany: {
    fontSize: 15,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  rfpItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  rfpItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rfpTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  rfpStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  rfpStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  rfpPremium: {
    fontSize: 13,
    marginTop: 4,
  },
  emptyNotes: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  noteCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  noteDate: {
    fontSize: 12,
  },
  noteContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  noteInputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    gap: 10,
  },
  noteInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // Field inputs
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  fieldError: {
    fontSize: 13,
    marginTop: 6,
  },
  // Last Conversation Summary
  lastConvoSection: {},
  lastConvoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  lastConvoDate: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  lastConvoText: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
