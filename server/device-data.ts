/**
 * Device-based data API — no auth required.
 *
 * Each device gets a unique ID stored in expo-secure-store (persists across
 * Metro URL changes). Data is stored in the database keyed by device ID,
 * so it survives app reloads, server restarts, and bundler URL changes.
 *
 * For simplicity, we use a single JSON blob per device stored in a new table.
 * Includes: events, rfps, deals, chatMessages, salesGoal
 */

import { Request, Response, Express } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

// In-memory fallback if DB is unavailable
const memoryStore = new Map<string, any>();

async function readDeviceData(deviceId: string) {
  const db = await getDb();
  if (db) {
    const rows = await db.execute(sql`SELECT data_json FROM device_data WHERE device_id = ${deviceId}`) as any;
    const resultRows = rows?.[0] || rows;
    if (Array.isArray(resultRows) && resultRows.length > 0 && resultRows[0].data_json) {
      return JSON.parse(resultRows[0].data_json);
    }
  }
  return memoryStore.get(deviceId) || null;
}

async function writeDeviceData(deviceId: string, data: any) {
  memoryStore.set(deviceId, data);
  const db = await getDb();
  if (db) {
    const json = JSON.stringify(data);
    await db.execute(
      sql`INSERT INTO device_data (device_id, data_json, updated_at) VALUES (${deviceId}, ${json}, NOW())
          ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = NOW()`
    );
  }
}

const emptyData = () => ({
  events: [],
  rfps: [],
  deals: [],
  chatMessages: [],
  salesGoal: null,
});

const VALID_COLLECTIONS = ["events", "rfps", "deals", "chatMessages", "salesGoal"];

export function registerDeviceDataRoutes(app: Express) {
  // ─── GET all data for a device ─────────────────────────
  app.get("/api/device-data/:deviceId", async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    if (!deviceId || deviceId.length < 8) {
      res.status(400).json({ error: "Invalid device ID" });
      return;
    }

    try {
      const data = await readDeviceData(deviceId);
      const result = data || emptyData();
      res.json({
        events: result.events || [],
        rfps: result.rfps || [],
        deals: result.deals || [],
        chatMessages: result.chatMessages || [],
        salesGoal: result.salesGoal || null,
      });
    } catch (err) {
      console.error("[DeviceData] GET error:", err);
      const data = memoryStore.get(deviceId);
      res.json(data || emptyData());
    }
  });

  // ─── PUT (save/sync) all data for a device ─────────────
  app.put("/api/device-data/:deviceId", async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    if (!deviceId || deviceId.length < 8) {
      res.status(400).json({ error: "Invalid device ID" });
      return;
    }

    const { events, rfps, deals, chatMessages, salesGoal } = req.body;
    const data = {
      events: events || [],
      rfps: rfps || [],
      deals: deals || [],
      chatMessages: chatMessages || [],
      salesGoal: salesGoal || null,
    };

    try {
      await writeDeviceData(deviceId, data);
      res.json({ success: true });
    } catch (err) {
      console.error("[DeviceData] PUT error:", err);
      memoryStore.set(deviceId, data);
      res.json({ success: true, warning: "Saved to memory only" });
    }
  });

  // ─── PATCH (partial update) for a specific collection ──
  app.patch("/api/device-data/:deviceId/:collection", async (req: Request, res: Response) => {
    const { deviceId, collection } = req.params;
    if (!deviceId || deviceId.length < 8) {
      res.status(400).json({ error: "Invalid device ID" });
      return;
    }
    if (!VALID_COLLECTIONS.includes(collection)) {
      res.status(400).json({ error: "Invalid collection" });
      return;
    }

    try {
      const existing = (await readDeviceData(deviceId)) || emptyData();

      if (collection === "salesGoal") {
        // salesGoal is an object, not an array
        existing.salesGoal = req.body.data || req.body.items || null;
      } else {
        const { items } = req.body;
        if (!Array.isArray(items)) {
          res.status(400).json({ error: "items must be an array" });
          return;
        }
        existing[collection] = items;
      }

      await writeDeviceData(deviceId, existing);
      res.json({ success: true });
    } catch (err) {
      console.error("[DeviceData] PATCH error:", err);
      res.json({ success: true, warning: "Partial save" });
    }
  });
}
