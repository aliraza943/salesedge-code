import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList, Text, View, TextInput, Pressable, TouchableOpacity, StyleSheet, Platform,
  KeyboardAvoidingView, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import { trpc } from "@/lib/trpc";
import type { LocalChatMessage } from "@/lib/local-store";
import { getLocalTodayStr, getUserTimezone } from "@/lib/timezone";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    events, rfps, deals, chatMessages, brokers,
    createEvent, createRfp, createDeal,
    addChatMessage, clearChat, refreshAll,
  } = useData();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  // Web-native MediaRecorder refs for web voice recording
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const voiceTranscribe = trpc.voice.transcribe.useMutation();
  const publicChat = trpc.publicChat.send.useMutation();

  // ─── Refs for stable sendMessage (avoids dependency loop) ───
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const rfpsRef = useRef(rfps);
  rfpsRef.current = rfps;
  const dealsRef = useRef(deals);
  dealsRef.current = deals;
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  const brokersRef = useRef(brokers);
  brokersRef.current = brokers;
  const sendingRef = useRef(sending);
  sendingRef.current = sending;

  // Request mic permission on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") return;
      const status = await requestRecordingPermissionsAsync();
      setHasPermission(status.granted);
      if (status.granted) {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      }
    })();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatMessages.length]);

  // ─── Execute AI Actions ─────────────────────────────

  const executeActions = useCallback(
    async (actions: Array<{ type: string; data: Record<string, unknown> }>) => {
      for (const action of actions) {
        try {
          const d = action.data;
          if (!d) continue;
          switch (action.type) {
            case "create_event": {
              await createEvent({
                title: String(d.title || "Untitled Event"),
                description: d.description ? String(d.description) : undefined,
                date: String(d.date || new Date().toISOString().split("T")[0]),
                startTime: d.startTime ? String(d.startTime) : undefined,
                endTime: d.endTime ? String(d.endTime) : undefined,
                reminderMinutes: typeof d.reminderMinutes === "number" ? d.reminderMinutes : 15,
              });
              break;
            }
            case "create_rfp": {
              await createRfp({
                title: String(d.title || "Untitled RFP"),
                client: String(d.client || d.clientName || "Unknown"),
                brokerContact: d.brokerContact ? String(d.brokerContact) : undefined,
                lives: typeof d.lives === "number" ? d.lives : undefined,
                effectiveDate: d.effectiveDate ? String(d.effectiveDate) : (d.deadline ? String(d.deadline) : undefined),
                premium: d.premium ? String(d.premium) : (d.estimatedValue ? String(d.estimatedValue) : undefined),
                status: (d.status === "draft" || d.status === "recommended" || d.status === "sold") ? d.status : "draft",
                notes: d.notes ? String(d.notes) : undefined,
                description: d.description ? String(d.description) : undefined,
              });
              break;
            }
            case "create_deal": {
              await createDeal({
                title: String(d.title || "Untitled Deal"),
                client: String(d.client || d.clientName || "Unknown"),
                stage: (d.stage as any) || "lead",
                value: d.value ? String(d.value) : undefined,
                expectedCloseDate: d.expectedCloseDate ? String(d.expectedCloseDate) : undefined,
                description: d.description ? String(d.description) : undefined,
              });
              break;
            }
          }
        } catch (err) {
          console.warn("[Chat] Failed to execute action:", action.type, err);
        }
      }
    },
    [createEvent, createRfp, createDeal]
  );

  // ─── Send Message (stable — uses refs for data context) ───

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sendingRef.current) return;
      const msg = text.trim();
      setInput("");
      setSending(true);

      try {
        // Add user message to local chat
        await addChatMessage({ role: "user", content: msg });

        // Get user's local date and timezone to ensure correct date calculations
        const localDate = getLocalTodayStr();
        const timezone = getUserTimezone();

        // Snapshot current data via refs (avoids stale closure AND avoids dependency churn)
        const currentEvents = eventsRef.current;
        const currentRfps = rfpsRef.current;
        const currentDeals = dealsRef.current;
        const currentBrokers = brokersRef.current;
        const currentChatMessages = chatMessagesRef.current;

        // Send to AI with context (including brokers with their conversation notes)
        const result = await publicChat.mutateAsync({
          message: msg,
          events: JSON.stringify(currentEvents.slice(0, 30)),
          rfps: JSON.stringify(currentRfps.slice(0, 20)),
          deals: JSON.stringify(currentDeals.slice(0, 20)),
          brokers: JSON.stringify(currentBrokers.map(b => ({
            name: b.name,
            company: b.company,
            notes: (b.notes || []).slice(-10).map(n => ({ content: n.content, createdAt: n.createdAt })),
          }))),
          chatHistory: JSON.stringify(
            currentChatMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
          ),
          localDate,
          timezone,
        });

        // Execute any actions
        if (result.actions && result.actions.length > 0) {
          await executeActions(result.actions);
        }

        // Add AI response to local chat
        await addChatMessage({
          role: "assistant",
          content: result.message,
          actions: result.actions?.map((a) => ({ type: a.type, data: a.data })),
        });

        // NOTE: Don't call refreshAll() here — createEvent/createRfp/createDeal
        // already updated local state. Calling refreshAll would fetch from server
        // before the sync completes, overwriting the just-created items with stale data.
      } catch (err) {
        console.error("[Chat] Send failed:", err);
        await addChatMessage({
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
        });
      } finally {
        setSending(false);
      }
    },
    [addChatMessage, publicChat, executeActions]
  );

  // ─── Voice Recording ────────────────────────────────

  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") {
      // Use native MediaRecorder API on web
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) webChunksRef.current.push(e.data);
        };
        recorder.start();
        webMediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (webErr) {
        console.error("[Chat] Web recording failed:", webErr);
        Alert.alert("Microphone Error", "Could not access microphone. Please allow microphone access in your browser settings and try again.");
      }
      return;
    }
    if (!hasPermission) {
      const status = await requestRecordingPermissionsAsync();
      setHasPermission(status.granted);
      if (!status.granted) return;
    }
    try {
      if ((Platform.OS as string) !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(true);
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      console.error("[Chat] Recording failed:", err);
      setIsRecording(false);
    }
  }, [hasPermission, audioRecorder]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      setSending(true);

      let audioBase64: string;
      let mimeType = "audio/webm";

      if (Platform.OS === "web" && webMediaRecorderRef.current) {
        // Stop web MediaRecorder and collect blob
        const recorder = webMediaRecorderRef.current;
        const blob = await new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(webChunksRef.current, { type: "audio/webm" }));
          };
          recorder.stop();
        });
        // Stop all tracks
        recorder.stream.getTracks().forEach((t) => t.stop());
        webMediaRecorderRef.current = null;

        audioBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] || "");
          };
          reader.readAsDataURL(blob);
        });
      } else {
        await audioRecorder.stop();
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const uri = audioRecorder.uri;
        if (!uri) {
          setSending(false);
          return;
        }
        audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        mimeType = Platform.OS === "ios" ? "audio/mp4" : "audio/webm";
      }

      const transcription = await voiceTranscribe.mutateAsync({
        audioBase64,
        mimeType,
      });

      if (transcription.text && transcription.text !== "Transcription failed") {
        await sendMessage(transcription.text);
      } else {
        setSending(false);
      }
    } catch (err) {
      console.error("[Chat] Transcription failed:", err);
      setIsRecording(false);
      setSending(false);
    }
  }, [audioRecorder, voiceTranscribe, sendMessage]);

  // ─── Clear Chat ─────────────────────────────────────

  const handleClearChat = useCallback(() => {
    Alert.alert("Clear Chat", "Delete all messages?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearChat() },
    ]);
  }, [clearChat]);

  // ─── Render Message ─────────────────────────────────

  const renderMessage = useCallback(
    ({ item }: { item: LocalChatMessage }) => {
      const isUser = item.role === "user";
      return (
        <View className={`px-4 py-1 ${isUser ? "items-end" : "items-start"}`}>
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: isUser ? colors.primary : colors.surface,
                borderBottomRightRadius: isUser ? 4 : 18,
                borderBottomLeftRadius: isUser ? 18 : 4,
              },
            ]}
          >
            <Text
              className="text-[15px] leading-[22px]"
              style={{ color: isUser ? "#FFFFFF" : colors.foreground }}
            >
              {item.content}
            </Text>
          </View>
          {/* Action badges */}
          {item.actions && item.actions.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1 px-1">
              {item.actions.map((action, idx) => {
                const label =
                  action.type === "create_event" ? "Event Created" :
                  action.type === "create_rfp" ? "RFP Created" :
                  action.type === "create_deal" ? "Deal Created" : action.type;
                const badgeColor =
                  action.type === "create_event" ? colors.primary :
                  action.type === "create_rfp" ? colors.warning : colors.success;
                return (
                  <View
                    key={idx}
                    className="flex-row items-center px-2 py-1 rounded-lg"
                    style={{ backgroundColor: badgeColor + "15" }}
                  >
                    <IconSymbol
                      name={
                        action.type === "create_event" ? "calendar" :
                        action.type === "create_rfp" ? "doc.text.fill" : "chart.line.uptrend.xyaxis"
                      }
                      size={12}
                      color={badgeColor}
                    />
                    <Text className="text-xs font-medium ml-1" style={{ color: badgeColor }}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      );
    },
    [colors]
  );

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-3">
        <View>
          <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>
            AI Assistant
          </Text>
          <Text className="text-xs" style={{ color: colors.muted }}>
            Tell me what's on your plate
          </Text>
        </View>
        {chatMessages.length > 0 && (
          <TouchableOpacity
            onPress={() => { haptic(); handleClearChat(); }}
            activeOpacity={0.6}
          >
            <IconSymbol name="trash.fill" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {chatMessages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: colors.primary + "15" }}
            >
              <IconSymbol name="mic.fill" size={28} color={colors.primary} />
            </View>
            <Text className="text-xl font-bold text-center mb-2" style={{ color: colors.foreground }}>
              Your AI Secretary
            </Text>
            <Text className="text-sm text-center leading-5" style={{ color: colors.muted }}>
              Just tell me what you need — meetings, reminders, RFPs, deals. I'll handle the rest.
            </Text>
            <View className="mt-6 gap-2 w-full">
              {[
                "I have a meeting with John tomorrow at 3",
                "Remind me to call Sarah on Friday",
                "New RFP from Smith, 200 lives, July 1st",
                "What's on my schedule this week?",
              ].map((suggestion, i) => (
                <Pressable
                  key={i}
                  onPress={() => { haptic(); sendMessage(suggestion); }}
                  style={({ pressed }) => [
                    styles.suggestion,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text className="text-sm" style={{ color: colors.foreground }}>
                    "{suggestion}"
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Typing indicator */}
        {sending && (
          <View className="px-4 py-2 items-start">
            <View
              className="flex-row items-center rounded-2xl px-4 py-3"
              style={{ backgroundColor: colors.surface }}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-sm ml-2" style={{ color: colors.muted }}>
                Thinking...
              </Text>
            </View>
          </View>
        )}

        {/* Input Bar */}
        <View
          className="flex-row items-end px-4 py-3 border-t"
          style={{
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          {/* Voice Button */}
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            disabled={sending}
            style={({ pressed }) => [
              styles.voiceBtn,
              {
                backgroundColor: isRecording ? colors.error : colors.primary,
                opacity: pressed ? 0.9 : sending ? 0.5 : 1,
                transform: [{ scale: isRecording ? 1.1 : pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <IconSymbol name={isRecording ? "stop.fill" : "mic.fill"} size={22} color="#FFFFFF" />
          </Pressable>

          {/* Recording indicator */}
          {isRecording ? (
            <View className="flex-1 mx-2 items-center justify-center" style={{ minHeight: 44 }}>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: colors.error }} />
                <Text className="text-sm font-medium" style={{ color: colors.error }}>
                  Recording... Tap mic to stop
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Text Input */}
              <View
                className="flex-1 flex-row items-end mx-2 rounded-2xl px-4 py-2"
                style={{ backgroundColor: colors.surface, minHeight: 44, maxHeight: 120 }}
              >
                <TextInput
                  className="flex-1 text-[15px]"
                  style={{ color: colors.foreground, maxHeight: 100, paddingVertical: 6 }}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.muted}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={() => sendMessage(input)}
                  editable={!sending}
                />
              </View>

              {/* Send Button */}
              <TouchableOpacity
                onPress={() => { haptic(); sendMessage(input); }}
                disabled={!input.trim() || sending}
                activeOpacity={0.8}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: input.trim() ? colors.primary : colors.muted + "30",
                  },
                ]}
              >
                <IconSymbol name="paperplane.fill" size={18} color={input.trim() ? "#FFFFFF" : colors.muted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "85%",
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestion: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
