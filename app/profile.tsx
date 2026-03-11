import { useRouter, Redirect } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import * as Api from "@/lib/_core/api";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, loading, logout } = useAuth({ autoFetch: true });
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace("/login");
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account and all your data (events, RFPs, deals, brokers, chat, sales goal). This cannot be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await Api.deleteAccount();
              await logout();
              router.replace("/login");
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to delete account. Please try again."
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }
  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <ScreenContainer className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3 mb-8">
          <Pressable
            onPress={() => router.back()}
            className="p-2 rounded-full"
            style={{ backgroundColor: colors.surface }}
          >
            <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold flex-1" style={{ color: colors.foreground }}>
            Profile
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/rfp-labels-settings")}
          className="rounded-xl py-3.5 flex-row items-center justify-between mb-4 px-4"
          style={{ backgroundColor: colors.border }}
        >
          <Text className="text-base font-medium" style={{ color: colors.foreground }}>
            Customize RFP field labels
          </Text>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </Pressable>

        <View className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: colors.surface }}>
          <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
            <Text className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Name
            </Text>
            <Text className="text-base" style={{ color: colors.foreground }}>
              {user.name}
            </Text>
          </View>
          <View className="p-4 border-b" style={{ borderBottomColor: colors.border }}>
            <Text className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Username
            </Text>
            <Text className="text-base" style={{ color: colors.foreground }}>
              @{user.username}
            </Text>
          </View>
          <View className="p-4">
            <Text className="text-xs font-medium mb-1" style={{ color: colors.muted }}>
              Email
            </Text>
            <Text className="text-base" style={{ color: colors.foreground }}>
              {user.email}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleLogout}
          disabled={loggingOut || deleting}
          className="rounded-xl py-3.5 items-center justify-center mb-3 flex-row gap-2"
          style={{ backgroundColor: colors.tint }}
        >
          {/* {loggingOut ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <IconSymbol name="arrow.down" size={20} color={colors.foreground} />
          )} */}
          <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
            Log out
          </Text>
        </Pressable>

        <Pressable
          onPress={handleDeleteAccount}
          disabled={loggingOut || deleting}
          className="rounded-xl py-3.5 items-center justify-center flex-row gap-2"
          style={{ backgroundColor: (colors.error || "#dc2626") + "18" }}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.error || "#dc2626"} />
          ) : (
            <IconSymbol name="trash.fill" size={20} color={colors.error || "#dc2626"} />
          )}
          <Text className="text-base font-semibold" style={{ color: colors.error || "#dc2626" }}>
            Delete account
          </Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
