/**
 * Frontend client for RFP REST API (MongoDB-backed).
 * All RFP CRUD goes through these endpoints; no localStorage.
 */

import { getApiBaseUrl } from "@/constants/oauth";
import { authHeaders } from "@/lib/api-auth";
import type { LocalRfp } from "@/lib/local-store";

const getBase = () => `${getApiBaseUrl()}/api/rfps`;

function toLocalRfp(r: {
  id: string;
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
}): LocalRfp {
  return {
    id: r.id,
    title: r.title,
    client: r.client,
    brokerContact: r.brokerContact,
    lives: r.lives,
    effectiveDate: r.effectiveDate,
    premium: r.premium,
    status: r.status,
    notes: r.notes,
    description: r.description,
    followUpDate: r.followUpDate,
    createdAt: r.createdAt,
  };
}

export async function fetchRfps(): Promise<LocalRfp[]> {
  const res = await fetch(getBase(), { headers: await authHeaders(), credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch RFPs: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toLocalRfp) : [];
}

export async function fetchRfpById(id: string): Promise<LocalRfp | null> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, { headers: await authHeaders(), credentials: "include" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch RFP: ${res.status}`);
  const data = await res.json();
  return toLocalRfp(data);
}

export type CreateRfpInput = Omit<LocalRfp, "id" | "createdAt">;

export async function createRfp(data: CreateRfpInput): Promise<LocalRfp> {
  const res = await fetch(getBase(), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create RFP: ${res.status}`);
  }
  const created = await res.json();
  return toLocalRfp(created);
}

export async function updateRfp(
  id: string,
  data: Partial<Omit<LocalRfp, "id" | "createdAt">>
): Promise<LocalRfp> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update RFP: ${res.status}`);
  }
  const updated = await res.json();
  return toLocalRfp(updated);
}

export async function deleteRfp(id: string): Promise<void> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete RFP: ${res.status}`);
  }
}
