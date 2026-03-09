/**
 * Chat REST API backed by MongoDB.
 * Collection: chatMessages
 */

import { ObjectId } from "mongodb";
import type { Request, Response } from "express";
import { getDb } from "./mongo-client";

const COLLECTION_NAME = "chatMessages";

export type ChatMessageDocument = {
  _id?: ObjectId;
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ type: string; result?: unknown; data?: Record<string, unknown> }>;
  createdAt: string;
};

async function getCollection() {
  const db = await getDb();
  return db.collection<ChatMessageDocument>(COLLECTION_NAME);
}

function toResponse(doc: ChatMessageDocument & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    role: doc.role,
    content: doc.content,
    actions: doc.actions,
    createdAt: doc.createdAt,
  };
}

export async function listChatMessages(_req: Request, res: Response): Promise<void> {
  try {
    const col = await getCollection();
    const docs = await col.find({}).sort({ createdAt: 1 }).toArray();
    res.json(docs.map((d) => toResponse(d as ChatMessageDocument & { _id: ObjectId })));
  } catch (err) {
    console.error("[chat-mongo] list error:", err);
    res.status(500).json({ error: "Failed to list chat messages" });
  }
}

export async function addChatMessage(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const role = body.role === "assistant" ? "assistant" : "user";
    const content = typeof body.content === "string" ? body.content : "";
    const doc: ChatMessageDocument = {
      role,
      content,
      actions: Array.isArray(body.actions) ? body.actions as any : undefined,
      createdAt: new Date().toISOString(),
    };
    const col = await getCollection();
    const result = await col.insertOne(doc as ChatMessageDocument & { _id?: ObjectId });
    const inserted = await col.findOne({ _id: result.insertedId });
    if (!inserted) {
      res.status(500).json({ error: "Failed to read created message" });
      return;
    }
    res.status(201).json(toResponse(inserted as ChatMessageDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[chat-mongo] add error:", err);
    res.status(500).json({ error: "Failed to add chat message" });
  }
}

export async function clearChat(_req: Request, res: Response): Promise<void> {
  try {
    const col = await getCollection();
    await col.deleteMany({});
    res.status(204).send();
  } catch (err) {
    console.error("[chat-mongo] clear error:", err);
    res.status(500).json({ error: "Failed to clear chat" });
  }
}

export function registerChatRoutes(app: import("express").Express): void {
  app.get("/api/chat", listChatMessages);
  app.post("/api/chat", addChatMessage);
  app.delete("/api/chat", clearChat);
}
