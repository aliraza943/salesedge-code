import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ──────────────────────────────────────────────

export type LocalEvent = {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  reminderMinutes?: number;
  sourceType?: "follow-up"; // Tags this event as an RFP follow-up
  sourceRfpId?: string; // Links back to the originating RFP
  createdAt: string;
};

export type LocalRfp = {
  id: string;
  title: string; // Case name
  client: string; // Broker
  brokerContact?: string;
  lives?: number;
  effectiveDate?: string; // YYYY-MM-DD
  premium?: string;
  status: "draft" | "recommended" | "sold";
  notes?: string;
  description?: string;
  followUpDate?: string; // YYYY-MM-DD — auto-creates calendar event
  createdAt: string;
};

export type LocalDeal = {
  id: string;
  title: string;
  client: string;
  stage: "lead" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  value?: string;
  expectedCloseDate?: string; // YYYY-MM-DD
  description?: string;
  createdAt: string;
};

export type LocalChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ type: string; result?: unknown; data?: Record<string, unknown> }>;
  createdAt: string;
};

export type LocalBroker = {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  notes: BrokerNote[];
  createdAt: string;
};

export type BrokerNote = {
  id: string;
  content: string;
  createdAt: string;
};

// ─── Storage Keys ───────────────────────────────────────

const KEYS = {
  aiConsent: "ai_planner_ai_consent",
} as const;

// Events, RFPs, Deals, Brokers, Chat, Sales Goal are in MongoDB via REST APIs.

// ─── AI Consent (localStorage only) ──────────────────────────────

export const AIConsentStore = {
  async hasConsent(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEYS.aiConsent);
      if (value === null) return false;
      return value === "true";
    } catch {
      return false;
    }
  },

  async setConsent(consented: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.aiConsent, String(consented));
    } catch (err) {
      console.error("Failed to save AI consent:", err);
    }
  },

  async reset(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.aiConsent);
  }
};
