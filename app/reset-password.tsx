import { useRouter, Link, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Api from "@/lib/_core/api";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ resetToken?: string }>();
  const resetToken = params.resetToken?.trim() ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!resetToken) {
      router.replace("/forgot-password");
    }
  }, [resetToken, router]);

  const handleReset = async () => {
    setError(null);
    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await Api.resetPassword(resetToken, newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reset password. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const loading = submitting;
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    passwordsMatch &&
    !loading;

  if (!resetToken) {
    return null;
  }

  return (
    <ScreenContainer className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            className="text-2xl font-bold mb-1"
            style={{ color: colors.foreground }}
          >
            Set new password
          </Text>
          <Text
            className="text-base mb-8"
            style={{ color: colors.muted }}
          >
            Enter your new password and confirm it. Then you can sign in with it.
          </Text>

          {error && (
            <View
              className="mb-4 p-3 rounded-lg"
              style={{ backgroundColor: (colors.error || "#dc2626") + "20" }}
            >
              <Text style={{ color: colors.error || "#dc2626" }}>{error}</Text>
            </View>
          )}

          {success && (
            <View
              className="mb-4 p-3 rounded-lg"
              style={{ backgroundColor: (colors.primary || "#22c55e") + "20" }}
            >
              <Text style={{ color: colors.primary || "#22c55e" }}>
                Password updated. Redirecting to sign in…
              </Text>
            </View>
          )}

          <Text
            className="text-sm font-medium mb-2"
            style={{ color: colors.foreground }}
          >
            New password
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={(t) => {
              setNewPassword(t);
              setError(null);
            }}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry
            editable={!loading && !success}
            className="rounded-xl border px-4 py-3 mb-4"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Text
            className="text-sm font-medium mb-2"
            style={{ color: colors.foreground }}
          >
            Confirm password
          </Text>
          <TextInput
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              setError(null);
            }}
            placeholder="Repeat new password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            editable={!loading && !success}
            className="rounded-xl border px-4 py-3 mb-6"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Pressable
            onPress={handleReset}
            disabled={!canSubmit}
            className="rounded-xl py-3.5 items-center justify-center mb-4"
            style={{
              backgroundColor: canSubmit ? colors.primary : colors.muted,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold" style={{ color: "#fff" }}>
                Reset password
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center items-center gap-2">
            <Text style={{ color: colors.muted }}>Remember your password?</Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  Sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
