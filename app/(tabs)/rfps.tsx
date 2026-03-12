import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  FlatList,
  Text,
  View,
  Pressable,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useData } from "@/lib/data-provider";
import type { LocalRfp } from "@/lib/local-store";
import { AIConsentStore } from "@/lib/local-store";
import { AIConsentModal } from "@/components/AIConsentModal";
import { getApiBaseUrl } from "@/constants/oauth";
import { parseLocalDate, formatDateMedium } from "@/lib/timezone";

type RfpStatus = "draft" | "recommended" | "sold";

const STAGE_ORDER: RfpStatus[] = ["draft", "recommended", "sold"];

function getStatusColor(status: string, colors: any) {
  switch (status) {
    case "draft": return colors.muted;
    case "recommended": return colors.warning;
    case "sold": return colors.success;
    default: return colors.muted;
  }
}

function getStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getNextStage(current: RfpStatus): RfpStatus | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < STAGE_ORDER.length - 1) return STAGE_ORDER[idx + 1];
  return null;
}

function formatCurrency(value: string | null | undefined) {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  try {
    return formatDateMedium(dateStr);
  } catch {
    return dateStr;
  }
}

// Simple calendar date picker component
function DatePicker({
  value,
  onChange,
  colors,
  onClose,
}: {
  value: string;
  onChange: (date: string) => void;
  colors: any;
  onClose: () => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      const d = new Date(value + "T12:00:00");
      return d.getFullYear();
    }
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const d = new Date(value + "T12:00:00");
      return d.getMonth();
    }
    return today.getMonth();
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const selectDate = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    onClose();
  };

  const allCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) allCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) allCells.push(d);
  while (allCells.length % 7 !== 0) allCells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    rows.push(allCells.slice(i, i + 7));
  }

  const selectedDay = value ? (() => {
    const d = new Date(value + "T12:00:00");
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) return d.getDate();
    return null;
  })() : null;

  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : null;

  const ROW_HEIGHT = 44;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => {
            if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
            else { setViewMonth(viewMonth - 1); }
          }}
          activeOpacity={0.5}
          style={{ padding: 10, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="chevron.left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
          {monthNames[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
            else { setViewMonth(viewMonth + 1); }
          }}
          activeOpacity={0.5}
          style={{ padding: 10, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <IconSymbol name="chevron.right" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {dayNames.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: "center", height: 24, justifyContent: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted }}>{d}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", height: ROW_HEIGHT }}>
          {row.map((day, colIdx) => (
            <View key={colIdx} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {day ? (
                <TouchableOpacity
                  onPress={() => selectDate(day)}
                  activeOpacity={0.5}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: day === selectedDay ? colors.primary : "transparent",
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    lineHeight: 20,
                    fontWeight: day === todayDay || day === selectedDay ? "600" : "400",
                    color: day === selectedDay ? "#FFFFFF" : day === todayDay ? colors.primary : colors.foreground,
                  }}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      ))}

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderColor: colors.border }}>
        <TouchableOpacity
          onPress={() => { onChange(""); onClose(); }}
          activeOpacity={0.5}
          style={{ padding: 10, minWidth: 60 }}
        >
          <Text style={{ fontSize: 15, color: colors.error }}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const mm = String(today.getMonth() + 1).padStart(2, "0");
            const dd = String(today.getDate()).padStart(2, "0");
            onChange(`${today.getFullYear()}-${mm}-${dd}`);
            onClose();
          }}
          activeOpacity={0.5}
          style={{ padding: 10, minWidth: 60, alignItems: "flex-end" }}
        >
          <Text style={{ fontSize: 15, color: colors.primary }}>Today</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RfpsScreen() {
  const colors = useColors();
  const { rfps, brokers, refreshAll, createRfp, updateRfp: updateRfpData, deleteRfp: deleteRfpData, salesGoal, updateSalesGoal, createEvent, getOrCreateBroker, updateBroker, getRfpLabel } = useData();

  const [showConsentModal, setShowConsentModal] = useState(false);
  const pendingVoiceTarget = useRef<"create" | "edit" | null>(null);
  const [detailRfp, setDetailRfp] = useState<LocalRfp | null>(null);
  const [editingRfp, setEditingRfp] = useState<LocalRfp | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const consentJustAcceptedRef = useRef(false);
  // Create form state
  const [formCase, setFormCase] = useState("");
  const [formBroker, setFormBroker] = useState("");
  const [formBrokerContact, setFormBrokerContact] = useState("");
  const [formLives, setFormLives] = useState("");
  const [formEffectiveDate, setFormEffectiveDate] = useState("");
  const [formPremium, setFormPremium] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [formFollowUpDate, setFormFollowUpDate] = useState("");
  const [showCreateFollowUpPicker, setShowCreateFollowUpPicker] = useState(false);
  const [fieldsVisible, setFieldsVisible] = useState(false);

  // Edit form state
  const [editCase, setEditCase] = useState("");
  const [editBroker, setEditBroker] = useState("");
  const [editBrokerContact, setEditBrokerContact] = useState("");
  const [editLives, setEditLives] = useState("");
  const [editEffectiveDate, setEditEffectiveDate] = useState("");
  const [editPremium, setEditPremium] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<RfpStatus>("draft");
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editFollowUpDate, setEditFollowUpDate] = useState("");
  const [showEditFollowUpPicker, setShowEditFollowUpPicker] = useState(false);
  const [showDetailFollowUpPicker, setShowDetailFollowUpPicker] = useState(false);

  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"create" | "edit" | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Autocomplete state
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [showEditContactSuggestions, setShowEditContactSuggestions] = useState(false);

  // Stage transition animation
  const [movingRfpId, setMovingRfpId] = useState<string | null>(null);

  // Validation errors (keyed by field key, not label)
  const [createErrors, setCreateErrors] = useState<Partial<Record<string, string>>>({});
  const [editErrors, setEditErrors] = useState<Partial<Record<string, string>>>({});

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  // Load AI consent preference on mount
  useEffect(() => {
    (async () => {
      // await AIConsentStore.reset()
      const consent = await AIConsentStore.hasConsent();
      console.log("[RFPs] Loaded consent from storage:", consent);
      setAiConsent(consent);
      setConsentChecked(true);
    })();
  }, []);

  // Group RFPs by stage
  const groupedRfps = useMemo(() => {
    const groups: Record<RfpStatus, LocalRfp[]> = {
      draft: [],
      recommended: [],
      sold: [],
    };
    rfps.forEach((r: any) => {
      if (groups[r.status as RfpStatus]) {
        groups[r.status as RfpStatus].push(r);
      }
    });
    return groups;
  }, [rfps]);

  const resetCreateForm = () => {
    setFormCase("");
    setFormBroker("");
    setFormBrokerContact("");
    setFormLives("");
    setFormEffectiveDate("");
    setFormPremium("");
    setFormNotes("");
    setFormFollowUpDate("");
    setFieldsVisible(false);
    setCreateErrors({});
  };

  // Validation: use field keys; error messages use getRfpLabel for display consistency
  const validateRfpForm = useCallback(
    (values: {
      case: string;
      brokerage: string;
      brokerageContact: string;
      lives: string;
      effectiveDate: string;
      premium: string;
      followUpDate: string;
    }): Partial<Record<string, string>> => {
      const errors: Partial<Record<string, string>> = {};
      const caseVal = values.case.trim();
      const brokerageVal = values.brokerage.trim();
      const livesVal = values.lives.trim();
      const effectiveDateVal = values.effectiveDate.trim();
      const premiumVal = values.premium.trim();
      const followUpDateVal = values.followUpDate.trim();

      if (!caseVal) {
        errors.case = `${getRfpLabel("case")} is required.`;
      }
      if (!brokerageVal) {
        errors.brokerage = `${getRfpLabel("brokerage")} is required.`;
      }
      if (!livesVal) {
        errors.lives = `${getRfpLabel("lives")} is required.`;
      } else {
        const n = parseInt(livesVal, 10);
        if (Number.isNaN(n) || n < 1 || String(n) !== livesVal) {
          errors.lives = `${getRfpLabel("lives")} must be a positive whole number.`;
        }
      }
      if (!effectiveDateVal) {
        errors.effectiveDate = `${getRfpLabel("effectiveDate")} is required.`;
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDateVal)) {
          errors.effectiveDate = `${getRfpLabel("effectiveDate")} must be a valid date (YYYY-MM-DD).`;
        } else {
          const d = new Date(effectiveDateVal + "T12:00:00");
          if (Number.isNaN(d.getTime())) {
            errors.effectiveDate = `${getRfpLabel("effectiveDate")} must be a valid date.`;
          }
        }
      }
      if (!premiumVal) {
        errors.premium = `${getRfpLabel("premium")} is required.`;
      } else {
        const num = parseFloat(premiumVal.replace(/[^0-9.-]/g, ""));
        if (Number.isNaN(num) || num <= 0) {
          errors.premium = `${getRfpLabel("premium")} must be a valid positive number.`;
        }
      }
      if (followUpDateVal) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(followUpDateVal)) {
          errors.followUpDate = `${getRfpLabel("followUpDate")} must be a valid date (YYYY-MM-DD).`;
        } else {
          const followD = new Date(followUpDateVal + "T12:00:00");
          if (Number.isNaN(followD.getTime())) {
            errors.followUpDate = `${getRfpLabel("followUpDate")} must be a valid date.`;
          } else if (effectiveDateVal) {
            const effD = new Date(effectiveDateVal + "T12:00:00");
            if (!Number.isNaN(effD.getTime()) && followD < effD) {
              errors.followUpDate = `${getRfpLabel("followUpDate")} cannot be earlier than ${getRfpLabel("effectiveDate")}.`;
            }
          }
        }
      }
      return errors;
    },
    [getRfpLabel]
  );

  const handleCreate = useCallback(async () => {
    const values = {
      case: formCase,
      brokerage: formBroker,
      brokerageContact: formBrokerContact,
      lives: formLives,
      effectiveDate: formEffectiveDate,
      premium: formPremium,
      followUpDate: formFollowUpDate,
    };
    const errors = validateRfpForm(values);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }
    setCreateErrors({});
    setIsSavingCreate(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const newRfp = await createRfp({
        title: formCase.trim(),
        client: formBroker.trim(),
        brokerContact: formBrokerContact.trim() || undefined,
        lives: parseInt(formLives.trim(), 10),
        effectiveDate: formEffectiveDate.trim(),
        premium: formPremium.trim(),
        status: "draft",
        notes: formNotes.trim() || undefined,
        followUpDate: formFollowUpDate.trim() || undefined,
      });

      // Auto-create or update broker contact in Brokers tab
      // The broker contact (person) becomes the broker entry, with the brokerage as their company
      if (formBrokerContact.trim()) {
        const broker = await getOrCreateBroker(formBrokerContact.trim());
        // Set the brokerage as the company if not already set
        if (formBroker.trim() && !broker.company) {
          await updateBroker(broker.id, { company: formBroker.trim() });
        }
      }

      // Auto-create calendar event for follow-up
      if (formFollowUpDate.trim()) {
        await createEvent({
          title: `Follow up: ${newRfp.title}`,
          description: `RFP follow-up for case: ${newRfp.title} | Brokerage: ${newRfp.client}`,
          date: formFollowUpDate.trim(),
          startTime: "09:00",
          reminderMinutes: 15,
          sourceType: "follow-up",
          sourceRfpId: newRfp.id,
        });
      }

      await refreshAll();
      setShowCreate(false);
      resetCreateForm();
    } catch (err) {
      Alert.alert("Error", "Failed to save RFP. Please try again.");
    } finally {
      setIsSavingCreate(false);
    }
  }, [formCase, formBroker, formBrokerContact, formLives, formEffectiveDate, formPremium, formNotes, formFollowUpDate, refreshAll, createRfp, createEvent, getOrCreateBroker, updateBroker, validateRfpForm]);

  const handleUpdate = useCallback(async () => {
    if (!editingRfp) return;
    const values = {
      case: editCase,
      brokerage: editBroker,
      brokerageContact: editBrokerContact,
      lives: editLives,
      effectiveDate: editEffectiveDate,
      premium: editPremium,
      followUpDate: editFollowUpDate,
    };
    const errors = validateRfpForm(values);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    setIsSavingUpdate(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const wasNotSold = editingRfp.status !== "sold";
    const isNowSold = editStatus === "sold";

    const oldFollowUp = editingRfp.followUpDate || "";
    const newFollowUp = editFollowUpDate.trim();

    try {
      await updateRfpData(editingRfp.id, {
        title: editCase.trim() || undefined,
        client: editBroker.trim() || undefined,
        brokerContact: editBrokerContact.trim(),
        lives: editLives.trim() ? parseInt(editLives.trim(), 10) : undefined,
        effectiveDate: editEffectiveDate.trim(),
        premium: editPremium.trim(),
        notes: editNotes.trim(),
        followUpDate: newFollowUp || undefined,
        status: editStatus,
      });

      // Auto-create calendar event if follow-up date changed
      const caseName = editCase.trim() || editingRfp.title;
      const brokerName = editBroker.trim() || editingRfp.client;
      if (newFollowUp && newFollowUp !== oldFollowUp) {
        await createEvent({
          title: `Follow up: ${caseName}`,
          description: `RFP follow-up for case: ${caseName} | Brokerage: ${brokerName}`,
          date: newFollowUp,
          startTime: "09:00",
          reminderMinutes: 15,
          sourceType: "follow-up",
          sourceRfpId: editingRfp.id,
        });
      }

      if (wasNotSold && isNowSold) {
        const premiumStr = editPremium.trim() || editingRfp.premium || "";
        const premiumNum = parseFloat(premiumStr.replace(/[^0-9.-]/g, ""));
        if (!isNaN(premiumNum) && premiumNum > 0) {
          await updateSalesGoal({ addToCurrentSales: premiumNum });
        }
      }

      await refreshAll();
      setEditingRfp(null);
      setDetailRfp(null);
    } catch (err) {
      Alert.alert("Error", "Failed to update RFP. Please try again.");
    } finally {
      setIsSavingUpdate(false);
    }
  }, [editingRfp, editCase, editBroker, editBrokerContact, editLives, editEffectiveDate, editPremium, editNotes, editFollowUpDate, editStatus, refreshAll, updateRfpData, updateSalesGoal, createEvent, validateRfpForm]);

  const handleDelete = (rfp: LocalRfp) => {
    const doDelete = async () => {
      await deleteRfpData(rfp.id);
      await refreshAll();
      setDetailRfp(null);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    if (Platform.OS === "web") {
      doDelete();
    } else {
      Alert.alert("Delete RFP", `Delete "${rfp.title}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const openEdit = (rfp: LocalRfp) => {
    setEditingRfp(rfp);
    setEditCase(rfp.title);
    setEditBroker(rfp.client);
    setEditBrokerContact(rfp.brokerContact || "");
    setEditLives(rfp.lives != null ? String(rfp.lives) : "");
    setEditEffectiveDate(rfp.effectiveDate || "");
    setEditPremium(rfp.premium || "");
    setEditNotes(rfp.notes || "");
    setEditFollowUpDate(rfp.followUpDate || "");
    setEditStatus(rfp.status);
    setEditErrors({});
    setDetailRfp(null);
  };

  // Move RFP to next stage
  const handleMoveToNextStage = useCallback(async (rfp: LocalRfp) => {
    const nextStage = getNextStage(rfp.status);
    if (!nextStage) return;

    setMovingRfpId(rfp.id);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await updateRfpData(rfp.id, { status: nextStage });

    if (nextStage === "sold" && rfp.premium) {
      const premiumNum = parseFloat(rfp.premium.replace(/[^0-9.-]/g, ""));
      if (!isNaN(premiumNum) && premiumNum > 0) {
        await updateSalesGoal({ addToCurrentSales: premiumNum });
      }
    }

    await refreshAll();
    setTimeout(() => setMovingRfpId(null), 300);
  }, [updateRfpData, refreshAll, updateSalesGoal]);

  // Web-native MediaRecorder ref for fallback
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);

  // Voice recording
  const startVoiceRecording = async (target: "create" | "edit", consentAlreadyGranted = false) => {
    // Check if user has consented to AI data sharing before recording
    console.log("hellllo")
    console.log("!aiConsent", !aiConsent)
    console.log("hellllo", !consentJustAcceptedRef.current)

    if (!aiConsent && !consentJustAcceptedRef.current) {
      pendingVoiceTarget.current = target;
      setShowCreate(false)
      setShowConsentModal(true);
      return;
    }
    consentJustAcceptedRef.current = false;
    try {
      setVoiceTarget(target);

      if (Platform.OS === "web") {
        // Use native MediaRecorder API directly on web for reliability
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
          console.error("Web recording failed:", webErr);
          Alert.alert("Microphone Error", "Could not access microphone. Please allow microphone access in your browser settings and try again.");
          return;
        }
      } else {
        const status = await requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert("Permission Required", "Microphone access is needed for voice input.");
          return;
        }

        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        setIsRecording(true);

        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      console.error("Failed to start recording:", err);
      setIsRecording(false);
      Alert.alert("Error", "Could not start recording. Please try again.");
    }
  };

  const stopVoiceRecording = async () => {
    try {
      setIsRecording(false);
      setIsTranscribing(true);

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
        const uri = audioRecorder.uri;
        if (!uri) {
          setIsTranscribing(false);
          Alert.alert("Error", "No recording found.");
          return;
        }
        audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      }

      const apiBase = getApiBaseUrl();
      const transcribeRes = await fetch(`${apiBase}/api/trpc/voice.transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { audioBase64, mimeType } }),
      });

      const transcribeData = await transcribeRes.json();
      const transcribedText = transcribeData?.result?.data?.json?.text || "";

      if (!transcribedText) {
        setIsTranscribing(false);
        Alert.alert("Could not understand", "Please try speaking again more clearly.");
        return;
      }

      // Use AI to parse the transcribed text into RFP fields
      const parseRes = await fetch(`${apiBase}/api/trpc/rfpSummarize.summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { text: transcribedText } }),
      });

      const parseData = await parseRes.json();
      const parsed = parseData?.result?.data?.json;

      if (parsed) {
        const formatPremiumValue = (val: string | null) => {
          if (!val) return null;
          const num = parseFloat(val.replace(/[^0-9.-]/g, ""));
          if (isNaN(num)) return null;
          return String(num);
        };

        if (voiceTarget === "create") {
          if (parsed.title) setFormCase(parsed.title);
          if (parsed.client) setFormBroker(parsed.client);
          if (parsed.brokerContact) setFormBrokerContact(parsed.brokerContact);
          if (parsed.lives) setFormLives(String(parsed.lives));
          if (parsed.effectiveDate) setFormEffectiveDate(parsed.effectiveDate);
          const premVal = formatPremiumValue(parsed.premium);
          if (premVal) setFormPremium(premVal);
          if (parsed.followUpDate) setFormFollowUpDate(parsed.followUpDate);
          if (parsed.notes) setFormNotes(parsed.notes);
          // Show fields after voice input fills them
          setFieldsVisible(true);
        } else if (voiceTarget === "edit") {
          if (parsed.title) setEditCase(parsed.title);
          if (parsed.client) setEditBroker(parsed.client);
          if (parsed.brokerContact) setEditBrokerContact(parsed.brokerContact);
          if (parsed.lives) setEditLives(String(parsed.lives));
          if (parsed.effectiveDate) setEditEffectiveDate(parsed.effectiveDate);
          const premVal = formatPremiumValue(parsed.premium);
          if (premVal) setEditPremium(premVal);
          if (parsed.followUpDate) setEditFollowUpDate(parsed.followUpDate);
          if (parsed.notes) setEditNotes(parsed.notes);
        }
      }

      setIsTranscribing(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Voice transcription failed:", err);
      setIsRecording(false);
      setIsTranscribing(false);
      Alert.alert("Error", "Voice transcription failed. Please try again.");
    }
  };

  // Contact field with autocomplete from existing brokers
  const renderContactField = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    placeholder: string,
    showSuggestions: boolean,
    setShowSuggestions: (v: boolean) => void,
    error?: string,
    clearError?: () => void
  ) => {
    const q = value.toLowerCase().trim();
    const suggestions = q.length > 0
      ? brokers.filter((b) => b.name.toLowerCase().includes(q) && b.name.toLowerCase() !== q).slice(0, 5)
      : [];

    return (
      <View style={{ marginBottom: 14, zIndex: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 5 }}>{label}</Text>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.surface,
              borderColor: error ? colors.error : showSuggestions && suggestions.length > 0 ? colors.primary : colors.border,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.muted + "80"}
          value={value}
          onChangeText={(text) => {
            onChange(text);
            setShowSuggestions(true);
            clearError?.();
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          returnKeyType="done"
        />
        {error ? (
          <Text style={{ fontSize: 12, color: colors.error, marginTop: 4 }}>{error}</Text>
        ) : null}
        {showSuggestions && suggestions.length > 0 && (
          <View style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 4, overflow: "hidden" }}>
            {suggestions.map((b, idx) => (
              <TouchableOpacity
                key={b.id}
                onPress={() => {
                  onChange(b.name);
                  setShowSuggestions(false);
                }}
                activeOpacity={0.6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderBottomWidth: idx < suggestions.length - 1 ? 0.5 : 0,
                  borderColor: colors.border,
                  gap: 10,
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{b.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>{b.name}</Text>
                  {b.company ? <Text style={{ fontSize: 12, color: colors.muted }}>{b.company}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Shared form field renderer (error and clearError for validation UX)
  const renderFormField = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    placeholder: string,
    options?: { keyboardType?: "default" | "numeric"; multiline?: boolean },
    error?: string,
    clearError?: () => void
  ) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 5 }}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
            ...(options?.multiline ? { minHeight: 100, textAlignVertical: "top" as const } : {}),
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.muted + "80"}
        value={value}
        onChangeText={(text) => {
          onChange(text);
          clearError?.();
        }}
        keyboardType={options?.keyboardType || "default"}
        multiline={options?.multiline}
        returnKeyType={options?.multiline ? "default" : "done"}
      />
      {error ? (
        <Text style={{ fontSize: 12, color: colors.error, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );

  // Date field with calendar picker
  const renderDateField = (
    label: string,
    value: string,
    onChange: (t: string) => void,
    showPicker: boolean,
    setShowPicker: (v: boolean) => void,
    error?: string,
    clearError?: () => void
  ) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 5 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => {
          setShowPicker(!showPicker);
          clearError?.();
        }}
        activeOpacity={0.7}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : showPicker ? colors.primary : colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
      >
        <Text style={{ fontSize: 15, color: value ? colors.foreground : colors.muted + "80" }}>
          {value ? formatDate(value) : "Select a date"}
        </Text>
        <IconSymbol name="calendar" size={20} color={colors.primary} />
      </TouchableOpacity>
      {error ? (
        <Text style={{ fontSize: 12, color: colors.error, marginTop: 4 }}>{error}</Text>
      ) : null}
      {showPicker && (
        <View style={{ marginTop: 8 }}>
          <DatePicker value={value} onChange={(date) => { onChange(date); clearError?.(); }} colors={colors} onClose={() => setShowPicker(false)} />
        </View>
      )}
    </View>
  );

  // Parsed field preview card (shows after voice dictation)
  const renderParsedPreview = () => {
    const hasData = formCase || formBroker || formBrokerContact || formLives || formEffectiveDate || formPremium || formNotes;
    if (!hasData) return null;

    return (
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Parsed Fields</Text>
        </View>

        {/* Summary cards */}
        <View style={{ borderRadius: 12, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border, overflow: "hidden" }}>
          {formCase ? <PreviewRow label={getRfpLabel("case")} value={formCase} colors={colors} /> : null}
          {formBroker ? <PreviewRow label={getRfpLabel("brokerage")} value={formBroker} colors={colors} /> : null}
          {formBrokerContact ? <PreviewRow label={getRfpLabel("brokerageContact")} value={formBrokerContact} colors={colors} /> : null}
          {formLives ? <PreviewRow label={getRfpLabel("lives")} value={formLives} colors={colors} /> : null}
          {formEffectiveDate ? <PreviewRow label={getRfpLabel("effectiveDate")} value={formatDate(formEffectiveDate)} colors={colors} /> : null}
          {formPremium ? <PreviewRow label={getRfpLabel("premium")} value={formatCurrency(formPremium)} colors={colors} /> : null}
          {formFollowUpDate ? <PreviewRow label={getRfpLabel("followUpDate")} value={formatDate(formFollowUpDate)} colors={colors} /> : null}
          {formNotes ? <PreviewRow label={getRfpLabel("notes")} value={formNotes} colors={colors} last /> : null}
        </View>
      </View>
    );
  };

  // RFP card
  const renderRfpCard = useCallback(
    ({ item }: { item: LocalRfp }) => {
      const statusColor = getStatusColor(item.status, colors);
      const nextStage = getNextStage(item.status);
      const isMoving = movingRfpId === item.id;

      return (
        <Pressable
          onPress={() => setDetailRfp(item)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : isMoving ? 0.5 : 1 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 14, marginTop: 2, color: colors.muted }} numberOfLines={1}>
                {getRfpLabel("brokerage")}: {item.client}
              </Text>
            </View>
            <View style={{ borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: statusColor + "20" }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: statusColor }}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {item.lives != null && (
                <Text style={{ fontSize: 13, color: colors.muted }}>{item.lives} {getRfpLabel("lives")}</Text>
              )}
              {item.effectiveDate && (
                <Text style={{ fontSize: 13, color: colors.muted }}>Eff: {formatDate(item.effectiveDate)}</Text>
              )}
            </View>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }}>
              {formatCurrency(item.premium)}
            </Text>
          </View>

          {item.followUpDate && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderColor: colors.border }}>
              <IconSymbol name="calendar" size={14} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "500", color: colors.primary }}>Follow-up: {formatDate(item.followUpDate)}</Text>
            </View>
          )}

          {nextStage && (
            <TouchableOpacity
              onPress={() => handleMoveToNextStage(item)}
              activeOpacity={0.6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 10,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: getStatusColor(nextStage, colors) + "15",
                borderWidth: 1,
                borderColor: getStatusColor(nextStage, colors) + "40",
              }}
            >
              <IconSymbol name="arrow.up" size={14} color={getStatusColor(nextStage, colors)} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: getStatusColor(nextStage, colors) }}>
                Move to {getStatusLabel(nextStage)}
              </Text>
            </TouchableOpacity>
          )}
        </Pressable>
      );
    },
    [colors, movingRfpId, handleMoveToNextStage, getRfpLabel]
  );

  // Section header
  const renderSectionHeader = (title: string, status: RfpStatus, count: number) => {
    const statusColor = getStatusColor(status, colors);
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.foreground }}>{title}</Text>
        <View style={{ borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: statusColor + "20" }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: statusColor }}>{count}</Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* AI Data Sharing Consent Modal — shown before first voice AI use */}
      <AIConsentModal
        visible={showConsentModal}
        onDecline={() => {
          setShowConsentModal(false);
          pendingVoiceTarget.current = null;
        }}
        onAccept={async () => {
          await AIConsentStore.setConsent(true);
          setAiConsent(true);
          setShowConsentModal(false);
          consentJustAcceptedRef.current = true;
          const target = pendingVoiceTarget.current;
          pendingVoiceTarget.current = null;
          if (target) {
            setTimeout(() => startVoiceRecording(target, true), 100);
          }
        }}
      />
      <ScreenContainer className="flex-1">
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 0.5, borderColor: colors.border }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.foreground }}>RFP Tracker</Text>
            <Text style={{ fontSize: 14, marginTop: 2, color: colors.muted }}>{rfps.length} total proposals</Text>
          </View>
          <TouchableOpacity
            onPress={() => { setShowCreate(true); resetCreateForm(); }}
            activeOpacity={0.7}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <IconSymbol name="plus" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* RFP List grouped by stage */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {STAGE_ORDER.map((status) => {
            const items = groupedRfps[status];
            if (items.length === 0 && status === "sold") {
              return (
                <View key={status}>
                  {renderSectionHeader(getStatusLabel(status), status, 0)}
                  <View style={{ alignItems: "center", paddingVertical: 20, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: colors.muted }}>No sold RFPs yet</Text>
                  </View>
                </View>
              );
            }
            if (items.length === 0) return null;
            return (
              <View key={status}>
                {renderSectionHeader(getStatusLabel(status), status, items.length)}
                {items.map((item) => (
                  <View key={item.id}>{renderRfpCard({ item })}</View>
                ))}
              </View>
            );
          })}

          {rfps.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
              <Text style={{ fontSize: 16, fontWeight: "500", marginTop: 12, color: colors.muted }}>No RFPs yet</Text>
              <Text style={{ fontSize: 14, marginTop: 4, textAlign: "center", paddingHorizontal: 32, color: colors.muted }}>
                Tap + to add your first RFP using voice
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ===== CREATE MODAL — VOICE FIRST ===== */}
        <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: colors.border }}>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetCreateForm(); }} activeOpacity={0.6} disabled={isSavingCreate}>
                <Text style={{ fontSize: 16, color: isSavingCreate ? colors.muted + "80" : colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>New RFP</Text>
              <TouchableOpacity onPress={handleCreate} activeOpacity={0.6} disabled={isSavingCreate} style={{ minWidth: 44, alignItems: "flex-end" }}>
                {isSavingCreate ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>



            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {/* ===== LARGE VOICE INPUT AREA ===== */}
              <View style={{ alignItems: "center", paddingTop: 20, paddingBottom: 24 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (isRecording) {
                      stopVoiceRecording();
                    } else {
                      startVoiceRecording("create");
                    }
                  }}
                  disabled={isTranscribing}
                  activeOpacity={0.7}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isRecording ? colors.error : colors.primary,
                    opacity: isTranscribing ? 0.5 : 1,
                    shadowColor: isRecording ? colors.error : colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  {isTranscribing ? (
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  ) : isRecording ? (
                    <IconSymbol name="stop.fill" size={36} color="#FFFFFF" />
                  ) : (
                    <IconSymbol name="mic.fill" size={36} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                <Text style={{ fontSize: 17, fontWeight: "600", marginTop: 16, color: colors.foreground }}>
                  {isTranscribing ? "Processing..." : isRecording ? "Listening... Tap to stop" : "Tap to Dictate RFP"}
                </Text>

                {!isTranscribing && (
                  <View style={{ marginTop: 16, width: "100%", paddingHorizontal: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 10, textAlign: "center" }}>
                      {isRecording ? "Say each field:" : "Say all fields in one go:"}
                    </Text>
                    <View style={{ borderRadius: 12, borderWidth: 1, backgroundColor: colors.surface, borderColor: isRecording ? colors.error + "40" : colors.border, overflow: "hidden" }}>
                      {[
                        { key: "case" as const, example: "ABC Corporation", icon: "doc.text.fill" as const },
                        { key: "brokerage" as const, example: "Smith & Associates", icon: "person.fill" as const },
                        { key: "brokerageContact" as const, example: "John Smith", icon: "person.2.fill" as const },
                        { key: "lives" as const, example: "250", icon: "person.2.fill" as const },
                        { key: "effectiveDate" as const, example: "March 1st", icon: "calendar" as const },
                        { key: "premium" as const, example: "150 thousand", icon: "dollarsign.circle.fill" as const },
                        { key: "followUpDate" as const, example: "next Tuesday", icon: "bell.fill" as const },
                        { key: "notes" as const, example: "any details", icon: "pencil" as const },
                      ].map((field, idx) => (
                        <View
                          key={field.key}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderBottomWidth: idx < 7 ? 0.5 : 0,
                            borderColor: colors.border,
                            gap: 10,
                          }}
                        >
                          <IconSymbol name={field.icon} size={16} color={isRecording ? colors.error : colors.primary} />
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, width: 110 }}>{getRfpLabel(field.key)}</Text>
                          <Text style={{ fontSize: 13, color: colors.muted, flex: 1, fontStyle: "italic" }}>"{field.example}"</Text>
                        </View>
                      ))}
                    </View>
                    {isRecording && (
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error }} />
                        <Text style={{ fontSize: 14, color: colors.error, fontWeight: "500" }}>Recording...</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

              {/* Parsed preview (shows after voice fills fields) */}
              {renderParsedPreview()}

              {/* Editable fields — always visible so user can manually enter/edit any field */}
              <View>
                {renderFormField(`${getRfpLabel("case")} *`, formCase, setFormCase, "e.g., ABC Corporation Group Benefits", undefined, createErrors.case, () => setCreateErrors((e) => ({ ...e, case: undefined })))}
                {renderFormField(`${getRfpLabel("brokerage")} *`, formBroker, setFormBroker, "e.g., Smith & Associates", undefined, createErrors.brokerage, () => setCreateErrors((e) => ({ ...e, brokerage: undefined })))}
                {renderContactField(getRfpLabel("brokerageContact"), formBrokerContact, setFormBrokerContact, "e.g., John Smith", showContactSuggestions, setShowContactSuggestions, createErrors.brokerageContact, () => setCreateErrors((e) => ({ ...e, brokerageContact: undefined })))}
                {renderFormField(getRfpLabel("lives"), formLives, setFormLives, "e.g., 250", { keyboardType: "numeric" }, createErrors.lives, () => setCreateErrors((e) => ({ ...e, lives: undefined })))}
                {renderDateField(getRfpLabel("effectiveDate"), formEffectiveDate, setFormEffectiveDate, showCreateDatePicker, setShowCreateDatePicker, createErrors.effectiveDate, () => setCreateErrors((e) => ({ ...e, effectiveDate: undefined })))}
                {renderFormField(getRfpLabel("premium"), formPremium, setFormPremium, "e.g., 150000", { keyboardType: "numeric" }, createErrors.premium, () => setCreateErrors((e) => ({ ...e, premium: undefined })))}
                {renderDateField(getRfpLabel("followUpDate"), formFollowUpDate, setFormFollowUpDate, showCreateFollowUpPicker, setShowCreateFollowUpPicker, createErrors.followUpDate, () => setCreateErrors((e) => ({ ...e, followUpDate: undefined })))}
                {renderFormField(getRfpLabel("notes"), formNotes, setFormNotes, "Any additional notes or details...", { multiline: true }, createErrors.notes, () => setCreateErrors((e) => ({ ...e, notes: undefined })))}
              </View>

              {/* Re-record button */}
              {(formCase || formBroker) && !isRecording && !isTranscribing && (
                <TouchableOpacity
                  onPress={() => startVoiceRecording("create")}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: colors.primary + "10",
                    borderWidth: 1,
                    borderColor: colors.primary + "30",
                    marginTop: 8,
                  }}
                >
                  <IconSymbol name="mic.fill" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 15, fontWeight: "500", color: colors.primary }}>Re-dictate</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ===== DETAIL MODAL ===== */}
        <Modal visible={!!detailRfp} animationType="slide" presentationStyle="pageSheet">
          {detailRfp && (
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: colors.border }}>
                <TouchableOpacity onPress={() => setDetailRfp(null)} activeOpacity={0.6}>
                  <Text style={{ fontSize: 16, color: colors.primary }}>Close</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>RFP Details</Text>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <TouchableOpacity onPress={() => openEdit(detailRfp)} activeOpacity={0.6}>
                    <Text style={{ fontSize: 16, color: colors.primary }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(detailRfp)} activeOpacity={0.6}>
                    <Text style={{ fontSize: 16, color: colors.error }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 4, color: colors.foreground }}>{detailRfp.title}</Text>

                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                  <View style={{ borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: getStatusColor(detailRfp.status, colors) + "20" }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: getStatusColor(detailRfp.status, colors) }}>
                      {getStatusLabel(detailRfp.status)}
                    </Text>
                  </View>
                </View>

                <View style={{ borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border }}>
                  <DetailRow label={getRfpLabel("brokerage")} value={detailRfp.client} colors={colors} />
                  <DetailRow label={getRfpLabel("brokerageContact")} value={detailRfp.brokerContact || "—"} colors={colors} />
                  <DetailRow label={getRfpLabel("lives")} value={detailRfp.lives != null ? String(detailRfp.lives) : "—"} colors={colors} />
                  <DetailRow label={getRfpLabel("effectiveDate")} value={formatDate(detailRfp.effectiveDate)} colors={colors} />
                  <DetailRow label={getRfpLabel("premium")} value={formatCurrency(detailRfp.premium)} colors={colors} last />
                </View>

                {/* Follow-Up Date */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", marginBottom: 6, color: colors.muted }}>{getRfpLabel("followUpDate")}</Text>
                  {detailRfp.followUpDate ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ borderRadius: 12, padding: 12, borderWidth: 1, backgroundColor: colors.primary + "10", borderColor: colors.primary + "30", flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <IconSymbol name="calendar" size={18} color={colors.primary} />
                        <Text style={{ fontSize: 15, fontWeight: "500", color: colors.primary }}>{formatDate(detailRfp.followUpDate)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowDetailFollowUpPicker(true)}
                        activeOpacity={0.6}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                      >
                        <Text style={{ fontSize: 13, color: colors.primary }}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowDetailFollowUpPicker(true)}
                      activeOpacity={0.6}
                      style={{
                        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                        paddingVertical: 12, borderRadius: 12,
                        backgroundColor: colors.primary + "10", borderWidth: 1, borderColor: colors.primary + "30",
                      }}
                    >
                      <IconSymbol name="calendar" size={18} color={colors.primary} />
                      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.primary }}>Set Follow-Up Date</Text>
                    </TouchableOpacity>
                  )}
                  {showDetailFollowUpPicker && (
                    <View style={{ marginTop: 8 }}>
                      <DatePicker
                        value={detailRfp.followUpDate || ""}
                        onChange={async (date) => {
                          await updateRfpData(detailRfp.id, { followUpDate: date || undefined });
                          if (date) {
                            await createEvent({
                              title: `Follow up: ${detailRfp.title}`,
                              description: `RFP follow-up for case: ${detailRfp.title} | Brokerage: ${detailRfp.client}`,
                              date,
                              startTime: "09:00",
                              reminderMinutes: 15,
                              sourceType: "follow-up",
                              sourceRfpId: detailRfp.id,
                            });
                            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }
                          await refreshAll();
                          // Update detail view with new data
                          setDetailRfp({ ...detailRfp, followUpDate: date || undefined });
                          setShowDetailFollowUpPicker(false);
                        }}
                        colors={colors}
                        onClose={() => setShowDetailFollowUpPicker(false)}
                      />
                    </View>
                  )}
                </View>

                {detailRfp.notes && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: "500", marginBottom: 6, color: colors.muted }}>{getRfpLabel("notes")}</Text>
                    <View style={{ borderRadius: 12, padding: 12, borderWidth: 1, backgroundColor: colors.surface, borderColor: colors.border }}>
                      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.foreground }}>{detailRfp.notes}</Text>
                    </View>
                  </View>
                )}

                {getNextStage(detailRfp.status) && (
                  <TouchableOpacity
                    onPress={() => {
                      handleMoveToNextStage(detailRfp);
                      setDetailRfp(null);
                    }}
                    activeOpacity={0.6}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 12,
                      marginBottom: 16,
                      backgroundColor: getStatusColor(getNextStage(detailRfp.status)!, colors) + "15",
                      borderWidth: 1,
                      borderColor: getStatusColor(getNextStage(detailRfp.status)!, colors) + "40",
                    }}
                  >
                    <IconSymbol name="arrow.up" size={18} color={getStatusColor(getNextStage(detailRfp.status)!, colors)} />
                    <Text style={{ fontSize: 16, fontWeight: "600", color: getStatusColor(getNextStage(detailRfp.status)!, colors) }}>
                      Move to {getStatusLabel(getNextStage(detailRfp.status)!)}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </Modal>

        {/* ===== EDIT MODAL — VOICE + FIELDS ===== */}
        <Modal visible={!!editingRfp} animationType="slide" presentationStyle="pageSheet">
          {editingRfp && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: colors.border }}>
                <TouchableOpacity onPress={() => setEditingRfp(null)} activeOpacity={0.6} disabled={isSavingUpdate}>
                  <Text style={{ fontSize: 16, color: isSavingUpdate ? colors.muted + "80" : colors.muted }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Edit RFP</Text>
                <TouchableOpacity onPress={handleUpdate} activeOpacity={0.6} disabled={isSavingUpdate} style={{ minWidth: 44, alignItems: "flex-end" }}>
                  {isSavingUpdate ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
                {/* Voice re-dictate button for edit */}
                <TouchableOpacity
                  onPress={() => {
                    if (isRecording) {
                      stopVoiceRecording();
                    } else {
                      startVoiceRecording("edit");
                    }
                  }}
                  disabled={isTranscribing}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 12,
                    marginBottom: 20,
                    backgroundColor: isRecording ? colors.error + "15" : colors.primary + "10",
                    borderWidth: 1,
                    borderColor: isRecording ? colors.error : colors.primary + "30",
                    opacity: isTranscribing ? 0.5 : 1,
                  }}
                >
                  {isTranscribing ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.primary }}>Processing voice...</Text>
                    </>
                  ) : isRecording ? (
                    <>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error }} />
                      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.error }}>Tap to stop recording</Text>
                    </>
                  ) : (
                    <>
                      <IconSymbol name="mic.fill" size={20} color={colors.primary} />
                      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.primary }}>Re-dictate with Voice</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Status selector */}
                <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                  {STAGE_ORDER.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setEditStatus(opt)}
                      activeOpacity={0.6}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: editStatus === opt ? getStatusColor(opt, colors) + "20" : colors.surface,
                          borderColor: editStatus === opt ? getStatusColor(opt, colors) : colors.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "500", color: editStatus === opt ? getStatusColor(opt, colors) : colors.foreground }}>
                        {getStatusLabel(opt)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {renderFormField(getRfpLabel("case"), editCase, setEditCase, "Case name", undefined, editErrors.case, () => setEditErrors((e) => ({ ...e, case: undefined })))}
                {renderFormField(getRfpLabel("brokerage"), editBroker, setEditBroker, "Brokerage name", undefined, editErrors.brokerage, () => setEditErrors((e) => ({ ...e, brokerage: undefined })))}
                {renderContactField(getRfpLabel("brokerageContact"), editBrokerContact, setEditBrokerContact, "Contact person", showEditContactSuggestions, setShowEditContactSuggestions, editErrors.brokerageContact, () => setEditErrors((e) => ({ ...e, brokerageContact: undefined })))}
                {renderFormField(getRfpLabel("lives"), editLives, setEditLives, `Number of ${getRfpLabel("lives").toLowerCase()}`, { keyboardType: "numeric" }, editErrors.lives, () => setEditErrors((e) => ({ ...e, lives: undefined })))}
                {renderDateField(getRfpLabel("effectiveDate"), editEffectiveDate, setEditEffectiveDate, showEditDatePicker, setShowEditDatePicker, editErrors.effectiveDate, () => setEditErrors((e) => ({ ...e, effectiveDate: undefined })))}
                {renderFormField(getRfpLabel("premium"), editPremium, setEditPremium, "Premium amount", { keyboardType: "numeric" }, editErrors.premium, () => setEditErrors((e) => ({ ...e, premium: undefined })))}
                {renderDateField(getRfpLabel("followUpDate"), editFollowUpDate, setEditFollowUpDate, showEditFollowUpPicker, setShowEditFollowUpPicker, editErrors.followUpDate, () => setEditErrors((e) => ({ ...e, followUpDate: undefined })))}
                {renderFormField(getRfpLabel("notes"), editNotes, setEditNotes, "Notes...", { multiline: true }, editErrors.notes, () => setEditErrors((e) => ({ ...e, notes: undefined })))}
                <View style={{ height: 40 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </Modal>
      </ScreenContainer>
    </>
  );
}

function PreviewRow({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: last ? 0 : 0.5, borderColor: colors.border }}>
      <Text style={{ fontSize: 14, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground, flex: 1, textAlign: "right", marginLeft: 12 }} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function DetailRow({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: last ? 0 : 0.5, borderColor: colors.border }}>
      <Text style={{ fontSize: 14, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    lineHeight: 22,
  },
});
