/**
 * AIConsentModal — Apple-compliant AI data sharing consent screen.
 *
 * Satisfies App Store Guidelines 5.1.1(i) and 5.1.2(i):
 *  - Discloses what data is sent
 *  - Identifies who the data is sent to (Manus AI)
 *  - Obtains explicit user permission before any data is shared
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

type Props = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

type SectionProps = {
  icon: string;
  title: string;
  items: string[];
  accentColor: string;
  bgColor: string;
};

function Section({ icon, title, items, accentColor, bgColor }: SectionProps) {
  return (
    <View style={[styles.section, { backgroundColor: bgColor, borderColor: accentColor + "30" }]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={[styles.sectionTitle, { color: accentColor }]}>{title}</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: accentColor }]}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function AIConsentModal({ visible, onAccept, onDecline }: Props) {
  const colors = useColors();

  const openPrivacyPolicy = () => {
    Linking.openURL("https://aliraza943.github.io/salesedge-app-info/#/privacy-policy").catch(() => { });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDecline}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={styles.headerIcon}>🔒</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            AI Data Sharing
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
            Review before enabling AI features
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <Text style={[styles.introText, { color: colors.foreground }]}>
            This app uses an AI assistant powered by{" "}
            <Text style={[styles.bold, { color: colors.primary }]}>Manus AI</Text>{" "}
            to help manage your schedule, RFPs, and sales data. Before enabling
            AI features, please review how your data is used.
          </Text>

          {/* What data is sent */}
          <Section
            icon="📤"
            title="DATA SENT TO AI"
            accentColor="#3B82F6"
            bgColor="#EFF6FF"
            items={[
              "Your typed messages and questions",
              "Calendar events (titles, dates, times)",
              "RFPs (case names, broker names, premiums, status)",
              "Sales deals (client names, deal values, stages)",
              "Broker contact names and conversation notes",
              "Recent chat history (last 10 messages)",
              "Voice recordings and transcribed text (voice features only)",
            ]}
          />

          {/* Who receives the data */}
          <Section
            icon="🔗"
            title="WHO RECEIVES YOUR DATA"
            accentColor="#7C3AED"
            bgColor="#F5F3FF"
            items={[
              "Manus AI (forge.manus.ai) — processes all AI requests",
              "Google Gemini 2.5 Flash — used for text understanding",
              "OpenAI Whisper — used for voice-to-text transcription",
            ]}
          />

          {/* How data is used */}
          <Section
            icon="🔄"
            title="HOW YOUR DATA IS USED"
            accentColor="#059669"
            bgColor="#ECFDF5"
            items={[
              "To answer questions about your schedule and pipeline",
              "To automatically create events, RFPs, and deals from your messages",
              "To transcribe voice recordings into text",
              "Data is used only to provide AI features — not sold or shared further",
            ]}
          />

          {/* Important note */}
          <View style={[styles.noteBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.noteIcon]}>ℹ️</Text>
            <Text style={[styles.noteText, { color: colors.muted }]}>
              You can decline and continue using the app without AI features.
              This consent is remembered and you will not be asked again.
            </Text>
          </View>

          {/* Privacy policy link */}
          <TouchableOpacity onPress={openPrivacyPolicy} style={styles.privacyLink} activeOpacity={0.7}>
            <Text style={[styles.privacyLinkText, { color: colors.primary }]}>
              📄 Read our full Privacy Policy
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Action buttons */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={onDecline}
            style={[styles.declineBtn, { borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.declineBtnText, { color: colors.foreground }]}>
              No Thanks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onAccept}
            style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptBtnText}>I Agree</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 24 : 32,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 14,
  },
  introText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  bold: {
    fontWeight: "700",
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
  },
  noteBox: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  noteIcon: {
    fontSize: 16,
    lineHeight: 22,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  privacyLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  privacyLinkText: {
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  declineBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  acceptBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
