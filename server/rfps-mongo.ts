/**
 * RFP REST API backed by MongoDB.
 * Database: mongodb://localhost:27017/aiplanner
 * Collection: rfps
 */

import { MongoClient, ObjectId } from "mongodb";
import type { Request, Response } from "express";
import { authRequired } from "./auth-mongo";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/aiplanner";
const COLLECTION_NAME = "rfps";

export type RfpDocument = {
  _id?: ObjectId;
  userId: string;
  title: string;
  client: string;
  brokerContact?: string;
  lives?: number;
  effectiveDate?: string;
  premium?: string;
  status: "draft" | "recommended" | "sold";
  notes?: string;
  description?: string;
  followUpDate?: string;
  createdAt: string;
};

let client: MongoClient | null = null;

async function getClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    let res= await client.connect();
       console.log("MongoDB Connected ✅",res);
  }
  return client;
}

async function getCollection() {
  const c = await getClient();
  return c.db().collection<RfpDocument>(COLLECTION_NAME);
}

function toRfpResponse(doc: RfpDocument & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    client: doc.client,
    brokerContact: doc.brokerContact,
    lives: doc.lives,
    effectiveDate: doc.effectiveDate,
    premium: doc.premium,
    status: doc.status,
    notes: doc.notes,
    description: doc.description,
    followUpDate: doc.followUpDate,
    createdAt: doc.createdAt,
  };
}

export async function listRfps(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const col = await getCollection();
    const docs = await col.find({ userId }).sort({ createdAt: -1 }).toArray();
    res.json(docs.map(toRfpResponse));
  } catch (err) {
    console.error("[rfps-mongo] list error:", err);
    res.status(500).json({ error: "Failed to list RFPs" });
  }
}

export async function getRfpById(req: Request, res: Response): Promise<void> {
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
      res.status(404).json({ error: "RFP not found" });
      return;
    }
    res.json(toRfpResponse(doc as RfpDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[rfps-mongo] getById error:", err);
    res.status(500).json({ error: "Failed to get RFP" });
  }
}

export async function createRfp(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const clientName = typeof body.client === "string" ? body.client.trim() : "";
    if (!title || !clientName) {
      res.status(400).json({ error: "title and client are required" });
      return;
    }
    const status = body.status === "recommended" || body.status === "sold" ? body.status : "draft";
    const doc: RfpDocument = {
      userId,
      title,
      client: clientName,
      brokerContact: typeof body.brokerContact === "string" ? body.brokerContact : undefined,
      lives: typeof body.lives === "number" ? body.lives : undefined,
      effectiveDate: typeof body.effectiveDate === "string" ? body.effectiveDate : undefined,
      premium: typeof body.premium === "string" ? body.premium : undefined,
      status,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      followUpDate: typeof body.followUpDate === "string" ? body.followUpDate : undefined,
      createdAt: new Date().toISOString(),
    };
    const col = await getCollection();
    const result = await col.insertOne(doc as RfpDocument & { _id?: ObjectId });
    const inserted = await col.findOne({ _id: result.insertedId });
    if (!inserted) {
      res.status(500).json({ error: "Failed to read created RFP" });
      return;
    }
    res.status(201).json(toRfpResponse(inserted as RfpDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[rfps-mongo] create error:", err);
    res.status(500).json({ error: "Failed to create RFP" });
  }
}

export async function updateRfp(req: Request, res: Response): Promise<void> {
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
    const update: Partial<RfpDocument> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.client === "string") update.client = body.client.trim();
    if (body.brokerContact !== undefined) update.brokerContact = typeof body.brokerContact === "string" ? body.brokerContact : undefined;
    if (body.lives !== undefined) update.lives = typeof body.lives === "number" ? body.lives : undefined;
    if (body.effectiveDate !== undefined) update.effectiveDate = typeof body.effectiveDate === "string" ? body.effectiveDate : undefined;
    if (body.premium !== undefined) update.premium = typeof body.premium === "string" ? body.premium : undefined;
    if (body.status === "recommended" || body.status === "sold" || body.status === "draft") update.status = body.status;
    if (body.notes !== undefined) update.notes = typeof body.notes === "string" ? body.notes : undefined;
    if (body.description !== undefined) update.description = typeof body.description === "string" ? body.description : undefined;
    if (body.followUpDate !== undefined) update.followUpDate = typeof body.followUpDate === "string" ? body.followUpDate : undefined;

    if (Object.keys(update).length === 0) {
      const col = await getCollection();
      const doc = await col.findOne({ _id: oid, userId });
      if (!doc) {
        res.status(404).json({ error: "RFP not found" });
        return;
      }
      res.json(toRfpResponse(doc as RfpDocument & { _id: ObjectId }));
      return;
    }

    const col = await getCollection();
    const result = await col.findOneAndUpdate(
      { _id: oid, userId },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ error: "RFP not found" });
      return;
    }
    res.json(toRfpResponse(result as RfpDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[rfps-mongo] update error:", err);
    res.status(500).json({ error: "Failed to update RFP" });
  }
}

export async function deleteRfp(req: Request, res: Response): Promise<void> {
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
      res.status(404).json({ error: "RFP not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[rfps-mongo] delete error:", err);
    res.status(500).json({ error: "Failed to delete RFP" });
  }
}

export function registerRfpRoutes(app: import("express").Express): void {
  app.get("/api/rfps", authRequired, listRfps);
  app.get("/api/rfps/:id", authRequired, getRfpById);
  app.post("/api/rfps", authRequired, createRfp);
  app.put("/api/rfps/:id", authRequired, updateRfp);
  app.delete("/api/rfps/:id", authRequired, deleteRfp);
}
