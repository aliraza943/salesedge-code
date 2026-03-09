/**
 * DataProvider — single source of truth for events, RFPs, deals, brokers, chat, and sales goal.
 *
 * All data (except aiConsent) is stored in MongoDB and accessed via REST APIs.
 * No localStorage/AsyncStorage for application data.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type LocalEvent,
  type LocalRfp,
  type LocalDeal,
  type LocalChatMessage,
  type LocalBroker,
  type BrokerNote,
} from "@/lib/local-store";
import * as rfpApi from "@/lib/rfp-api";
import * as eventsApi from "@/lib/events-api";
import * as dealsApi from "@/lib/deals-api";
import * as brokersApi from "@/lib/brokers-api";
import * as chatApi from "@/lib/chat-api";
import * as salesGoalApi from "@/lib/sales-goal-api";
import {
  scheduleEventReminder,
  cancelEventReminder,
  requestNotificationPermissions,
} from "@/lib/notification-manager";
import { useAuth } from "@/hooks/use-auth";

// ─── Types ─────────────────────────────────────────────

export type SalesGoal = {
  currentSales: number;
  goalAmount: number;
  goalDeadline: string; // YYYY-MM-DD
};

const DEFAULT_SALES_GOAL: SalesGoal = {
  currentSales: 0,
  goalAmount: 12000000,
  goalDeadline: "2026-12-01",
};

// ─── Context Type ──────────────────────────────────────

type DataContextType = {
  events: LocalEvent[];
  rfps: LocalRfp[];
  deals: LocalDeal[];
  chatMessages: LocalChatMessage[];
  deviceId: string;
  isLoading: boolean;
  isCloudMode: boolean;

  salesGoal: SalesGoal;
  updateSalesGoal: (
    updates: Partial<SalesGoal> & { addToCurrentSales?: number }
  ) => Promise<void>;

  createEvent: (
    data: Omit<LocalEvent, "id" | "createdAt">
  ) => Promise<LocalEvent>;
  updateEvent: (
    id: string,
    data: Partial<Omit<LocalEvent, "id" | "createdAt">>
  ) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  createRfp: (
    data: Omit<LocalRfp, "id" | "createdAt">
  ) => Promise<LocalRfp>;
  updateRfp: (
    id: string,
    data: Partial<Omit<LocalRfp, "id" | "createdAt">>
  ) => Promise<void>;
  deleteRfp: (id: string) => Promise<void>;

  createDeal: (
    data: Omit<LocalDeal, "id" | "createdAt">
  ) => Promise<LocalDeal>;
  updateDeal: (
    id: string,
    data: Partial<Omit<LocalDeal, "id" | "createdAt">>
  ) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;

  addChatMessage: (
    msg: Omit<LocalChatMessage, "id" | "createdAt">
  ) => Promise<LocalChatMessage>;
  clearChat: () => Promise<void>;

  brokers: LocalBroker[];
  createBroker: (
    data: Omit<LocalBroker, "id" | "createdAt" | "notes"> & {
      notes?: BrokerNote[];
    }
  ) => Promise<LocalBroker>;
  updateBroker: (
    id: string,
    data: Partial<Omit<LocalBroker, "id" | "createdAt">>
  ) => Promise<void>;
  deleteBroker: (id: string) => Promise<void>;
  addBrokerNote: (
    brokerId: string,
    content: string
  ) => Promise<BrokerNote | null>;
  removeBrokerNote: (brokerId: string, noteId: string) => Promise<void>;
  getOrCreateBroker: (name: string) => Promise<LocalBroker>;

  refreshAll: () => Promise<void>;
  syncLocalToCloud: () => Promise<{ events: number; rfps: number; deals: number; brokers: number; salesGoal: boolean } | null>;
  isSyncing: boolean;
};

const DataContext = createContext<DataContextType | null>(null);

export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────────────

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth({ autoFetch: true });
  const isCloudMode = isAuthenticated && !!user;

  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [rfps, setRfps] = useState<LocalRfp[]>([]);
  const [deals, setDeals] = useState<LocalDeal[]>([]);
  const [chatMessages, setChatMessages] = useState<LocalChatMessage[]>([]);
  const [brokers, setBrokers] = useState<LocalBroker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [salesGoal, setSalesGoal] = useState<SalesGoal>(DEFAULT_SALES_GOAL);

  const eventsRef = useRef(events);
  eventsRef.current = events;
  const rfpsRef = useRef(rfps);
  rfpsRef.current = rfps;
  const dealsRef = useRef(deals);
  dealsRef.current = deals;
  const brokersRef = useRef(brokers);
  brokersRef.current = brokers;
  const salesGoalRef = useRef(salesGoal);
  salesGoalRef.current = salesGoal;
  const isCloudRef = useRef(isCloudMode);
  isCloudRef.current = isCloudMode;

  // ─── Load all data from MongoDB-backed REST APIs ──────────────────

  useEffect(() => {
    requestNotificationPermissions();
    (async () => {
      try {
        const [eventsList, rfpsList, dealsList, brokersList, chatList, goal] = await Promise.all([
          eventsApi.fetchEvents(),
          rfpApi.fetchRfps(),
          dealsApi.fetchDeals(),
          brokersApi.fetchBrokers(),
          chatApi.fetchChatMessages(),
          salesGoalApi.fetchSalesGoal().catch(() => DEFAULT_SALES_GOAL),
        ]);
        setEvents(eventsList);
        setRfps(rfpsList);
        setDeals(dealsList);
        setBrokers(brokersList);
        setChatMessages(chatList);
        setSalesGoal(goal);
      } catch (e) {
        console.error("[DataProvider] Initial load failed:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── Event CRUD ────────────────────────────────────

  const createEvent = useCallback(
    async (data: Omit<LocalEvent, "id" | "createdAt">) => {
      const newEvent = await eventsApi.createEvent(data);
      setEvents((prev) => [...prev, newEvent]);
      if (data.reminderMinutes && data.reminderMinutes > 0) {
        scheduleEventReminder(
          newEvent.id,
          data.title,
          data.date,
          data.startTime,
          data.reminderMinutes
        );
      }
      return newEvent;
    },
    []
  );

  const updateEvent = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalEvent, "id" | "createdAt">>
    ) => {
      const updated = await eventsApi.updateEvent(id, data);
      setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
      const evt = updated;
      if (evt.reminderMinutes && evt.reminderMinutes > 0) {
        scheduleEventReminder(
          id,
          evt.title,
          evt.date,
          evt.startTime,
          evt.reminderMinutes
        );
      } else {
        cancelEventReminder(id);
      }
    },
    []
  );

  const deleteEvent = useCallback(async (id: string) => {
    cancelEventReminder(id);
    await eventsApi.deleteEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── RFP CRUD ──────────────────────────────────────

  const createRfp = useCallback(
    async (data: Omit<LocalRfp, "id" | "createdAt">) => {
      console.log("data----_>", data)
      const newRfp = await rfpApi.createRfp(data);
      console.log("newRfp", newRfp)
      setRfps((prev) => [...prev, newRfp]);
      return newRfp;
    },
    []
  );

  const updateRfp = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalRfp, "id" | "createdAt">>
    ) => {
      const updated = await rfpApi.updateRfp(id, data);
      setRfps((prev) => prev.map((r) => (r.id === id ? updated : r)));
    },
    []
  );

  const deleteRfp = useCallback(async (id: string) => {
    await rfpApi.deleteRfp(id);
    setRfps((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ─── Deal CRUD ─────────────────────────────────────

  const createDeal = useCallback(
    async (data: Omit<LocalDeal, "id" | "createdAt">) => {
      const newDeal = await dealsApi.createDeal(data);
      setDeals((prev) => [...prev, newDeal]);
      return newDeal;
    },
    []
  );

  const updateDeal = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalDeal, "id" | "createdAt">>
    ) => {
      const updated = await dealsApi.updateDeal(id, data);
      setDeals((prev) => prev.map((d) => (d.id === id ? updated : d)));
    },
    []
  );

  const deleteDeal = useCallback(async (id: string) => {
    await dealsApi.deleteDeal(id);
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // ─── Chat ──────────────────────────────────────────

  const addChatMessage = useCallback(
    async (msg: Omit<LocalChatMessage, "id" | "createdAt">) => {
      const newMsg = await chatApi.addChatMessage(msg);
      setChatMessages((prev) => [...prev, newMsg]);
      return newMsg;
    },
    []
  );

  const clearChat = useCallback(async () => {
    await chatApi.clearChat();
    setChatMessages([]);
  }, []);

  // ─── Broker CRUD ───────────────────────────────────

  const createBroker = useCallback(
    async (
      data: Omit<LocalBroker, "id" | "createdAt" | "notes"> & {
        notes?: BrokerNote[];
      }
    ) => {
      const newBroker = await brokersApi.createBroker(data);
      setBrokers((prev) => [...prev, newBroker]);
      return newBroker;
    },
    []
  );

  const updateBroker = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalBroker, "id" | "createdAt">>
    ) => {
      const updated = await brokersApi.updateBroker(id, data);
      setBrokers((prev) => prev.map((b) => (b.id === id ? updated : b)));
    },
    []
  );

  const deleteBroker = useCallback(async (id: string) => {
    await brokersApi.deleteBroker(id);
    setBrokers((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addBrokerNote = useCallback(
    async (brokerId: string, content: string) => {
      const note = await brokersApi.addBrokerNote(brokerId, content);
      setBrokers((prev) =>
        prev.map((b) =>
          b.id === brokerId
            ? { ...b, notes: [...b.notes, note] }
            : b
        )
      );
      return note;
    },
    []
  );

  const removeBrokerNote = useCallback(
    async (brokerId: string, noteId: string) => {
      await brokersApi.removeBrokerNote(brokerId, noteId);
      setBrokers((prev) =>
        prev.map((b) =>
          b.id === brokerId
            ? { ...b, notes: b.notes.filter((n) => n.id !== noteId) }
            : b
        )
      );
    },
    []
  );

  const getOrCreateBroker = useCallback(
    async (name: string) => {
      const lower = name.toLowerCase().trim();
      const existing = brokersRef.current.find(
        (b) => b.name.toLowerCase().trim() === lower
      );
      if (existing) return existing;
      return createBroker({ name: name.trim() });
    },
    [createBroker]
  );

  // ─── Sales Goal ────────────────────────────────────

  const updateSalesGoal = useCallback(
    async (
      updates: Partial<SalesGoal> & { addToCurrentSales?: number }
    ) => {
      const prev = salesGoalRef.current;
      const currentSales =
        updates.currentSales !== undefined
          ? updates.currentSales
          : updates.addToCurrentSales != null && updates.addToCurrentSales > 0
            ? prev.currentSales + updates.addToCurrentSales
            : undefined;
      const goal = await salesGoalApi.upsertSalesGoal({
        currentSales: currentSales ?? prev.currentSales,
        goalAmount: updates.goalAmount ?? prev.goalAmount,
        goalDeadline: updates.goalDeadline ?? prev.goalDeadline,
      });
      setSalesGoal(goal);
    },
    []
  );

  // ─── Sync (no-op: all data is in MongoDB via APIs) ───

  const syncLocalToCloud = useCallback(async () => {
    return null;
  }, []);

  // ─── Refresh ───────────────────────────────────────

  const refreshAll = useCallback(async () => {
    try {
      const [eventsList, rfpsList, dealsList, brokersList, chatList, goal] = await Promise.all([
        eventsApi.fetchEvents(),
        rfpApi.fetchRfps(),
        dealsApi.fetchDeals(),
        brokersApi.fetchBrokers(),
        chatApi.fetchChatMessages(),
        salesGoalApi.fetchSalesGoal().catch(() => DEFAULT_SALES_GOAL),
      ]);
      setEvents(eventsList);
      setRfps(rfpsList);
      setDeals(dealsList);
      setBrokers(brokersList);
      setChatMessages(chatList);
      setSalesGoal(goal);
    } catch (e) {
      console.error("[DataProvider] refreshAll failed:", e);
    }
  }, []);

  return (
    <DataContext.Provider
      value={{
        events,
        rfps,
        deals,
        chatMessages,
        brokers,
        deviceId: user?.id ? String(user.id) : "local",
        isLoading,
        isCloudMode,
        salesGoal,
        updateSalesGoal,
        createEvent,
        updateEvent,
        deleteEvent,
        createRfp,
        updateRfp,
        deleteRfp,
        createDeal,
        updateDeal,
        deleteDeal,
        addChatMessage,
        clearChat,
        createBroker,
        updateBroker,
        deleteBroker,
        addBrokerNote,
        removeBrokerNote,
        getOrCreateBroker,
        refreshAll,
        syncLocalToCloud,
        isSyncing,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
