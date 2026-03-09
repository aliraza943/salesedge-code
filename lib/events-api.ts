/**
 * Frontend client for Events REST API (MongoDB-backed).
 */

import { getApiBaseUrl } from "@/constants/oauth";
import type { LocalEvent } from "@/lib/local-store";

const getBase = () => `${getApiBaseUrl()}/api/events`;

function toLocalEvent(r: Record<string, unknown>): LocalEvent {
  return {
    id: String(r.id),
    title: String(r.title),
    description: r.description != null ? String(r.description) : undefined,
    date: String(r.date),
    startTime: r.startTime != null ? String(r.startTime) : undefined,
    endTime: r.endTime != null ? String(r.endTime) : undefined,
    reminderMinutes: typeof r.reminderMinutes === "number" ? r.reminderMinutes : undefined,
    sourceType: r.sourceType != null ? String(r.sourceType) : undefined,
    sourceRfpId: r.sourceRfpId != null ? String(r.sourceRfpId) : undefined,
    createdAt: String(r.createdAt),
  };
}

export async function fetchEvents(): Promise<LocalEvent[]> {
  const res = await fetch(getBase(), { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toLocalEvent) : [];
}

export async function createEvent(data: Omit<LocalEvent, "id" | "createdAt">): Promise<LocalEvent> {
  const res = await fetch(getBase(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to create event: ${res.status}`);
  }
  const created = await res.json();
  return toLocalEvent(created);
}

export async function updateEvent(
  id: string,
  data: Partial<Omit<LocalEvent, "id" | "createdAt">>
): Promise<LocalEvent> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to update event: ${res.status}`);
  }
  const updated = await res.json();
  return toLocalEvent(updated);
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to delete event: ${res.status}`);
  }
}
