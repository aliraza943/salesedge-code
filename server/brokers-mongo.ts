/**
 * Brokers REST API backed by MongoDB.
 * Collection: brokers (notes embedded as array)
 */

import { ObjectId } from "mongodb";
import type { Request, Response } from "express";
import { getDb } from "./mongo-client";
import { authRequired } from "./auth-mongo";

const COLLECTION_NAME = "brokers";

export type BrokerNoteDoc = {
  id: string;
  content: string;
  createdAt: string;
};

export type BrokerDocument = {
  _id?: ObjectId;
  userId: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  notes: BrokerNoteDoc[];
  createdAt: string;
};

async function getCollection() {
  const db = await getDb();
  return db.collection<BrokerDocument>(COLLECTION_NAME);
}

function toResponse(doc: BrokerDocument & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    company: doc.company,
    phone: doc.phone,
    email: doc.email,
    notes: doc.notes || [],
    createdAt: doc.createdAt,
  };
}

export async function listBrokers(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const col = await getCollection();
    const docs = await col.find({ userId }).sort({ createdAt: -1 }).toArray();
    res.json(docs.map((d) => toResponse(d as BrokerDocument & { _id: ObjectId })));
  } catch (err) {
    console.error("[brokers-mongo] list error:", err);
    res.status(500).json({ error: "Failed to list brokers" });
  }
}

export async function getBrokerById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const col = await getCollection();
    const doc = await col.findOne({ _id: oid, userId });
    if (!doc) {
      res.status(404).json({ error: "Broker not found" });
      return;
    }
    res.json(toResponse(doc as BrokerDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[brokers-mongo] getById error:", err);
    res.status(500).json({ error: "Failed to get broker" });
  }
}

export async function createBroker(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const notes: BrokerNoteDoc[] = Array.isArray(body.notes)
      ? (body.notes as any[]).map((n: any) => ({
          id: typeof n.id === "string" ? n.id : new ObjectId().toString(),
          content: typeof n.content === "string" ? n.content : "",
          createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString(),
        }))
      : [];
    const doc: BrokerDocument = {
      userId,
      name,
      company: typeof body.company === "string" ? body.company : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      notes,
      createdAt: new Date().toISOString(),
    };
    const col = await getCollection();
    const result = await col.insertOne(doc as BrokerDocument & { _id?: ObjectId });
    const inserted = await col.findOne({ _id: result.insertedId });
    if (!inserted) {
      res.status(500).json({ error: "Failed to read created broker" });
      return;
    }
    res.status(201).json(toResponse(inserted as BrokerDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[brokers-mongo] create error:", err);
    res.status(500).json({ error: "Failed to create broker" });
  }
}

export async function updateBroker(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const update: Partial<BrokerDocument> = {};
    if (typeof body.name === "string") update.name = body.name.trim();
    if (body.company !== undefined) update.company = typeof body.company === "string" ? body.company : undefined;
    if (body.phone !== undefined) update.phone = typeof body.phone === "string" ? body.phone : undefined;
    if (body.email !== undefined) update.email = typeof body.email === "string" ? body.email : undefined;

    const col = await getCollection();
    if (Object.keys(update).length === 0) {
      const doc = await col.findOne({ _id: oid, userId });
      if (!doc) {
        res.status(404).json({ error: "Broker not found" });
        return;
      }
      res.json(toResponse(doc as BrokerDocument & { _id: ObjectId }));
      return;
    }
    const result = await col.findOneAndUpdate(
      { _id: oid, userId },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ error: "Broker not found" });
      return;
    }
    res.json(toResponse(result as BrokerDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[brokers-mongo] update error:", err);
    res.status(500).json({ error: "Failed to update broker" });
  }
}

export async function deleteBroker(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const col = await getCollection();
    const result = await col.deleteOne({ _id: oid, userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Broker not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[brokers-mongo] delete error:", err);
    res.status(500).json({ error: "Failed to delete broker" });
  }
}

export async function addBrokerNote(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { id: brokerId } = req.params;
    if (!brokerId) {
      res.status(400).json({ error: "Missing broker id" });
      return;
    }
    let oid: ObjectId;
    try {
      oid = new ObjectId(brokerId);
    } catch {
      res.status(400).json({ error: "Invalid broker id" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const note: BrokerNoteDoc = {
      id: new ObjectId().toString(),
      content,
      createdAt: new Date().toISOString(),
    };
    const col = await getCollection();
    const result = await col.findOneAndUpdate(
      { _id: oid, userId },
      { $push: { notes: note } },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ error: "Broker not found" });
      return;
    }
    res.status(201).json(note);
  } catch (err) {
    console.error("[brokers-mongo] addNote error:", err);
    res.status(500).json({ error: "Failed to add note" });
  }
}

export async function removeBrokerNote(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const { id: brokerId, noteId } = req.params;
    if (!brokerId || !noteId) {
      res.status(400).json({ error: "Missing broker id or note id" });
      return;
    }
    let oid: ObjectId;
    try {
      oid = new ObjectId(brokerId);
    } catch {
      res.status(400).json({ error: "Invalid broker id" });
      return;
    }
    const col = await getCollection();
    const result = await col.findOneAndUpdate(
      { _id: oid, userId },
      { $pull: { notes: { id: noteId } } },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ error: "Broker not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[brokers-mongo] removeNote error:", err);
    res.status(500).json({ error: "Failed to remove note" });
  }
}

export function registerBrokerRoutes(app: import("express").Express): void {
  app.get("/api/brokers", authRequired, listBrokers);
  app.get("/api/brokers/:id", authRequired, getBrokerById);
  app.post("/api/brokers", authRequired, createBroker);
  app.put("/api/brokers/:id", authRequired, updateBroker);
  app.delete("/api/brokers/:id", authRequired, deleteBroker);
  app.post("/api/brokers/:id/notes", authRequired, addBrokerNote);
  app.delete("/api/brokers/:id/notes/:noteId", authRequired, removeBrokerNote);
}
