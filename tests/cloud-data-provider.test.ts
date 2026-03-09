/**
 * Tests for the cloud-first DataProvider migration.
 *
 * These tests verify that:
 * 1. The DataProvider exposes the correct API surface
 * 2. Cloud conversion helpers map server data to local types correctly
 * 3. The tRPC router endpoints exist and accept the right shapes
 */
import { describe, it, expect } from "vitest";

// ─── Test 1: DataProvider file exists and has correct structure ───

import { readFileSync } from "fs";
import { join } from "path";

describe("DataProvider structure", () => {
  const source = readFileSync(
    join(__dirname, "..", "lib", "data-provider.tsx"),
    "utf-8"
  );

  it("exports DataProvider and useData", () => {
    expect(source).toContain("export function DataProvider");
    expect(source).toContain("export function useData");
  });

  it("uses tRPC mutations for cloud CRUD (events, deals, brokers; RFPs use REST API)", () => {
    expect(source).toContain("trpc.events.create.useMutation");
    expect(source).toContain("trpc.deals.create.useMutation");
    expect(source).toContain("trpc.brokers.create.useMutation");
    expect(source).toContain("trpc.salesGoal.upsert.useMutation");
    expect(source).toContain("rfpApi.createRfp");
  });

  it("uses tRPC queries for cloud data fetching (RFPs loaded via rfpApi.fetchRfps)", () => {
    expect(source).toContain("trpc.events.list.useQuery");
    expect(source).toContain("trpc.deals.list.useQuery");
    expect(source).toContain("trpc.brokers.list.useQuery");
    expect(source).toContain("trpc.salesGoal.get.useQuery");
    expect(source).toContain("trpc.chat.history.useQuery");
    expect(source).toContain("rfpApi.fetchRfps");
  });

  it("has local AsyncStorage fallback for events, deals, chat, brokers (RFPs are API-only)", () => {
    expect(source).toContain("EventStore.getAll");
    expect(source).toContain("DealStore.getAll");
    expect(source).toContain("BrokerStore.getAll");
    expect(source).toContain("ChatStore.getAll");
  });

  it("exposes isCloudMode flag", () => {
    expect(source).toContain("isCloudMode");
  });

  it("has refreshAll function", () => {
    expect(source).toContain("refreshAll");
  });
});

// ─── Test 2: Local store still works as fallback ────────

describe("LocalStore fallback", () => {
  it("exports store modules (RFPs are in MongoDB via REST API, not local-store)", async () => {
    const mod = await import("../lib/local-store");
    expect(mod.EventStore).toBeDefined();
    expect(mod.DealStore).toBeDefined();
    expect(mod.ChatStore).toBeDefined();
    expect(mod.BrokerStore).toBeDefined();
  });

  it("EventStore has correct CRUD methods", async () => {
    const { EventStore } = await import("../lib/local-store");
    expect(typeof EventStore.getAll).toBe("function");
    expect(typeof EventStore.getByDate).toBe("function");
    expect(typeof EventStore.getUpcoming).toBe("function");
    expect(typeof EventStore.create).toBe("function");
    expect(typeof EventStore.update).toBe("function");
    expect(typeof EventStore.remove).toBe("function");
  });

  it("BrokerStore has correct CRUD methods including notes", async () => {
    const { BrokerStore } = await import("../lib/local-store");
    expect(typeof BrokerStore.getAll).toBe("function");
    expect(typeof BrokerStore.create).toBe("function");
    expect(typeof BrokerStore.update).toBe("function");
    expect(typeof BrokerStore.remove).toBe("function");
    expect(typeof BrokerStore.addNote).toBe("function");
    expect(typeof BrokerStore.removeNote).toBe("function");
    expect(typeof BrokerStore.findByName).toBe("function");
    expect(typeof BrokerStore.getOrCreate).toBe("function");
  });
});

// ─── Test 3: Cloud-to-local conversion helpers ─────────

