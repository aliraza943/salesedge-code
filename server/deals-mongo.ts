/**
 * Deals REST API backed by MongoDB.
 * Collection: deals
 */

import { ObjectId } from "mongodb";
import type { Request, Response } from "express";
import { getDb } from "./mongo-client";

const COLLECTION_NAME = "deals";

const STAGES = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"] as const;

export type DealDocument = {
  _id?: ObjectId;
  title: string;
  client: string;
  stage: string;
  value?: string;
  expectedCloseDate?: string;
  description?: string;
  createdAt: string;
};

async function getCollection() {
  const db = await getDb();
  return db.collection<DealDocument>(COLLECTION_NAME);
}

function toResponse(doc: DealDocument & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    client: doc.client,
    stage: doc.stage,
    value: doc.value,
    expectedCloseDate: doc.expectedCloseDate,
    description: doc.description,
    createdAt: doc.createdAt,
  };
}

export async function listDeals(_req: Request, res: Response): Promise<void> {
  try {
    const col = await getCollection();
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    res.json(docs.map((d) => toResponse(d as DealDocument & { _id: ObjectId })));
  } catch (err) {
    console.error("[deals-mongo] list error:", err);
    res.status(500).json({ error: "Failed to list deals" });
  }
}

export async function getDealById(req: Request, res: Response): Promise<void> {
  try {
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
    const doc = await col.findOne({ _id: oid });
    if (!doc) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.json(toResponse(doc as DealDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[deals-mongo] getById error:", err);
    res.status(500).json({ error: "Failed to get deal" });
  }
}

export async function createDeal(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const client = typeof body.client === "string" ? body.client.trim() : "";
    if (!title || !client) {
      res.status(400).json({ error: "title and client are required" });
      return;
    }
    const stage = STAGES.includes(body.stage as any) ? body.stage : "lead";
    const doc: DealDocument = {
      title,
      client,
      stage,
      value: typeof body.value === "string" ? body.value : undefined,
      expectedCloseDate: typeof body.expectedCloseDate === "string" ? body.expectedCloseDate : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      createdAt: new Date().toISOString(),
    };
    const col = await getCollection();
    const result = await col.insertOne(doc as DealDocument & { _id?: ObjectId });
    const inserted = await col.findOne({ _id: result.insertedId });
    if (!inserted) {
      res.status(500).json({ error: "Failed to read created deal" });
      return;
    }
    res.status(201).json(toResponse(inserted as DealDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[deals-mongo] create error:", err);
    res.status(500).json({ error: "Failed to create deal" });
  }
}

export async function updateDeal(req: Request, res: Response): Promise<void> {
  try {
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
    const update: Partial<DealDocument> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.client === "string") update.client = body.client.trim();
    if (body.stage !== undefined && STAGES.includes(body.stage as any)) update.stage = body.stage as string;
    if (body.value !== undefined) update.value = typeof body.value === "string" ? body.value : undefined;
    if (body.expectedCloseDate !== undefined) update.expectedCloseDate = typeof body.expectedCloseDate === "string" ? body.expectedCloseDate : undefined;
    if (body.description !== undefined) update.description = typeof body.description === "string" ? body.description : undefined;

    const col = await getCollection();
    if (Object.keys(update).length === 0) {
      const doc = await col.findOne({ _id: oid });
      if (!doc) {
        res.status(404).json({ error: "Deal not found" });
        return;
      }
      res.json(toResponse(doc as DealDocument & { _id: ObjectId }));
      return;
    }
    const result = await col.findOneAndUpdate(
      { _id: oid },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.json(toResponse(result as DealDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[deals-mongo] update error:", err);
    res.status(500).json({ error: "Failed to update deal" });
  }
}

export async function deleteDeal(req: Request, res: Response): Promise<void> {
  try {
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
    const result = await col.deleteOne({ _id: oid });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[deals-mongo] delete error:", err);
    res.status(500).json({ error: "Failed to delete deal" });
  }
}

export function registerDealRoutes(app: import("express").Express): void {
  app.get("/api/deals", listDeals);
  app.get("/api/deals/:id", getDealById);
  app.post("/api/deals", createDeal);
  app.put("/api/deals/:id", updateDeal);
  app.delete("/api/deals/:id", deleteDeal);
}
