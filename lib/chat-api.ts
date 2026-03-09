/**
 * Frontend client for Chat REST API (MongoDB-backed).
 */

import { getApiBaseUrl } from "@/constants/oauth";
import { authHeaders } from "@/lib/api-auth";
import type { LocalChatMessage } from "@/lib/local-store";

const getBase = () => `${getApiBaseUrl()}/api/chat`;

function toLocalChatMessage(r: Record<string, unknown>): LocalChatMessage {
  return {
    id: String(r.id),
    role: r.role === "assistant" ? "assistant" : "user",
    content: String(r.content),
    actions: Array.isArray(r.actions) ? (r.actions as any) : undefined,
    createdAt: String(r.createdAt),
  };
}

export async function fetchChatMessages(): Promise<LocalChatMessage[]> {
  const res = await fetch(getBase(), { headers: await authHeaders(), credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch chat: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toLocalChatMessage) : [];
}

export async function addChatMessage(
  msg: Omit<LocalChatMessage, "id" | "createdAt">
): Promise<LocalChatMessage> {
  const res = await fetch(getBase(), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(msg),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to add chat message: ${res.status}`);
  }
  const created = await res.json();
  return toLocalChatMessage(created);
}

export async function clearChat(): Promise<void> {
  const res = await fetch(getBase(), { method: "DELETE", headers: await authHeaders(), credentials: "include" });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Failed to clear chat: ${res.status}`);
  }
}
