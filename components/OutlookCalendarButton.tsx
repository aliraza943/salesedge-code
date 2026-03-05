/**
 * OutlookCalendarButton
 *
 * A self-contained button that shows the current Outlook Calendar connection
 * status and lets the user connect or disconnect their Microsoft account.
 *
 * Usage:
 *   <OutlookCalendarButton />
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useOutlookCalendar } from "@/hooks/use-outlook-calendar";

// Simple Microsoft logo SVG-as-text fallback — we use a coloured square grid
// since react-native-svg may not be available everywhere.
function MicrosoftIcon({ size = 20 }: { size?: number }) {
  const half = size / 2 - 1;
  return (
    <View style={{ width: size, height: size, flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
      <View style={{ width: half, height: half, backgroundColor: "#F25022" }} />
      <View style={{ width: half, height: half, backgroundColor: "#7FBA00" }} />
      <View style={{ width: half, height: half, backgroundColor: "#00A4EF" }} />
      <View style={{ width: half, height: half, backgroundColor: "#FFB900" }} />
    </View>
  );
}

interface OutlookCalendarButtonProps {
  /** Optional style override for the container */
  style?: object;
  /** Compact mode — shows only an icon + short label */
  compact?: boolean;
}

export function OutlookCalendarButton({
  style,
  compact = false,
}: OutlookCalendarButtonProps) {
  const {
    isConnected,
    connectedEmail,
    isLoading,
    isConnecting,
    isDisconnecting,
    connect,
    disconnect,
    connectError,
  } = useOutlookCalendar();

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Outlook",
      `Remove the connection to ${connectedEmail ?? "your Outlook account"}? Events will no longer sync automatically.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: disconnect,
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#0078D4" />
      </View>
    );
  }

  if (isConnected) {
    return (
      <View style={[styles.connectedCard, style]}>
        <View style={styles.connectedLeft}>
          <MicrosoftIcon size={20} />
          <View style={styles.connectedTextWrap}>
            <Text style={styles.connectedLabel}>Outlook Calendar</Text>
            {!compact && connectedEmail ? (
              <Text style={styles.connectedEmail} numberOfLines={1}>
                {connectedEmail}
              </Text>
            ) : null}
          </View>
          <View style={styles.connectedBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.connectedBadgeText}>Connected</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleDisconnect}
          disabled={isDisconnecting}
          style={styles.disconnectBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isDisconnecting ? (
            <ActivityIndicator size="small" color="#888" />
          ) : (
            <Text style={styles.disconnectText}>Disconnect</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <TouchableOpacity
        onPress={connect}
        disabled={isConnecting}
        style={[styles.connectBtn, isConnecting && styles.connectBtnDisabled]}
        activeOpacity={0.8}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <MicrosoftIcon size={18} />
            <Text style={styles.connectBtnText}>Connect Outlook Calendar</Text>
          </>
        )}
      </TouchableOpacity>
      {connectError ? (
        <Text style={styles.errorText}>
          Connection failed. Please try again.
        </Text>
      ) : null}
      {!compact && (
        <Text style={styles.hintText}>
          Events you create will automatically appear in your Microsoft Outlook calendar.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  wrapper: {
    gap: 8,
  },
  // ── Connect button ──────────────────────────────────────────────────────
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#0078D4",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  connectBtnDisabled: {
    opacity: 0.6,
  },
  connectBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  hintText: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    lineHeight: 17,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    textAlign: "center",
  },
  // ── Connected card ──────────────────────────────────────────────────────
  connectedCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0f7ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  connectedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  connectedTextWrap: {
    flex: 1,
  },
  connectedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e3a5f",
  },
  connectedEmail: {
    fontSize: 12,
    color: "#555",
    marginTop: 1,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  connectedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16a34a",
  },
  disconnectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  disconnectText: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
});
