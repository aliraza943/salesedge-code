import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // Optional for email/password users
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: text("password"), // Added for email/password auth
  loginMethod: varchar("loginMethod", { length: 64 }).default("email").notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Calendar events table
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar("startTime", { length: 5 }), // HH:MM
  endTime: varchar("endTime", { length: 5 }), // HH:MM
  allDay: boolean("allDay").default(false).notNull(),
  reminderMinutes: int("reminderMinutes"),
  sourceType: varchar("sourceType", { length: 32 }), // e.g. "follow-up"
  sourceRfpId: int("sourceRfpId"), // links back to originating RFP
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * RFP (Request for Proposal) tracker table
 * Fields: Case, Broker, Broker Contact, Lives, Effective Date, Premium, Notes
 * Stages: draft → recommended → sold
 */
export const rfps = mysqlTable("rfps", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  brokerContact: varchar("brokerContact", { length: 255 }),
  lives: int("lives"),
  effectiveDate: varchar("effectiveDate", { length: 10 }), // YYYY-MM-DD
  premium: decimal("premium", { precision: 12, scale: 2 }),
  status: mysqlEnum("status", ["draft", "submitted", "under_review", "won", "lost", "recommended", "sold"]).default("draft").notNull(),
  notes: text("notes"),
  description: text("description"),
  deadline: varchar("deadline", { length: 10 }),
  followUpDate: varchar("followUpDate", { length: 10 }), // YYYY-MM-DD
  estimatedValue: decimal("estimatedValue", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rfp = typeof rfps.$inferSelect;
export type InsertRfp = typeof rfps.$inferInsert;

/**
 * Sales deals table
 */
export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  value: decimal("value", { precision: 12, scale: 2 }),
  stage: mysqlEnum("stage", ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]).default("lead").notNull(),
  expectedCloseDate: varchar("expectedCloseDate", { length: 10 }), // YYYY-MM-DD
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;

/**
 * Chat messages for AI conversation history
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Brokers table — tracks broker companies/contacts
 */
export const brokers = mysqlTable("brokers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Broker = typeof brokers.$inferSelect;
export type InsertBroker = typeof brokers.$inferInsert;

/**
 * Broker notes — conversation notes linked to a broker
 */
export const brokerNotes = mysqlTable("broker_notes", {
  id: int("id").autoincrement().primaryKey(),
  brokerId: int("brokerId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrokerNote = typeof brokerNotes.$inferSelect;
export type InsertBrokerNote = typeof brokerNotes.$inferInsert;

/**
 * Sales goals — per-user sales targets
 */
export const salesGoals = mysqlTable("sales_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  currentSales: decimal("currentSales", { precision: 14, scale: 2 }).default("0").notNull(),
  goalAmount: decimal("goalAmount", { precision: 14, scale: 2 }).default("0").notNull(),
  goalDeadline: varchar("goalDeadline", { length: 10 }).notNull(), // YYYY-MM-DD
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SalesGoal = typeof salesGoals.$inferSelect;
export type InsertSalesGoal = typeof salesGoals.$inferInsert;
