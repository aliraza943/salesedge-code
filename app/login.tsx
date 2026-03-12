import { useRouter, Link, Redirect } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, login, error: authError, loading: authLoading } = useAuth({ autoFetch: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert("Missing fields", "Please enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(trimmedEmail, password);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert(
        "Login failed",
        err instanceof Error ? err.message : "Invalid email or password. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const loading = authLoading || submitting;

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
            Welcome back
          </Text>
          <Text
            className="text-base mb-8"
            style={{ color: colors.muted }}
          >
            Sign in with your email and password
          </Text>

          {authError && (
            <View
              className="mb-4 p-3 rounded-lg"
              style={{ backgroundColor: (colors.error || "#dc2626") + "20" }}
            >
              <Text style={{ color: colors.error || "#dc2626" }}>
                {authError.message}
              </Text>
            </View>
          )}

          <Text
            className="text-sm font-medium mb-2"
            style={{ color: colors.foreground }}
          >
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
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
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            editable={!loading}
            className="rounded-xl border px-4 py-3 text-base mb-6"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="rounded-xl py-3.5 items-center justify-center mb-4"
            style={{
              backgroundColor: loading ? colors.muted : colors.primary,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold" style={{ color: "#fff" }}>
                Sign in
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center items-center gap-2">
            <Text style={{ color: colors.muted }}>Don't have an account?</Text>
            <Link href="/sign-up" asChild>
              <Pressable>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  Sign up
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