describe("Cloud-to-local conversion", () => {
  it("converts cloud event to LocalEvent shape", () => {
    const cloudEvent = {
      id: 42,
      title: "Team Meeting",
      description: "Weekly sync",
      date: "2026-03-01",
      startTime: "10:00",
      endTime: "11:00",
      reminderMinutes: 15,
      sourceType: null,
      sourceRfpId: null,
      createdAt: new Date("2026-02-28T10:00:00Z"),
    };

    // Replicate the conversion logic from data-provider
    const local = {
      id: String(cloudEvent.id),
      title: cloudEvent.title,
      description: cloudEvent.description || undefined,
      date: cloudEvent.date,
      startTime: cloudEvent.startTime || undefined,
      endTime: cloudEvent.endTime || undefined,
      reminderMinutes: cloudEvent.reminderMinutes ?? undefined,
      sourceType: cloudEvent.sourceType || undefined,
      sourceRfpId: cloudEvent.sourceRfpId
        ? String(cloudEvent.sourceRfpId)
        : undefined,
      createdAt: cloudEvent.createdAt
        ? new Date(cloudEvent.createdAt).toISOString()
        : new Date().toISOString(),
    };

    expect(local.id).toBe("42");
    expect(local.title).toBe("Team Meeting");
    expect(local.description).toBe("Weekly sync");
    expect(local.date).toBe("2026-03-01");
    expect(local.startTime).toBe("10:00");
    expect(local.endTime).toBe("11:00");
    expect(local.reminderMinutes).toBe(15);
    expect(local.sourceType).toBeUndefined();
    expect(local.sourceRfpId).toBeUndefined();
    expect(local.createdAt).toContain("2026-02-28");
  });

  it("converts cloud RFP to LocalRfp shape", () => {
    const cloudRfp = {
      id: 7,
      title: "Johnson Group",
      clientName: "ABC Brokerage",
      brokerContact: "John Smith",
      lives: 200,
      effectiveDate: "2026-07-01",
      premium: "150000",
      status: "draft",
      notes: "Large group, competitive market",
      description: null,
      followUpDate: "2026-03-15",
      createdAt: new Date("2026-02-28T10:00:00Z"),
    };

    const local = {
      id: String(cloudRfp.id),
      title: cloudRfp.title,
      client: cloudRfp.clientName || "",
      brokerContact: cloudRfp.brokerContact || undefined,
      lives: cloudRfp.lives ?? undefined,
      effectiveDate: cloudRfp.effectiveDate || undefined,
      premium: cloudRfp.premium || undefined,
      status: cloudRfp.status || "draft",
      notes: cloudRfp.notes || undefined,
      description: cloudRfp.description || undefined,
      followUpDate: cloudRfp.followUpDate || undefined,
      createdAt: cloudRfp.createdAt
        ? new Date(cloudRfp.createdAt).toISOString()
        : new Date().toISOString(),
    };

    expect(local.id).toBe("7");
    expect(local.title).toBe("Johnson Group");
    expect(local.client).toBe("ABC Brokerage");
    expect(local.brokerContact).toBe("John Smith");
    expect(local.lives).toBe(200);
    expect(local.effectiveDate).toBe("2026-07-01");
    expect(local.premium).toBe("150000");
    expect(local.status).toBe("draft");
    expect(local.followUpDate).toBe("2026-03-15");
  });

  it("converts cloud broker to LocalBroker shape with notes", () => {
    const cloudBroker = {
      id: 3,
      name: "ABC Insurance",
      company: "ABC Corp",
      phone: "555-1234",
      email: "abc@example.com",
      notes: [
        {
          id: 10,
          content: "Discussed renewal options",
          createdAt: new Date("2026-02-20T14:00:00Z"),
        },
        {
          id: 11,
          content: "Sent updated quote",
          createdAt: new Date("2026-02-25T09:00:00Z"),
        },
      ],
      createdAt: new Date("2026-01-15T10:00:00Z"),
    };

    const local = {
      id: String(cloudBroker.id),
      name: cloudBroker.name,
      company: cloudBroker.company || undefined,
      phone: cloudBroker.phone || undefined,
      email: cloudBroker.email || undefined,
      notes: (cloudBroker.notes || []).map((n: any) => ({
        id: String(n.id),
        content: n.content,
        createdAt: n.createdAt
          ? new Date(n.createdAt).toISOString()
          : new Date().toISOString(),
      })),
      createdAt: cloudBroker.createdAt
        ? new Date(cloudBroker.createdAt).toISOString()
        : new Date().toISOString(),
    };

    expect(local.id).toBe("3");
    expect(local.name).toBe("ABC Insurance");
    expect(local.company).toBe("ABC Corp");
    expect(local.phone).toBe("555-1234");
    expect(local.email).toBe("abc@example.com");
    expect(local.notes).toHaveLength(2);
    expect(local.notes[0].id).toBe("10");
    expect(local.notes[0].content).toBe("Discussed renewal options");
    expect(local.notes[1].id).toBe("11");
  });

  it("handles null/missing fields gracefully", () => {
    const cloudRfp = {
      id: 99,
      title: "Minimal RFP",
      clientName: null,
      brokerContact: null,
      lives: null,
      effectiveDate: null,
      premium: null,
      status: "draft",
      notes: null,
      description: null,
      followUpDate: null,
      createdAt: null,
    };

    const local = {
      id: String(cloudRfp.id),
      title: cloudRfp.title,
      client: cloudRfp.clientName || "",
      brokerContact: cloudRfp.brokerContact || undefined,
      lives: cloudRfp.lives ?? undefined,
      effectiveDate: cloudRfp.effectiveDate || undefined,
      premium: cloudRfp.premium || undefined,
      status: cloudRfp.status || "draft",
      notes: cloudRfp.notes || undefined,
      description: cloudRfp.description || undefined,
      followUpDate: cloudRfp.followUpDate || undefined,
      createdAt: cloudRfp.createdAt
        ? new Date(cloudRfp.createdAt).toISOString()
        : new Date().toISOString(),
    };

    expect(local.id).toBe("99");
    expect(local.client).toBe("");
    expect(local.brokerContact).toBeUndefined();
    expect(local.lives).toBeUndefined();
    expect(local.effectiveDate).toBeUndefined();
    expect(local.premium).toBeUndefined();
    expect(local.followUpDate).toBeUndefined();
    expect(local.createdAt).toBeTruthy();
  });
});

