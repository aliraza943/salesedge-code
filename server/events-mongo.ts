/**
 * Events REST API backed by MongoDB.
 * Collection: events
 */

import { ObjectId } from "mongodb";
import type { Request, Response } from "express";
import { getDb } from "./mongo-client";

const COLLECTION_NAME = "events";

export type EventDocument = {
  _id?: ObjectId;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  reminderMinutes?: number;
  sourceType?: string;
  sourceRfpId?: string;
  createdAt: string;
};

async function getCollection() {
  const db = await getDb();
  return db.collection<EventDocument>(COLLECTION_NAME);
}

function toResponse(doc: EventDocument & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    date: doc.date,
    startTime: doc.startTime,
    endTime: doc.endTime,
    reminderMinutes: doc.reminderMinutes,
    sourceType: doc.sourceType,
    sourceRfpId: doc.sourceRfpId,
    createdAt: doc.createdAt,
  };
}

export async function listEvents(_req: Request, res: Response): Promise<void> {
  try {
    const col = await getCollection();
    const docs = await col.find({}).sort({ date: 1, startTime: 1 }).toArray();
    res.json(docs.map((d) => toResponse(d as EventDocument & { _id: ObjectId })));
  } catch (err) {
    console.error("[events-mongo] list error:", err);
    res.status(500).json({ error: "Failed to list events" });
  }
}

export async function getEventById(req: Request, res: Response): Promise<void> {
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
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(toResponse(doc as EventDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[events-mongo] getById error:", err);
    res.status(500).json({ error: "Failed to get event" });
  }
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    if (!title || !date) {
      res.status(400).json({ error: "title and date are required" });
      return;
    }
    const doc: EventDocument = {
      title,
      date,
      description: typeof body.description === "string" ? body.description : undefined,
      startTime: typeof body.startTime === "string" ? body.startTime : undefined,
      endTime: typeof body.endTime === "string" ? body.endTime : undefined,
      reminderMinutes: typeof body.reminderMinutes === "number" ? body.reminderMinutes : undefined,
      sourceType: typeof body.sourceType === "string" ? body.sourceType : undefined,
      sourceRfpId: typeof body.sourceRfpId === "string" ? body.sourceRfpId : undefined,
      createdAt: new Date().toISOString(),
    };
    const col = await getCollection();
    const result = await col.insertOne(doc as EventDocument & { _id?: ObjectId });
    const inserted = await col.findOne({ _id: result.insertedId });
    if (!inserted) {
      res.status(500).json({ error: "Failed to read created event" });
      return;
    }
    res.status(201).json(toResponse(inserted as EventDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[events-mongo] create error:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
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
    const update: Partial<EventDocument> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.date === "string") update.date = body.date.trim();
    if (body.description !== undefined) update.description = typeof body.description === "string" ? body.description : undefined;
    if (body.startTime !== undefined) update.startTime = typeof body.startTime === "string" ? body.startTime : undefined;
    if (body.endTime !== undefined) update.endTime = typeof body.endTime === "string" ? body.endTime : undefined;
    if (body.reminderMinutes !== undefined) update.reminderMinutes = typeof body.reminderMinutes === "number" ? body.reminderMinutes : undefined;
    if (body.sourceType !== undefined) update.sourceType = typeof body.sourceType === "string" ? body.sourceType : undefined;
    if (body.sourceRfpId !== undefined) update.sourceRfpId = typeof body.sourceRfpId === "string" ? body.sourceRfpId : undefined;

    const col = await getCollection();
    if (Object.keys(update).length === 0) {
      const doc = await col.findOne({ _id: oid });
      if (!doc) {
        res.status(404).json({ error: "Event not found" });
        return;
      }
      res.json(toResponse(doc as EventDocument & { _id: ObjectId }));
      return;
    }
    const result = await col.findOneAndUpdate(
      { _id: oid },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(toResponse(result as EventDocument & { _id: ObjectId }));
  } catch (err) {
    console.error("[events-mongo] update error:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
}

export async function deleteEvent(req: Request, res: Response): Promise<void> {
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
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[events-mongo] delete error:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
}

export function registerEventRoutes(app: import("express").Express): void {
  app.get("/api/events", listEvents);
  app.get("/api/events/:id", getEventById);
  app.post("/api/events", createEvent);
  app.put("/api/events/:id", updateEvent);
  app.delete("/api/events/:id", deleteEvent);
}
