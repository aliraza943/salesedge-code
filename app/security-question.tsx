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

const DEFAULT_QUESTION = "What city were you born in?";

export default function SecurityQuestionScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; securityQuestion?: string }>();
  const email = (params.email ?? "").trim().toLowerCase();
  const securityQuestion = (params.securityQuestion ?? DEFAULT_QUESTION).trim();

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) {
      router.replace("/forgot-password");
    }
  }, [email, router]);

  const handleSubmit = async () => {
    setError(null);
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError("Please enter your answer.");
      return;
    }

    setSubmitting(true);
    try {
      const { resetToken } = await Api.verifySecurityAnswer(email, trimmedAnswer);
      router.replace({ pathname: "/reset-password", params: { resetToken } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect answer. Please try again.");
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
            Security question
          </Text>
          <Text
            className="text-base mb-8"
            style={{ color: colors.muted }}
          >
            Answer the question you set during signup to continue resetting your password.
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
            {securityQuestion}
          </Text>
          <TextInput
            value={answer}
            onChangeText={(t) => {
              setAnswer(t);
              setError(null);
            }}
            placeholder="Your answer"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            editable={!loading}
            className="rounded-xl border px-4 py-3 mb-6"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !answer.trim()}
            className="rounded-xl py-3.5 items-center justify-center mb-4"
            style={{
              backgroundColor: loading || !answer.trim() ? colors.muted : colors.primary,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold" style={{ color: "#fff" }}>
                Continue
              </Text>
            )}
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
