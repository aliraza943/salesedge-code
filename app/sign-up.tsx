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

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, signUp, error: authError, loading: authLoading } = useAuth({ autoFetch: true });
  const [name, setName] = useState("abc");
  const [username, setUsername] = useState("abcd");
  const [email, setEmail] = useState("abc@gmail.com");
  const [password, setPassword] = useState("Testme123");
  const [confirmPassword, setConfirmPassword] = useState("Testme123");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSignUp = async () => {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedUsername || !trimmedEmail || !password || !confirmPassword) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", "Please make sure Password and Confirm Password match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Please use at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp({
        name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        password,
        confirmPassword,
      });
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert(
        "Sign up failed",
        err instanceof Error ? err.message : "Something went wrong. Please try again."
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
            padding: 24,
            paddingTop: 48,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            className="text-2xl font-bold mb-1"
            style={{ color: colors.foreground }}
          >
            Create account
          </Text>
          <Text
            className="text-base mb-8"
            style={{ color: colors.muted }}
          >
            Sign up with your details
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

          <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
            Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            editable={!loading}
            className="rounded-xl border px-4 py-3 text-base mb-4"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
            Username
          </Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            className="rounded-xl border px-4 py-3 text-base mb-4"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
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
            className="rounded-xl border px-4 py-3 text-base mb-4"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry
            editable={!loading}
            className="rounded-xl border px-4 py-3 text-base mb-4"
            style={{
              borderColor: colors.border,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />

          <Text className="text-sm font-medium mb-2" style={{ color: colors.foreground }}>
            Confirm Password
          </Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
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
            onPress={handleSignUp}
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
                Create account
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center items-center gap-2">
            <Text style={{ color: colors.muted }}>Already have an account?</Text>
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
