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

export default function VerifyOTPScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email ?? "").trim().toLowerCase();

  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) {
      router.replace("/forgot-password");
    }
  }, [email, router]);

  const handleVerify = async () => {
    setError(null);
    const digits = otp.replace(/\s/g, "");
    if (!digits) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    if (!/^\d{6}$/.test(digits)) {
      setError("Code must be exactly 6 digits.");
      return;
    }

    setSubmitting(true);
    try {
      const { resetToken } = await Api.verifyOtp(email, digits);
      router.replace({ pathname: "/reset-password", params: { resetToken } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await Api.requestForgotPasswordOtp(email);
      setError(null);
      setOtp("");
      // Optional: show a small success toast; for now just clear error
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code. Try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = submitting;

  if (!email) {
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
            Enter verification code
          </Text>
          <Text
            className="text-base mb-8"
            style={{ color: colors.muted }}
          >
            We sent a 6-digit code to {email}. Enter it below. The code expires in 10 minutes.
          </Text>

          {error && (
            <View
              className="mb-4 p-3 rounded-lg"
              style={{ backgroundColor: (colors.error || "#dc2626") + "20" }}
            >
              <Text style={{ color: colors.error || "#dc2626" }}>{error}</Text>
            </View>
          )}

          <Text
            className="text-sm font-medium mb-2"
            style={{ color: colors.foreground }}
          >
            Verification code
          </Text>
          <TextInput
            value={otp}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, "").slice(0, 6);
              setOtp(digits);
              setError(null);
            }}
            placeholder="000000"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            className="rounded-xl border px-4 py-3 mb-6 text-center text-lg tracking-widest"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Pressable
            onPress={handleVerify}
            disabled={loading || otp.length !== 6}
            className="rounded-xl py-3.5 items-center justify-center mb-4"
            style={{
              backgroundColor:
                loading || otp.length !== 6 ? colors.muted : colors.primary,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold" style={{ color: "#fff" }}>
                Verify code
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleResend}
            disabled={loading}
            className="py-2 mb-4"
          >
            <Text
              style={{
                color: loading ? colors.muted : colors.primary,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              Didn't get the code? Resend
            </Text>
          </Pressable>

          <View className="flex-row justify-center items-center gap-2">
            <Text style={{ color: colors.muted }}>Back to</Text>
            <Link href="/forgot-password" asChild>
              <Pressable>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  Forgot password
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