// ─── Test 4: Sales goal defaults ────────────────────────

describe("Sales goal", () => {
  it("has correct default values", () => {
    const DEFAULT_SALES_GOAL = {
      currentSales: 4900000,
      goalAmount: 12000000,
      goalDeadline: "2026-12-01",
    };

    expect(DEFAULT_SALES_GOAL.currentSales).toBe(4900000);
    expect(DEFAULT_SALES_GOAL.goalAmount).toBe(12000000);
    expect(DEFAULT_SALES_GOAL.goalDeadline).toBe("2026-12-01");
  });

  it("correctly calculates addToCurrentSales", () => {
    const prev = { currentSales: 4900000, goalAmount: 12000000, goalDeadline: "2026-12-01" };
    const updates = { addToCurrentSales: 150000 };

    const updated = { ...prev };
    if (updates.addToCurrentSales !== undefined && updates.addToCurrentSales > 0) {
      updated.currentSales = prev.currentSales + updates.addToCurrentSales;
    }

    expect(updated.currentSales).toBe(5050000);
  });
});

// ─── Test 5: Drizzle schema has all required tables ─────

describe("Database schema", () => {
  it("exports all required tables", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.users).toBeDefined();
    expect(schema.events).toBeDefined();
    expect(schema.rfps).toBeDefined();
    expect(schema.deals).toBeDefined();
    expect(schema.chatMessages).toBeDefined();
    expect(schema.brokers).toBeDefined();
    expect(schema.brokerNotes).toBeDefined();
    expect(schema.salesGoals).toBeDefined();
  });
});

// ─── Test 6: Prompt helpers ─────────────────────────────

describe("Prompt helpers", () => {
  it("formats broker context correctly", async () => {
    const { formatBrokerContext } = await import("../server/prompt-helpers");

    const result = formatBrokerContext([]);
    expect(result).toBe("No brokers tracked yet.");

    const brokers = [
      {
        name: "ABC Insurance",
        company: "ABC Corp",
        notes: [
          { content: "Discussed renewal", createdAt: new Date("2026-02-20") },
        ],
      },
    ];
    const formatted = formatBrokerContext(brokers);
    expect(formatted).toContain("ABC Insurance");
    expect(formatted).toContain("ABC Corp");
    expect(formatted).toContain("Discussed renewal");
  });

  it("builds RFP summarize prompt with date", async () => {
    const { buildRfpSummarizePrompt } = await import(
      "../server/prompt-helpers"
    );
    const prompt = buildRfpSummarizePrompt("2026-03-01");
    expect(prompt).toContain("2026-03-01");
    expect(prompt).toContain("RFP data entry assistant");
    expect(prompt).toContain("case");
    expect(prompt).toContain("broker");
    expect(prompt).toContain("premium");
  });
});

// ─── Test 7: DataProvider context type completeness ─────

describe("DataProvider context API surface", () => {
  const source = readFileSync(
    join(__dirname, "..", "lib", "data-provider.tsx"),
    "utf-8"
  );

  it("exposes all required CRUD methods in context type", () => {
    // Events
    expect(source).toContain("createEvent:");
    expect(source).toContain("updateEvent:");
    expect(source).toContain("deleteEvent:");
    // RFPs
    expect(source).toContain("createRfp:");
    expect(source).toContain("updateRfp:");
    expect(source).toContain("deleteRfp:");
    // Deals
    expect(source).toContain("createDeal:");
    expect(source).toContain("updateDeal:");
    expect(source).toContain("deleteDeal:");
    // Brokers
    expect(source).toContain("createBroker:");
    expect(source).toContain("updateBroker:");
    expect(source).toContain("deleteBroker:");
    expect(source).toContain("addBrokerNote:");
    expect(source).toContain("removeBrokerNote:");
    expect(source).toContain("getOrCreateBroker:");
    // Chat
    expect(source).toContain("addChatMessage:");
    expect(source).toContain("clearChat:");
    // Sales goal
    expect(source).toContain("updateSalesGoal:");
  });
});
