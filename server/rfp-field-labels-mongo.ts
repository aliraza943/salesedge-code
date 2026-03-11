/**
 * RFP field label preferences REST API backed by MongoDB.
 * One document per user: { _id: userId, labels: { case?: string, ... }, updatedAt }
 */

import type { Request, Response } from "express";
import { getDb } from "./mongo-client";
import { authRequired } from "./auth-mongo";
import type { RfpFieldLabelOverrides } from "../constants/rfp-field-labels";

const COLLECTION_NAME = "rfp_field_labels";

export type RfpFieldLabelsDocument = {
  _id: string;
  labels: RfpFieldLabelOverrides;
  updatedAt: string;
};

async function getCollection() {
  const db = await getDb();
  return db.collection<RfpFieldLabelsDocument>(COLLECTION_NAME);
}

export async function getRfpFieldLabels(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const col = await getCollection();
    const doc = await col.findOne({ _id: userId });
    res.json(doc?.labels ?? {});
  } catch (err) {
    console.error("[rfp-field-labels-mongo] get error:", err);
    res.status(500).json({ error: "Failed to get RFP field labels" });
  }
}

export async function putRfpFieldLabels(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const body = req.body as { labels?: RfpFieldLabelOverrides };
    const labels = body?.labels && typeof body.labels === "object" ? body.labels : {};

    const col = await getCollection();
    const doc: RfpFieldLabelsDocument = {
      _id: userId,
      labels,
      updatedAt: new Date().toISOString(),
    };
    await col.updateOne({ _id: userId }, { $set: doc }, { upsert: true });
    res.json(doc.labels);
  } catch (err) {
    console.error("[rfp-field-labels-mongo] put error:", err);
    res.status(500).json({ error: "Failed to save RFP field labels" });
  }
}

export function registerRfpFieldLabelsRoutes(app: import("express").Express): void {
  app.get("/api/rfp-field-labels", authRequired, getRfpFieldLabels);
  app.put("/api/rfp-field-labels", authRequired, putRfpFieldLabels);
}
