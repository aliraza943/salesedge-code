/**
 * Frontend client for Brokers REST API (MongoDB-backed).
 */

import { getApiBaseUrl } from "@/constants/oauth";
import type { LocalBroker, BrokerNote } from "@/lib/local-store";

const getBase = () => `${getApiBaseUrl()}/api/brokers`;

function toLocalBroker(r: Record<string, unknown>): LocalBroker {
  const notes = (r.notes as any[]) || [];
  return {
    id: String(r.id),
    name: String(r.name),
    company: r.company != null ? String(r.company) : undefined,
    phone: r.phone != null ? String(r.phone) : undefined,
    email: r.email != null ? String(r.email) : undefined,
    notes: notes.map((n: any) => ({
      id: String(n.id),
      content: String(n.content),
      createdAt: String(n.createdAt),
    })),
    createdAt: String(r.createdAt),
  };
}

export async function fetchBrokers(): Promise<LocalBroker[]> {
  const res = await fetch(getBase(), { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch brokers: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toLocalBroker) : [];
}

export async function createBroker(
  data: Omit<LocalBroker, "id" | "createdAt" | "notes"> & { notes?: BrokerNote[] }
): Promise<LocalBroker> {
  const res = await fetch(getBase(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, notes: data.notes || [] }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to create broker: ${res.status}`);
  }
  const created = await res.json();
  return toLocalBroker(created);
}

export async function updateBroker(
  id: string,
  data: Partial<Omit<LocalBroker, "id" | "createdAt">>
): Promise<LocalBroker> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to update broker: ${res.status}`);
  }
  const updated = await res.json();
  return toLocalBroker(updated);
}

export async function deleteBroker(id: string): Promise<void> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to delete broker: ${res.status}`);
  }
}

export async function addBrokerNote(brokerId: string, content: string): Promise<BrokerNote> {
  const res = await fetch(`${getBase()}/${encodeURIComponent(brokerId)}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to add broker note: ${res.status}`);
  }
  const note = await res.json();
  return {
    id: String(note.id),
    content: String(note.content),
    createdAt: String(note.createdAt),
  };
}

export async function removeBrokerNote(brokerId: string, noteId: string): Promise<void> {
  const res = await fetch(
    `${getBase()}/${encodeURIComponent(brokerId)}/notes/${encodeURIComponent(noteId)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to remove broker note: ${res.status}`);
  }
}
