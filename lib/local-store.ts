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
  events: "ai_planner_events",
  rfps: "ai_planner_rfps",
  deals: "ai_planner_deals",
  chatMessages: "ai_planner_chat",
  brokers: "ai_planner_brokers",
} as const;

// ─── Generic Helpers ────────────────────────────────────

async function getList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setList<T>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Events ─────────────────────────────────────────────

export const EventStore = {
  async getAll(): Promise<LocalEvent[]> {
    return getList<LocalEvent>(KEYS.events);
  },

  async getByDate(date: string): Promise<LocalEvent[]> {
    const all = await this.getAll();
    return all
      .filter((e) => e.date === date)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  },

  async getUpcoming(days: number = 7): Promise<LocalEvent[]> {
    const all = await this.getAll();
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return all
      .filter((e) => {
        const d = new Date(e.date + "T23:59:59");
        return d >= now && d <= cutoff;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""));
  },

  async create(event: Omit<LocalEvent, "id" | "createdAt">): Promise<LocalEvent> {
    const all = await this.getAll();
    const newEvent: LocalEvent = { ...event, id: generateId(), createdAt: new Date().toISOString() };
    all.push(newEvent);
    await setList(KEYS.events, all);
    return newEvent;
  },

  async update(id: string, updates: Partial<Omit<LocalEvent, "id" | "createdAt">>): Promise<LocalEvent | null> {
    const all = await this.getAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    await setList(KEYS.events, all);
    return all[idx];
  },

  async remove(id: string): Promise<boolean> {
    const all = await this.getAll();
    const filtered = all.filter((e) => e.id !== id);
    if (filtered.length === all.length) return false;
    await setList(KEYS.events, filtered);
    return true;
  },
};

// ─── RFPs ───────────────────────────────────────────────

export const RfpStore = {
  async getAll(): Promise<LocalRfp[]> {
    return getList<LocalRfp>(KEYS.rfps);
  },

  async create(rfp: Omit<LocalRfp, "id" | "createdAt">): Promise<LocalRfp> {
    const all = await this.getAll();
    const newRfp: LocalRfp = { ...rfp, id: generateId(), createdAt: new Date().toISOString() };
    all.push(newRfp);
    await setList(KEYS.rfps, all);
    return newRfp;
  },

  async update(id: string, updates: Partial<Omit<LocalRfp, "id" | "createdAt">>): Promise<LocalRfp | null> {
    const all = await this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    await setList(KEYS.rfps, all);
    return all[idx];
  },

  async remove(id: string): Promise<boolean> {
    const all = await this.getAll();
    const filtered = all.filter((r) => r.id !== id);
    if (filtered.length === all.length) return false;
    await setList(KEYS.rfps, filtered);
    return true;
  },
};

// ─── Deals ──────────────────────────────────────────────

export const DealStore = {
  async getAll(): Promise<LocalDeal[]> {
    return getList<LocalDeal>(KEYS.deals);
  },

  async create(deal: Omit<LocalDeal, "id" | "createdAt">): Promise<LocalDeal> {
    const all = await this.getAll();
    const newDeal: LocalDeal = { ...deal, id: generateId(), createdAt: new Date().toISOString() };
    all.push(newDeal);
    await setList(KEYS.deals, all);
    return newDeal;
  },

  async update(id: string, updates: Partial<Omit<LocalDeal, "id" | "createdAt">>): Promise<LocalDeal | null> {
    const all = await this.getAll();
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    await setList(KEYS.deals, all);
    return all[idx];
  },

  async remove(id: string): Promise<boolean> {
    const all = await this.getAll();
    const filtered = all.filter((d) => d.id !== id);
    if (filtered.length === all.length) return false;
    await setList(KEYS.deals, filtered);
    return true;
  },
};

// ─── Brokers ───────────────────────────────────────────

export const BrokerStore = {
  async getAll(): Promise<LocalBroker[]> {
    return getList<LocalBroker>(KEYS.brokers);
  },

  async create(broker: Omit<LocalBroker, "id" | "createdAt" | "notes"> & { notes?: BrokerNote[] }): Promise<LocalBroker> {
    const all = await this.getAll();
    const newBroker: LocalBroker = {
      ...broker,
      notes: broker.notes || [],
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    all.push(newBroker);
    await setList(KEYS.brokers, all);
    return newBroker;
  },

  async update(id: string, updates: Partial<Omit<LocalBroker, "id" | "createdAt">>): Promise<LocalBroker | null> {
    const all = await this.getAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    await setList(KEYS.brokers, all);
    return all[idx];
  },

  async addNote(brokerId: string, content: string): Promise<BrokerNote | null> {
    const all = await this.getAll();
    const idx = all.findIndex((b) => b.id === brokerId);
    if (idx === -1) return null;
    const note: BrokerNote = { id: generateId(), content, createdAt: new Date().toISOString() };
    all[idx].notes.push(note);
    await setList(KEYS.brokers, all);
    return note;
  },

  async removeNote(brokerId: string, noteId: string): Promise<boolean> {
    const all = await this.getAll();
    const idx = all.findIndex((b) => b.id === brokerId);
    if (idx === -1) return false;
    all[idx].notes = all[idx].notes.filter((n) => n.id !== noteId);
    await setList(KEYS.brokers, all);
    return true;
  },

  async remove(id: string): Promise<boolean> {
    const all = await this.getAll();
    const filtered = all.filter((b) => b.id !== id);
    if (filtered.length === all.length) return false;
    await setList(KEYS.brokers, filtered);
    return true;
  },

  async findByName(name: string): Promise<LocalBroker | null> {
    const all = await this.getAll();
    const lower = name.toLowerCase().trim();
    return all.find((b) => b.name.toLowerCase().trim() === lower) || null;
  },

  async getOrCreate(name: string): Promise<LocalBroker> {
    const existing = await this.findByName(name);
    if (existing) return existing;
    return this.create({ name: name.trim() });
  },
};

// ─── Chat Messages ──────────────────────────────────────

export const ChatStore = {
  async getAll(): Promise<LocalChatMessage[]> {
    return getList<LocalChatMessage>(KEYS.chatMessages);
  },

  async add(msg: Omit<LocalChatMessage, "id" | "createdAt">): Promise<LocalChatMessage> {
    const all = await this.getAll();
    const newMsg: LocalChatMessage = { ...msg, id: generateId(), createdAt: new Date().toISOString() };
    all.push(newMsg);
    const trimmed = all.slice(-200);
    await setList(KEYS.chatMessages, trimmed);
    return newMsg;
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.chatMessages);
  },
};
