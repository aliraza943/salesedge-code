/**
 * Sales Goal REST API backed by MongoDB.
 * Collection: salesGoal (one document per user, _id = userId)
 */

import type { Request, Response } from "express";
import { getDb } from "./mongo-client";
import { authRequired } from "./auth-mongo";

const COLLECTION_NAME = "salesGoal";

export type SalesGoalDocument = {
  _id?: string;
  currentSales: string;
  goalAmount: string;
  goalDeadline: string;
  updatedAt: string;
};

async function getCollection() {
  const db = await getDb();
  return db.collection<SalesGoalDocument>(COLLECTION_NAME);
}

function toResponse(doc: SalesGoalDocument): { currentSales: number; goalAmount: number; goalDeadline: string } {
  return {
    currentSales: parseFloat(doc.currentSales || "0"),
    goalAmount: parseFloat(doc.goalAmount || "0"),
    goalDeadline: doc.goalDeadline || "2026-12-01",
  };
}

export async function getSalesGoal(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const col = await getCollection();
    const doc = await col.findOne({ _id: userId });
    if (!doc) {
      res.json({
        currentSales: 0,
        goalAmount: 12000000,
        goalDeadline: "2026-12-01",
      });
      return;
    }
    res.json(toResponse(doc));
  } catch (err) {
    console.error("[sales-goal-mongo] get error:", err);
    res.status(500).json({ error: "Failed to get sales goal" });
  }
}

export async function upsertSalesGoal(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const currentSales = typeof body.currentSales === "string" ? body.currentSales : String(body.currentSales ?? "0");
    const goalAmount = typeof body.goalAmount === "string" ? body.goalAmount : String(body.goalAmount ?? "12000000");
    const goalDeadline = typeof body.goalDeadline === "string" ? body.goalDeadline : (body.goalDeadline ? String(body.goalDeadline) : "2026-12-01");

    const col = await getCollection();
    const doc: SalesGoalDocument = {
      _id: userId,
      currentSales,
      goalAmount,
      goalDeadline,
      updatedAt: new Date().toISOString(),
    };
    await col.updateOne(
      { _id: userId },
      { $set: doc },
      { upsert: true }
    );
    res.json(toResponse(doc));
  } catch (err) {
    console.error("[sales-goal-mongo] upsert error:", err);
    res.status(500).json({ error: "Failed to upsert sales goal" });
  }
}

export function registerSalesGoalRoutes(app: import("express").Express): void {
  app.get("/api/sales-goal", authRequired, getSalesGoal);
  app.put("/api/sales-goal", authRequired, upsertSalesGoal);
}
