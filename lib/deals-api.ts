/**
 * Frontend client for Deals REST API (MongoDB-backed).
 */

import { getApiBaseUrl } from "@/constants/oauth";
import { authHeaders } from "@/lib/api-auth";
import type { LocalDeal } from "@/lib/local-store";

const getBase = () => `${getApiBaseUrl()}/api/deals`;

function toLocalDeal(r: Record<string, unknown>): LocalDeal {
  return {
    id: String(r.id),
    title: String(r.title),
    client: String(r.client),
    stage: (r.stage as LocalDeal["stage"]) || "lead",
    value: r.value != null ? String(r.value) : undefined,
    expectedCloseDate: r.expectedCloseDate != null ? String(r.expectedCloseDate) : undefined,
    description: r.description != null ? String(r.description) : undefined,
    createdAt: String(r.createdAt),
  };
}

export async function fetchDeals(): Promise<LocalDeal[]> {
  const res = await fetch(getBase(), { headers: await authHeaders(), credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch deals: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toLocalDeal) : [];
}

export async function createDeal(data: Omit<LocalDeal, "id" | "createdAt">): Promise<LocalDeal> {
  const res = await fetch(getBase(), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to create deal: ${res.status}`);
  }
  const created = await res.json();
  return toLocalDeal(created);
}

export async function updateDeal(
  id: string,
  data: Partial<Omit<LocalDeal, "id" | "createdAt">>
): Promise<LocalDeal> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to update deal: ${res.status}`);
  }
  const updated = await res.json();
  return toLocalDeal(updated);
}

export async function deleteDeal(id: string): Promise<void> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to delete deal: ${res.status}`);
  }
}
