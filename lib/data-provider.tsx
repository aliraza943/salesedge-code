/**
 * DataProvider — single source of truth for events, RFPs, deals, brokers, chat, and sales goal.
 *
 * CLOUD-FIRST APPROACH:
 * - When user is authenticated: all CRUD goes through tRPC → cloud database
 * - When user is NOT authenticated: falls back to local AsyncStorage (offline mode)
 * - AsyncStorage is used as a local cache for fast initial loads
 *
 * This enables the same data to be accessible from both the mobile app and web dashboard.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EventStore,
  RfpStore,
  DealStore,
  ChatStore,
  BrokerStore,
  type LocalEvent,
  type LocalRfp,
  type LocalDeal,
  type LocalChatMessage,
  type LocalBroker,
  type BrokerNote,
} from "@/lib/local-store";
import {
  scheduleEventReminder,
  cancelEventReminder,
  requestNotificationPermissions,
} from "@/lib/notification-manager";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

// ─── Types ─────────────────────────────────────────────

export type SalesGoal = {
  currentSales: number;
  goalAmount: number;
  goalDeadline: string; // YYYY-MM-DD
};

const SALES_GOAL_KEY = "ai_planner_sales_goal";
const DEFAULT_SALES_GOAL: SalesGoal = {
  currentSales: 0,
  goalAmount: 12000000,
  goalDeadline: "2026-12-01",
};

// ─── Helpers ───────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convert a cloud event row to LocalEvent shape */
function cloudEventToLocal(e: any): LocalEvent {
  return {
    id: String(e.id),
    title: e.title,
    description: e.description || undefined,
    date: e.date,
    startTime: e.startTime || undefined,
    endTime: e.endTime || undefined,
    reminderMinutes: e.reminderMinutes ?? undefined,
    sourceType: e.sourceType || undefined,
    sourceRfpId: e.sourceRfpId ? String(e.sourceRfpId) : undefined,
    createdAt: e.createdAt
      ? new Date(e.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

/** Convert a cloud RFP row to LocalRfp shape */
function cloudRfpToLocal(r: any): LocalRfp {
  return {
    id: String(r.id),
    title: r.title,
    client: r.clientName || "",
    brokerContact: r.brokerContact || undefined,
    lives: r.lives ?? undefined,
    effectiveDate: r.effectiveDate || undefined,
    premium: r.premium || undefined,
    status: r.status || "draft",
    notes: r.notes || undefined,
    description: r.description || undefined,
    followUpDate: r.followUpDate || undefined,
    createdAt: r.createdAt
      ? new Date(r.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

/** Convert a cloud deal row to LocalDeal shape */
function cloudDealToLocal(d: any): LocalDeal {
  return {
    id: String(d.id),
    title: d.title,
    client: d.clientName || "",
    stage: d.stage || "lead",
    value: d.value || undefined,
    expectedCloseDate: d.expectedCloseDate || undefined,
    description: d.description || undefined,
    createdAt: d.createdAt
      ? new Date(d.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

/** Convert a cloud broker row to LocalBroker shape */
function cloudBrokerToLocal(b: any): LocalBroker {
  return {
    id: String(b.id),
    name: b.name,
    company: b.company || undefined,
    phone: b.phone || undefined,
    email: b.email || undefined,
    notes: (b.notes || []).map((n: any) => ({
      id: String(n.id),
      content: n.content,
      createdAt: n.createdAt
        ? new Date(n.createdAt).toISOString()
        : new Date().toISOString(),
    })),
    createdAt: b.createdAt
      ? new Date(b.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

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
  const hasSyncedRef = useRef(false);
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

  // tRPC mutations
  const createEventMut = trpc.events.create.useMutation();
  const updateEventMut = trpc.events.update.useMutation();
  const deleteEventMut = trpc.events.delete.useMutation();

  const createRfpMut = trpc.rfps.create.useMutation();
  const updateRfpMut = trpc.rfps.update.useMutation();
  const deleteRfpMut = trpc.rfps.delete.useMutation();

  const createDealMut = trpc.deals.create.useMutation();
  const updateDealMut = trpc.deals.update.useMutation();
  const deleteDealMut = trpc.deals.delete.useMutation();

  const createBrokerMut = trpc.brokers.create.useMutation();
  const updateBrokerMut = trpc.brokers.update.useMutation();
  const deleteBrokerMut = trpc.brokers.delete.useMutation();
  const addBrokerNoteMut = trpc.brokers.addNote.useMutation();
  const removeBrokerNoteMut = trpc.brokers.removeNote.useMutation();

  const upsertSalesGoalMut = trpc.salesGoal.upsert.useMutation();

  const chatSendMut = trpc.chat.send.useMutation();
  const chatClearMut = trpc.chat.clear.useMutation();

  const syncImportMut = trpc.sync.importAll.useMutation();

  // tRPC queries (only enabled when authenticated)
  const eventsQuery = trpc.events.list.useQuery(undefined, {
    enabled: isCloudMode,
    refetchOnMount: true,
  });
  const rfpsQuery = trpc.rfps.list.useQuery(undefined, {
    enabled: isCloudMode,
    refetchOnMount: true,
  });
  const dealsQuery = trpc.deals.list.useQuery(undefined, {
    enabled: isCloudMode,
    refetchOnMount: true,
  });
  const brokersQuery = trpc.brokers.list.useQuery(undefined, {
    enabled: isCloudMode,
    refetchOnMount: true,
  });
  const salesGoalQuery = trpc.salesGoal.get.useQuery(undefined, {
    enabled: isCloudMode,
    refetchOnMount: true,
  });
  const chatHistoryQuery = trpc.chat.history.useQuery(undefined, {
    enabled: isCloudMode,
    refetchOnMount: true,
  });

  // Store query refs so callbacks don't depend on query objects (which change every render)
  const eventsQueryRef = useRef(eventsQuery);
  eventsQueryRef.current = eventsQuery;
  const rfpsQueryRef = useRef(rfpsQuery);
  rfpsQueryRef.current = rfpsQuery;
  const dealsQueryRef = useRef(dealsQuery);
  dealsQueryRef.current = dealsQuery;
  const brokersQueryRef = useRef(brokersQuery);
  brokersQueryRef.current = brokersQuery;
  const salesGoalQueryRef = useRef(salesGoalQuery);
  salesGoalQueryRef.current = salesGoalQuery;
  const chatHistoryQueryRef = useRef(chatHistoryQuery);
  chatHistoryQueryRef.current = chatHistoryQuery;

  // ─── Load data from cloud or local ──────────────────

  useEffect(() => {
    if (!isCloudMode) {
      // Offline / unauthenticated — load from AsyncStorage
      (async () => {
        try {
          const [le, lr, ld, lc, lb] = await Promise.all([
            EventStore.getAll(),
            RfpStore.getAll(),
            DealStore.getAll(),
            ChatStore.getAll(),
            BrokerStore.getAll(),
          ]);
          setEvents(le);
          setRfps(lr);
          setDeals(ld);
          setChatMessages(lc);
          setBrokers(lb);

          try {
            const savedGoal = await AsyncStorage.getItem(SALES_GOAL_KEY);
            if (savedGoal)
              setSalesGoal({ ...DEFAULT_SALES_GOAL, ...JSON.parse(savedGoal) });
          } catch { }
        } catch { }
        setIsLoading(false);
        requestNotificationPermissions();
      })();
    }
  }, [isCloudMode]);

  // Sync cloud data into state when queries resolve
  useEffect(() => {
    if (!isCloudMode) return;

    const allLoaded =
      eventsQuery.data !== undefined &&
      rfpsQuery.data !== undefined &&
      dealsQuery.data !== undefined &&
      brokersQuery.data !== undefined;

    if (allLoaded) {
      setEvents((eventsQuery.data || []).map(cloudEventToLocal));
      setRfps((rfpsQuery.data || []).map(cloudRfpToLocal));
      setDeals((dealsQuery.data || []).map(cloudDealToLocal));
      setBrokers((brokersQuery.data || []).map(cloudBrokerToLocal));
      setIsLoading(false);
    }
  }, [
    isCloudMode,
    eventsQuery.data,
    rfpsQuery.data,
    dealsQuery.data,
    brokersQuery.data,
  ]);

  useEffect(() => {
    if (isCloudMode && salesGoalQuery.data) {
      setSalesGoal({
        currentSales: parseFloat(salesGoalQuery.data.currentSales || "0"),
        goalAmount: parseFloat(salesGoalQuery.data.goalAmount || "0"),
        goalDeadline: salesGoalQuery.data.goalDeadline || "2026-12-01",
      });
    }
  }, [isCloudMode, salesGoalQuery.data]);

  useEffect(() => {
    if (isCloudMode && chatHistoryQuery.data) {
      const msgs: LocalChatMessage[] = chatHistoryQuery.data
        .slice()
        .reverse()
        .map((m: any) => ({
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt
            ? new Date(m.createdAt).toISOString()
            : new Date().toISOString(),
        }));
      setChatMessages(msgs);
    }
  }, [isCloudMode, chatHistoryQuery.data]);

  // ─── Local save helper ─────────────────────────────

  const saveLocal = useCallback(
    async (key: string, items: unknown[]) => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(items));
      } catch { }
    },
    []
  );

  // ─── Event CRUD ────────────────────────────────────

  const createEvent = useCallback(
    async (data: Omit<LocalEvent, "id" | "createdAt">) => {
      if (isCloudRef.current) {
        try {
          const cloudId = await createEventMut.mutateAsync({
            title: data.title,
            description: data.description,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            allDay: false,
            reminderMinutes: data.reminderMinutes,
            sourceType: data.sourceType,
            sourceRfpId: data.sourceRfpId
              ? parseInt(data.sourceRfpId)
              : undefined,
          });
          const newEvent: LocalEvent = {
            ...data,
            id: String(cloudId),
            createdAt: new Date().toISOString(),
          };
          setEvents((prev) => [...prev, newEvent]);
          // Schedule notification
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
        } catch (err) {
          console.error("[DataProvider] Cloud createEvent failed, saving locally:", err);
          // Fall through to local save so data is not lost
        }
      }
      // Local save (offline mode OR cloud fallback)
      const newEvent: LocalEvent = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...eventsRef.current, newEvent];
      setEvents(updated);
      await saveLocal("ai_planner_events", updated);
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
    [createEventMut, saveLocal]
  );

  const updateEvent = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalEvent, "id" | "createdAt">>
    ) => {
      // Optimistic update
      const updated = eventsRef.current.map((e) =>
        e.id === id ? { ...e, ...data } : e
      );
      setEvents(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await updateEventMut.mutateAsync({
              id: numId,
              title: data.title,
              description: data.description,
              date: data.date,
              startTime: data.startTime,
              endTime: data.endTime,
              reminderMinutes: data.reminderMinutes,
              sourceType: data.sourceType,
              sourceRfpId: data.sourceRfpId
                ? parseInt(data.sourceRfpId)
                : undefined,
            });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud updateEvent failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_events", updated);

      const evt = updated.find((e) => e.id === id);
      if (evt) {
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
      }
    },
    [updateEventMut, saveLocal]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      cancelEventReminder(id);
      const updated = eventsRef.current.filter((e) => e.id !== id);
      setEvents(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await deleteEventMut.mutateAsync({ id: numId });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud deleteEvent failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_events", updated);
    },
    [deleteEventMut, saveLocal]
  );

  // ─── RFP CRUD ──────────────────────────────────────

  const createRfp = useCallback(
    async (data: Omit<LocalRfp, "id" | "createdAt">) => {
      if (isCloudRef.current) {
        try {
          const cloudId = await createRfpMut.mutateAsync({
            title: data.title,
            clientName: data.client,
            brokerContact: data.brokerContact,
            lives: data.lives,
            effectiveDate: data.effectiveDate,
            premium: data.premium,
            status: data.status,
            notes: data.notes,
            description: data.description,
            followUpDate: data.followUpDate,
          });
          const newRfp: LocalRfp = {
            ...data,
            id: String(cloudId),
            createdAt: new Date().toISOString(),
          };
          setRfps((prev) => [...prev, newRfp]);
          return newRfp;
        } catch (err) {
          console.error("[DataProvider] Cloud createRfp failed, saving locally:", err);
          // Fall through to local save so data is not lost
        }
      }
      // Local save (offline mode OR cloud fallback)
      const newRfp: LocalRfp = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...rfpsRef.current, newRfp];
      setRfps(updated);
      await saveLocal("ai_planner_rfps", updated);
      return newRfp;
    },
    [createRfpMut, saveLocal]
  );

  const updateRfp = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalRfp, "id" | "createdAt">>
    ) => {
      const updated = rfpsRef.current.map((r) =>
        r.id === id ? { ...r, ...data } : r
      );
      setRfps(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await updateRfpMut.mutateAsync({
              id: numId,
              title: data.title,
              clientName: data.client,
              brokerContact: data.brokerContact,
              lives: data.lives,
              effectiveDate: data.effectiveDate,
              premium: data.premium,
              status: data.status,
              notes: data.notes,
              description: data.description,
              followUpDate: data.followUpDate,
            });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud updateRfp failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_rfps", updated);
    },
    [updateRfpMut, saveLocal]
  );

  const deleteRfp = useCallback(
    async (id: string) => {
      const updated = rfpsRef.current.filter((r) => r.id !== id);
      setRfps(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await deleteRfpMut.mutateAsync({ id: numId });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud deleteRfp failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_rfps", updated);
    },
    [deleteRfpMut, saveLocal]
  );

  // ─── Deal CRUD ─────────────────────────────────────

  const createDeal = useCallback(
    async (data: Omit<LocalDeal, "id" | "createdAt">) => {
      if (isCloudRef.current) {
        try {
          const cloudId = await createDealMut.mutateAsync({
            clientName: data.client,
            title: data.title,
            description: data.description,
            value: data.value,
            stage: data.stage,
            expectedCloseDate: data.expectedCloseDate,
          });
          const newDeal: LocalDeal = {
            ...data,
            id: String(cloudId),
            createdAt: new Date().toISOString(),
          };
          setDeals((prev) => [...prev, newDeal]);
          return newDeal;
        } catch (err) {
          console.error("[DataProvider] Cloud createDeal failed, saving locally:", err);
          // Fall through to local save so data is not lost
        }
      }
      // Local save (offline mode OR cloud fallback)
      const newDeal: LocalDeal = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...dealsRef.current, newDeal];
      setDeals(updated);
      await saveLocal("ai_planner_deals", updated);
      return newDeal;
    },
    [createDealMut, saveLocal]
  );

  const updateDeal = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalDeal, "id" | "createdAt">>
    ) => {
      const updated = dealsRef.current.map((d) =>
        d.id === id ? { ...d, ...data } : d
      );
      setDeals(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await updateDealMut.mutateAsync({
              id: numId,
              clientName: data.client,
              title: data.title,
              description: data.description,
              value: data.value,
              stage: data.stage,
              expectedCloseDate: data.expectedCloseDate,
            });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud updateDeal failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_deals", updated);
    },
    [updateDealMut, saveLocal]
  );

  const deleteDeal = useCallback(
    async (id: string) => {
      const updated = dealsRef.current.filter((d) => d.id !== id);
      setDeals(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await deleteDealMut.mutateAsync({ id: numId });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud deleteDeal failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_deals", updated);
    },
    [deleteDealMut, saveLocal]
  );

  // ─── Chat ──────────────────────────────────────────

  const addChatMessage = useCallback(
    async (msg: Omit<LocalChatMessage, "id" | "createdAt">) => {
      const newMsg: LocalChatMessage = {
        ...msg,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, newMsg]);

      if (!isCloudRef.current) {
        // Local mode: save to AsyncStorage
        await ChatStore.add(msg);
      }
      // In cloud mode, chat messages are saved server-side by the chat.send endpoint
      return newMsg;
    },
    []
  );

  const clearChat = useCallback(async () => {
    setChatMessages([]);
    if (isCloudRef.current) {
      try {
        await chatClearMut.mutateAsync();
      } catch (err) {
        console.error("[DataProvider] Cloud clearChat failed:", err);
      }
    } else {
      await ChatStore.clear();
    }
  }, [chatClearMut]);

  // ─── Broker CRUD ───────────────────────────────────

  const createBroker = useCallback(
    async (
      data: Omit<LocalBroker, "id" | "createdAt" | "notes"> & {
        notes?: BrokerNote[];
      }
    ) => {
      if (isCloudRef.current) {
        try {
          const cloudId = await createBrokerMut.mutateAsync({
            name: data.name,
            company: data.company,
            phone: data.phone,
            email: data.email,
          });
          const newBroker: LocalBroker = {
            ...data,
            notes: data.notes || [],
            id: String(cloudId),
            createdAt: new Date().toISOString(),
          };
          setBrokers((prev) => [...prev, newBroker]);
          return newBroker;
        } catch (err) {
          console.error("[DataProvider] Cloud createBroker failed, saving locally:", err);
          // Fall through to local save so data is not lost
        }
      }
      // Local save (offline mode OR cloud fallback)
      const newBroker: LocalBroker = {
        ...data,
        notes: data.notes || [],
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...brokersRef.current, newBroker];
      setBrokers(updated);
      await saveLocal("ai_planner_brokers", updated);
      return newBroker;
    },
    [createBrokerMut, saveLocal]
  );

  const updateBroker = useCallback(
    async (
      id: string,
      data: Partial<Omit<LocalBroker, "id" | "createdAt">>
    ) => {
      const updated = brokersRef.current.map((b) =>
        b.id === id ? { ...b, ...data } : b
      );
      setBrokers(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await updateBrokerMut.mutateAsync({
              id: numId,
              name: data.name,
              company: data.company,
              phone: data.phone,
              email: data.email,
            });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud updateBroker failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_brokers", updated);
    },
    [updateBrokerMut, saveLocal]
  );

  const deleteBroker = useCallback(
    async (id: string) => {
      const updated = brokersRef.current.filter((b) => b.id !== id);
      setBrokers(updated);

      if (isCloudRef.current) {
        try {
          const numId = parseInt(id);
          if (!isNaN(numId)) {
            await deleteBrokerMut.mutateAsync({ id: numId });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud deleteBroker failed:", err);
        }
      }
      // Always save locally as backup
      await saveLocal("ai_planner_brokers", updated);
    },
    [deleteBrokerMut, saveLocal]
  );

  const addBrokerNote = useCallback(
    async (brokerId: string, content: string) => {
      if (isCloudRef.current) {
        try {
          const numId = parseInt(brokerId);
          if (!isNaN(numId)) {
            const noteId = await addBrokerNoteMut.mutateAsync({
              brokerId: numId,
              content,
            });
            const note: BrokerNote = {
              id: String(noteId),
              content,
              createdAt: new Date().toISOString(),
            };
            setBrokers((prev) =>
              prev.map((b) =>
                b.id === brokerId
                  ? { ...b, notes: [...b.notes, note] }
                  : b
              )
            );
            return note;
          }
        } catch (err) {
          console.error("[DataProvider] Cloud addBrokerNote failed:", err);
        }
      }
      // Local fallback
      const broker = brokersRef.current.find((b) => b.id === brokerId);
      if (!broker) return null;
      const note: BrokerNote = {
        id: generateId(),
        content,
        createdAt: new Date().toISOString(),
      };
      const updatedBroker = { ...broker, notes: [...broker.notes, note] };
      const updated = brokersRef.current.map((b) =>
        b.id === brokerId ? updatedBroker : b
      );
      setBrokers(updated);
      await saveLocal("ai_planner_brokers", updated);
      return note;
    },
    [addBrokerNoteMut, saveLocal]
  );

  const removeBrokerNote = useCallback(
    async (brokerId: string, noteId: string) => {
      setBrokers((prev) =>
        prev.map((b) =>
          b.id === brokerId
            ? { ...b, notes: b.notes.filter((n) => n.id !== noteId) }
            : b
        )
      );

      if (isCloudRef.current) {
        try {
          const numNoteId = parseInt(noteId);
          if (!isNaN(numNoteId)) {
            await removeBrokerNoteMut.mutateAsync({ noteId: numNoteId });
          }
        } catch (err) {
          console.error("[DataProvider] Cloud removeBrokerNote failed:", err);
        }
      } else {
        const broker = brokersRef.current.find((b) => b.id === brokerId);
        if (!broker) return;
        const updatedBroker = {
          ...broker,
          notes: broker.notes.filter((n) => n.id !== noteId),
        };
        const updated = brokersRef.current.map((b) =>
          b.id === brokerId ? updatedBroker : b
        );
        await saveLocal("ai_planner_brokers", updated);
      }
    },
    [removeBrokerNoteMut, saveLocal]
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
      setSalesGoal((prev) => {
        const updated = { ...prev };
        if (updates.goalAmount !== undefined)
          updated.goalAmount = updates.goalAmount;
        if (updates.goalDeadline !== undefined)
          updated.goalDeadline = updates.goalDeadline;
        if (updates.currentSales !== undefined)
          updated.currentSales = updates.currentSales;
        if (
          updates.addToCurrentSales !== undefined &&
          updates.addToCurrentSales > 0
        ) {
          updated.currentSales = prev.currentSales + updates.addToCurrentSales;
        }

        // Save locally
        AsyncStorage.setItem(SALES_GOAL_KEY, JSON.stringify(updated));

        // Sync to cloud
        if (isCloudRef.current) {
          upsertSalesGoalMut
            .mutateAsync({
              currentSales: String(updated.currentSales),
              goalAmount: String(updated.goalAmount),
              goalDeadline: updated.goalDeadline,
            })
            .catch((err: unknown) =>
              console.error("[DataProvider] Cloud upsertSalesGoal failed:", err)
            );
        }

        return updated;
      });
    },
    [upsertSalesGoalMut]
  );

  // ─── Sync Local → Cloud ─────────────────────────────

  const syncLocalToCloud = useCallback(async () => {
    if (!isCloudRef.current) {
      return null;
    }
    setIsSyncing(true);
    try {
      // Read all local data from AsyncStorage
      const [localEvents, localRfps, localDeals, localBrokers] = await Promise.all([
        EventStore.getAll(),
        RfpStore.getAll(),
        DealStore.getAll(),
        BrokerStore.getAll(),
      ]);

      let localSalesGoal: { currentSales?: string; goalAmount?: string; goalDeadline?: string } | undefined;
      try {
        const savedGoal = await AsyncStorage.getItem(SALES_GOAL_KEY);
        if (savedGoal) {
          const parsed = JSON.parse(savedGoal);
          localSalesGoal = {
            currentSales: String(parsed.currentSales ?? 0),
            goalAmount: String(parsed.goalAmount ?? 0),
            goalDeadline: parsed.goalDeadline || "2026-12-01",
          };
        }
      } catch { }

      const hasLocalData = localEvents.length > 0 || localRfps.length > 0 || localDeals.length > 0 || localBrokers.length > 0;
      if (!hasLocalData && !localSalesGoal) {
        setIsSyncing(false);
        return null;
      }

      const result = await syncImportMut.mutateAsync({
        events: localEvents.map(e => ({
          title: e.title,
          description: e.description,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          reminderMinutes: e.reminderMinutes,
          sourceType: e.sourceType,
          sourceRfpId: e.sourceRfpId,
        })),
        rfps: localRfps.map(r => ({
          title: r.title,
          client: r.client,
          brokerContact: r.brokerContact,
          lives: r.lives,
          effectiveDate: r.effectiveDate,
          premium: r.premium,
          status: r.status,
          notes: r.notes,
          description: r.description,
          followUpDate: r.followUpDate,
        })),
        deals: localDeals.map(d => ({
          title: d.title,
          client: d.client,
          stage: d.stage,
          value: d.value,
          expectedCloseDate: d.expectedCloseDate,
          description: d.description,
        })),
        brokers: localBrokers.map(b => ({
          name: b.name,
          company: b.company,
          phone: b.phone,
          email: b.email,
          notes: b.notes?.map(n => ({ content: n.content })),
        })),
        salesGoal: localSalesGoal,
      });

      // After successful sync, clear local data to prevent duplicate imports
      await Promise.all([
        AsyncStorage.removeItem("ai_planner_events"),
        AsyncStorage.removeItem("ai_planner_rfps"),
        AsyncStorage.removeItem("ai_planner_deals"),
        AsyncStorage.removeItem("ai_planner_brokers"),
        AsyncStorage.removeItem("ai_planner_chat"),
      ]);

      // Refetch cloud data to get the imported items with proper IDs
      await Promise.all([
        eventsQueryRef.current.refetch(),
        rfpsQueryRef.current.refetch(),
        dealsQueryRef.current.refetch(),
        brokersQueryRef.current.refetch(),
        salesGoalQueryRef.current.refetch(),
      ]);

      setIsSyncing(false);
      return result;
    } catch (err) {
      console.error("[DataProvider] syncLocalToCloud failed:", err);
      setIsSyncing(false);
      return null;
    }
  }, [syncImportMut]);

  // Auto-sync local data to cloud when user first logs in
  useEffect(() => {
    if (isCloudMode && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      // Small delay to let cloud queries settle first
      const timer = setTimeout(() => {
        syncLocalToCloud().then((result) => {
          if (result) {
            console.log("[DataProvider] Auto-sync completed:", result);
          }
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCloudMode, syncLocalToCloud]);

  // ─── Refresh ───────────────────────────────────────

  const refreshAll = useCallback(async () => {
    if (isCloudRef.current) {
      // Refetch all queries from the server using refs (stable identity)
      await Promise.all([
        eventsQueryRef.current.refetch(),
        rfpsQueryRef.current.refetch(),
        dealsQueryRef.current.refetch(),
        brokersQueryRef.current.refetch(),
        salesGoalQueryRef.current.refetch(),
        chatHistoryQueryRef.current.refetch(),
      ]);
    } else {
      // Local mode: reload from AsyncStorage
      const [le, lr, ld, lc, lb] = await Promise.all([
        EventStore.getAll(),
        RfpStore.getAll(),
        DealStore.getAll(),
        ChatStore.getAll(),
        BrokerStore.getAll(),
      ]);
      setEvents(le);
      setRfps(lr);
      setDeals(ld);
      setChatMessages(lc);
      setBrokers(lb);

      try {
        const savedGoal = await AsyncStorage.getItem(SALES_GOAL_KEY);
        if (savedGoal)
          setSalesGoal({ ...DEFAULT_SALES_GOAL, ...JSON.parse(savedGoal) });
      } catch { }
    }
  }, []);

  return (
    <DataContext.Provider
      value={useMemo(() => ({
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
      }), [
        events, rfps, deals, chatMessages, brokers,
        user?.id, isLoading, isCloudMode, salesGoal, isSyncing,
        updateSalesGoal, createEvent, updateEvent, deleteEvent,
        createRfp, updateRfp, deleteRfp, createDeal, updateDeal, deleteDeal,
        addChatMessage, clearChat, createBroker, updateBroker, deleteBroker,
        addBrokerNote, removeBrokerNote, getOrCreateBroker, refreshAll, syncLocalToCloud,
      ])}
    >
      {children}
    </DataContext.Provider>
  );
}
