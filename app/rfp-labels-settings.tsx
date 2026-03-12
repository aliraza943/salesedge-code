import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import {
  RFP_FIELD_LABEL_KEYS,
  DEFAULT_RFP_FIELD_LABELS,
  type RfpFieldLabelKey,
} from "@/constants/rfp-field-labels";

export default function RfpLabelsSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { rfpFieldLabels, updateRfpFieldLabels, isCloudMode } = useData();

  const [values, setValues] = useState<Record<RfpFieldLabelKey, string>>(() => ({
    ...DEFAULT_RFP_FIELD_LABELS,
  }));
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Sync from context when labels load (e.g. after login)
  useEffect(() => {
    const next: Record<RfpFieldLabelKey, string> = { ...DEFAULT_RFP_FIELD_LABELS };
    for (const key of RFP_FIELD_LABEL_KEYS) {
      const effective = rfpFieldLabels[key];
      if (effective != null) next[key] = effective;
    }
    setValues(next);
    setLoaded(true);
  }, [rfpFieldLabels]);

  const handleChange = (key: RfpFieldLabelKey, text: string) => {
    setValues((prev) => ({ ...prev, [key]: text }));
  };

  const handleSave = async () => {
    if (!isCloudMode) {
      Alert.alert("Not available", "Sign in to save custom labels.");
      return;
    }
    setSaving(true);
    try {
      const overrides: Partial<Record<RfpFieldLabelKey, string>> = {};
      for (const key of RFP_FIELD_LABEL_KEYS) {
        const trimmed = values[key]?.trim() ?? "";
        const isDefault = trimmed === DEFAULT_RFP_FIELD_LABELS[key];
        if (trimmed && !isDefault) {
          overrides[key] = trimmed;
        }
      }
      await updateRfpFieldLabels(overrides);
      Alert.alert("Saved", "Your RFP field labels have been updated.");
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to save labels. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValues({ ...DEFAULT_RFP_FIELD_LABELS });
  };

  return (
    <ScreenContainer className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: colors.surface }]}
            >
              <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>
              RFP Field Labels
            </Text>
          </View>

          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Customize the labels shown on RFP forms. Data and database keys stay the same; only the display text changes. Leave a field as default or enter your own (e.g. "Members" instead of "Lives").
          </Text>

          {!loaded ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {RFP_FIELD_LABEL_KEYS.map((key, index) => (
                <View
                  key={key}
                  style={[
                    styles.row,
                    index < RFP_FIELD_LABEL_KEYS.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.keyLabel, { color: colors.muted }]} numberOfLines={1}>
                    {key}
                  </Text>
                  <TextInput
                    value={values[key]}
                    onChangeText={(text) => handleChange(key, text)}
                    placeholder={DEFAULT_RFP_FIELD_LABELS[key]}
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.input,
                      {
                        color: colors.foreground,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    editable={!saving}
                  />
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={handleReset}
              disabled={saving}
              style={[styles.secondaryButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                Reset to defaults
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={saving || !isCloudMode}
              style={[
                styles.primaryButton,
                { backgroundColor: isCloudMode ? colors.primary : colors.muted },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save labels</Text>
              )}
            </Pressable>
          </View>

          {!isCloudMode && (
            <Text style={[styles.hint, { color: colors.muted }]}>
              Sign in to save your custom labels across devices.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  loading: {
    padding: 24,
    alignItems: "center",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  keyLabel: {
    fontSize: 13,
    width: 120,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  hint: {
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
  },
});
