import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  events, InsertEvent,
  rfps, InsertRfp,
  deals, InsertDeal,
  chatMessages, InsertChatMessage,
  brokers, InsertBroker,
  brokerNotes, InsertBrokerNote,
  salesGoals, InsertSalesGoal,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// --- User Operations ---

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(users).values(data).$returningId();
  return result.id;
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUserAndData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Use a transaction for atomic deletion
  // Note: Standard drizzle transaction might vary by driver, but we'll do sequential deletes for safety if tx isn't available
  await db.delete(events).where(eq(events.userId, userId));
  await db.delete(rfps).where(eq(rfps.userId, userId));
  await db.delete(deals).where(eq(deals.userId, userId));
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  await db.delete(brokerNotes).where(eq(brokerNotes.userId, userId));
  await db.delete(brokers).where(eq(brokers.userId, userId));
  await db.delete(salesGoals).where(eq(salesGoals.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Event Queries ──────────────────────────────────────────────

export async function getUserEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events).where(eq(events.userId, userId)).orderBy(events.date, events.startTime);
}

export async function getEventsByDate(userId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events).where(and(eq(events.userId, userId), eq(events.date, date))).orderBy(events.startTime);
}

export async function createEvent(data: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(events).values(data).$returningId();
  return result.id;
}

export async function updateEvent(id: number, userId: number, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(events).set(data).where(and(eq(events.id, id), eq(events.userId, userId)));
}

export async function deleteEvent(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
}

// ─── RFP Queries ────────────────────────────────────────────────

export async function getUserRfps(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rfps).where(eq(rfps.userId, userId)).orderBy(desc(rfps.updatedAt));
}

export async function getRfpById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(rfps).where(and(eq(rfps.id, id), eq(rfps.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createRfp(data: InsertRfp) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(rfps).values(data).$returningId();
  return result.id;
}

export async function updateRfp(id: number, userId: number, data: Partial<InsertRfp>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(rfps).set(data).where(and(eq(rfps.id, id), eq(rfps.userId, userId)));
}

export async function deleteRfp(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rfps).where(and(eq(rfps.id, id), eq(rfps.userId, userId)));
}

// ─── Deal Queries ───────────────────────────────────────────────

export async function getUserDeals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deals).where(eq(deals.userId, userId)).orderBy(desc(deals.updatedAt));
}

export async function getDealById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deals).where(and(eq(deals.id, id), eq(deals.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createDeal(data: InsertDeal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(deals).values(data).$returningId();
  return result.id;
}

export async function updateDeal(id: number, userId: number, data: Partial<InsertDeal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(deals).set(data).where(and(eq(deals.id, id), eq(deals.userId, userId)));
}

export async function deleteDeal(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(deals).where(and(eq(deals.id, id), eq(deals.userId, userId)));
}

// ─── Chat Message Queries ───────────────────────────────────────

export async function getChatHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
}

export async function saveChatMessage(data: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(chatMessages).values(data).$returningId();
  return result.id;
}

export async function clearChatHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}

// ─── Broker Queries ─────────────────────────────────────────────

export async function getUserBrokers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const brokerList = await db.select().from(brokers).where(eq(brokers.userId, userId)).orderBy(brokers.name);
  // Attach notes to each broker
  const brokerIds = brokerList.map(b => b.id);
  if (brokerIds.length === 0) return brokerList.map(b => ({ ...b, notes: [] }));
  const allNotes = await db.select().from(brokerNotes).where(eq(brokerNotes.userId, userId)).orderBy(desc(brokerNotes.createdAt));
  const notesByBroker = new Map<number, typeof allNotes>();
  for (const note of allNotes) {
    const existing = notesByBroker.get(note.brokerId) || [];
    existing.push(note);
    notesByBroker.set(note.brokerId, existing);
  }
  return brokerList.map(b => ({ ...b, notes: notesByBroker.get(b.id) || [] }));
}

export async function getBrokerById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brokers).where(and(eq(brokers.id, id), eq(brokers.userId, userId))).limit(1);
  if (result.length === 0) return undefined;
  const notes = await db.select().from(brokerNotes).where(and(eq(brokerNotes.brokerId, id), eq(brokerNotes.userId, userId))).orderBy(desc(brokerNotes.createdAt));
  return { ...result[0], notes };
}

export async function createBroker(data: InsertBroker) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(brokers).values(data).$returningId();
  return result.id;
}

export async function updateBroker(id: number, userId: number, data: Partial<InsertBroker>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(brokers).set(data).where(and(eq(brokers.id, id), eq(brokers.userId, userId)));
}

export async function deleteBroker(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete notes first
  await db.delete(brokerNotes).where(and(eq(brokerNotes.brokerId, id), eq(brokerNotes.userId, userId)));
  await db.delete(brokers).where(and(eq(brokers.id, id), eq(brokers.userId, userId)));
}

export async function addBrokerNote(data: InsertBrokerNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(brokerNotes).values(data).$returningId();
  return result.id;
}

export async function removeBrokerNote(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(brokerNotes).where(and(eq(brokerNotes.id, id), eq(brokerNotes.userId, userId)));
}

// ─── Sales Goal Queries ─────────────────────────────────────────

export async function getUserSalesGoal(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(salesGoals).where(eq(salesGoals.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertSalesGoal(userId: number, data: { currentSales?: string; goalAmount?: string; goalDeadline?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserSalesGoal(userId);
  if (existing) {
    const updateData: Record<string, unknown> = {};
    if (data.currentSales !== undefined) updateData.currentSales = data.currentSales;
    if (data.goalAmount !== undefined) updateData.goalAmount = data.goalAmount;
    if (data.goalDeadline !== undefined) updateData.goalDeadline = data.goalDeadline;
    if (Object.keys(updateData).length > 0) {
      await db.update(salesGoals).set(updateData).where(eq(salesGoals.id, existing.id));
    }
    return existing.id;
  } else {
    const [result] = await db.insert(salesGoals).values({
      userId,
      currentSales: data.currentSales || "0",
      goalAmount: data.goalAmount || "0",
      goalDeadline: data.goalDeadline || "2026-12-01",
    }).$returningId();
    return result.id;
  }
}
