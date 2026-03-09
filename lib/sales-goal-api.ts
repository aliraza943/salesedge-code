/**
 * Frontend client for Sales Goal REST API (MongoDB-backed).
 */

import { getApiBaseUrl } from "@/constants/oauth";
import { authHeaders } from "@/lib/api-auth";

export type SalesGoal = {
  currentSales: number;
  goalAmount: number;
  goalDeadline: string;
};

const getBase = () => `${getApiBaseUrl()}/api/sales-goal`;

export async function fetchSalesGoal(): Promise<SalesGoal> {
  const res = await fetch(getBase(), { headers: await authHeaders(), credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch sales goal: ${res.status}`);
  const data = await res.json();
  return {
    currentSales: typeof data.currentSales === "number" ? data.currentSales : parseFloat(data.currentSales || "0"),
    goalAmount: typeof data.goalAmount === "number" ? data.goalAmount : parseFloat(data.goalAmount || "0"),
    goalDeadline: data.goalDeadline || "2026-12-01",
  };
}

export async function upsertSalesGoal(updates: {
  currentSales?: number | string;
  goalAmount?: number | string;
  goalDeadline?: string;
}): Promise<SalesGoal> {
  const body: Record<string, string> = {};
  if (updates.currentSales !== undefined) body.currentSales = String(updates.currentSales);
  if (updates.goalAmount !== undefined) body.goalAmount = String(updates.goalAmount);
  if (updates.goalDeadline !== undefined) body.goalDeadline = updates.goalDeadline;

  const res = await fetch(getBase(), {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to upsert sales goal: ${res.status}`);
  }
  const data = await res.json();
  return {
    currentSales: typeof data.currentSales === "number" ? data.currentSales : parseFloat(data.currentSales || "0"),
    goalAmount: typeof data.goalAmount === "number" ? data.goalAmount : parseFloat(data.goalAmount || "0"),
    goalDeadline: data.goalDeadline || "2026-12-01",
  };
}
