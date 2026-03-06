import { useState, useCallback } from "react";
import { ScrollView, Text, View, Pressable, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();

  useFocusEffect(
    useCallback(() => {
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Sign Out",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
        style: "destructive",
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);

    try {
      await deleteAccountMutation.mutateAsync();
      await logout();
      router.replace("/login");
    } catch (error) {
      Alert.alert("Error", "Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!user) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text style={{ color: colors.muted }}>Not authenticated</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-5 pt-4 pb-6">
          <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>
            Profile
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.muted }}>
            Manage your account settings
          </Text>
        </View>

        {/* User Information Card */}
        <View className="px-5 mb-6">
          <View
            className="rounded-2xl overflow-hidden p-4"
            style={{ backgroundColor: colors.surface }}
          >
            {/* Avatar and Name */}
            <View className="flex-row items-center mb-4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-2xl font-bold" style={{ color: "#fff" }}>
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                  {user.name || "User"}
                </Text>
                <Text className="text-sm" style={{ color: colors.muted }}>
                  {user.email || "No email"}
                </Text>
              </View>
            </View>

            {/* Info Fields */}
            <View className="border-t" style={{ borderTopColor: colors.border, paddingTop: 12 }}>
              <View className="mb-4">
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                  LOGIN METHOD
                </Text>
                <Text className="text-sm capitalize" style={{ color: colors.foreground }}>
                  {user.loginMethod || "email"}
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                  MEMBER SINCE
                </Text>
                <Text className="text-sm" style={{ color: colors.foreground }}>
                  {formatDate(user.lastSignedIn)}
                </Text>
              </View>

              <View>
                <Text className="text-xs font-semibold mb-1" style={{ color: colors.muted }}>
                  ACCOUNT ID
                </Text>
                <Text className="text-xs font-mono" style={{ color: colors.muted }}>
                  {user.id}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="px-5 mb-6 gap-3">
          <TouchableOpacity
            onPress={handleLogout}
            className="rounded-xl overflow-hidden"
            activeOpacity={0.7}
          >
            <View
              className="px-4 py-3 flex-row items-center justify-between"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row items-center gap-3">
                <IconSymbol name="arrow.right.square" size={20} color={colors.primary} />
                <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                  Sign Out
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View className="px-5">
          <View
            className="rounded-2xl overflow-hidden p-4 border-l-4"
            style={{
              backgroundColor: colors.surface,
              borderLeftColor: "#ef4444",
              borderColor: "#fecaca",
              borderWidth: 1,
            }}
          >
            <Text className="text-lg font-bold mb-2" style={{ color: "#ef4444" }}>
              Danger Zone
            </Text>
            <Text className="text-sm mb-4" style={{ color: colors.muted }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </Text>

            {showDeleteConfirm && (
              <View
                className="rounded-lg p-4 mb-4"
                style={{ backgroundColor: "#fef2f2" }}
              >
                <Text className="text-sm font-semibold mb-3" style={{ color: "#991b1b" }}>
                  Are you sure? This will:
                </Text>
                <Text className="text-xs mb-3" style={{ color: "#991b1b", lineHeight: 18 }}>
                  • Permanently delete your account{"\n"}
                  • Remove all your RFPs, deals, and events{"\n"}
                  • Delete your chat history{"\n"}
                  • Remove all broker contacts{"\n"}
                  • Clear your sales goals
                </Text>
                <Text className="text-xs font-semibold" style={{ color: "#991b1b" }}>
                  This action cannot be undone.
                </Text>
              </View>
            )}

            {showDeleteConfirm && (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  <View
                    className="px-4 py-3 rounded-lg items-center justify-center"
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: isDeleting ? 0.6 : 1,
                    }}
                  >
                    <Text className="font-semibold text-sm" style={{ color: colors.foreground }}>
                      Cancel
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  <View
                    className="px-4 py-3 rounded-lg items-center justify-center"
                    style={{
                      backgroundColor: "#ef4444",
                      opacity: isDeleting ? 0.7 : 1,
                    }}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text className="font-semibold text-sm text-white">Delete Account</Text>
                    )}
                  </View>
                </Pressable>
              </View>
            )}

            {!showDeleteConfirm && (
              <Pressable onPress={handleDeleteAccount}>
                <View
                  className="px-4 py-3 rounded-lg items-center justify-center"
                  style={{ backgroundColor: "#ef4444" }}
                >
                  <Text className="font-semibold text-sm text-white">Delete Account</Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
