/**
 * outlook-calendar.ts
 * Microsoft Graph API helper for Outlook Calendar sync.
 *
 * Handles:
 *  - Token storage / refresh
 *  - Create / Update / Delete calendar events via Microsoft Graph
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { outlookTokens } from "../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OutlookTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
  outlookUserId?: string;
  outlookEmail?: string;
}

export interface OutlookEventPayload {
  title: string;
  description?: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM  (24-hour)
  endTime?: string;   // HH:MM
  allDay?: boolean;
  timezone?: string;  // IANA timezone, e.g. "America/New_York"
}

// ─── Token DB helpers ─────────────────────────────────────────────────────────

export async function getOutlookToken(userId: number): Promise<OutlookTokenSet | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(outlookTokens).where(eq(outlookTokens.userId, userId)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    outlookUserId: row.outlookUserId ?? undefined,
    outlookEmail: row.outlookEmail ?? undefined,
  };
}

export async function saveOutlookToken(userId: number, tokens: OutlookTokenSet): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getOutlookToken(userId);
  if (existing) {
    await db.update(outlookTokens).set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      outlookUserId: tokens.outlookUserId ?? null,
      outlookEmail: tokens.outlookEmail ?? null,
    }).where(eq(outlookTokens.userId, userId));
  } else {
    await db.insert(outlookTokens).values({
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      outlookUserId: tokens.outlookUserId ?? null,
      outlookEmail: tokens.outlookEmail ?? null,
    });
  }
}

export async function deleteOutlookToken(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(outlookTokens).where(eq(outlookTokens.userId, userId));
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "Calendars.ReadWrite offline_access User.Read",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const json = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

/**
 * Get a valid access token for the user, refreshing if needed.
 */
export async function getValidAccessToken(userId: number): Promise<string | null> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

  if (!clientId || !clientSecret) return null;

  const tokens = await getOutlookToken(userId);
  if (!tokens) return null;

  // If token expires in less than 5 minutes, refresh it
  if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken, clientId, clientSecret, tenantId);
      await saveOutlookToken(userId, {
        ...tokens,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      });
      return refreshed.accessToken;
    } catch (err) {
      console.error("[Outlook] Token refresh failed:", err);
      return null;
    }
  }

  return tokens.accessToken;
}

// ─── OAuth exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<OutlookTokenSet> {
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "Calendars.ReadWrite offline_access User.Read",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const json = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Fetch the user's Outlook profile
  let outlookUserId: string | undefined;
  let outlookEmail: string | undefined;
  try {
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json() as { id?: string; mail?: string; userPrincipalName?: string };
      outlookUserId = me.id;
      outlookEmail = me.mail ?? me.userPrincipalName;
    }
  } catch {
    // Non-fatal
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    outlookUserId,
    outlookEmail,
  };
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

function buildGraphEventBody(payload: OutlookEventPayload): Record<string, unknown> {
  const tz = payload.timezone ?? "UTC";

  if (payload.allDay) {
    return {
      subject: payload.title,
      body: { contentType: "text", content: payload.description ?? "" },
      start: { dateTime: `${payload.date}T00:00:00`, timeZone: tz },
      end:   { dateTime: `${payload.date}T23:59:00`, timeZone: tz },
      isAllDay: true,
    };
  }

  const startDT = payload.startTime
    ? `${payload.date}T${payload.startTime}:00`
    : `${payload.date}T09:00:00`;
  const endDT = payload.endTime
    ? `${payload.date}T${payload.endTime}:00`
    : `${payload.date}T10:00:00`;

  return {
    subject: payload.title,
    body: { contentType: "text", content: payload.description ?? "" },
    start: { dateTime: startDT, timeZone: tz },
    end:   { dateTime: endDT,   timeZone: tz },
  };
}

/**
 * Create an event in the user's Outlook calendar.
 * Returns the Outlook event ID on success, or null on failure.
 */
export async function createOutlookEvent(
  userId: number,
  payload: OutlookEventPayload
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  try {
    const body = buildGraphEventBody(payload);
    const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Outlook] Create event failed: ${res.status} ${text}`);
      return null;
    }

    const json = await res.json() as { id: string };
    return json.id;
  } catch (err) {
    console.error("[Outlook] Create event error:", err);
    return null;
  }
}

/**
 * Update an existing Outlook calendar event.
 */
export async function updateOutlookEvent(
  userId: number,
  outlookEventId: string,
  payload: OutlookEventPayload
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return false;

  try {
    const body = buildGraphEventBody(payload);
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Outlook] Update event failed: ${res.status} ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Outlook] Update event error:", err);
    return false;
  }
}

/**
 * Delete an Outlook calendar event.
 */
export async function deleteOutlookEvent(
  userId: number,
  outlookEventId: string
): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return false;

  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 204 No Content = success; 404 = already deleted
    if (res.status === 204 || res.status === 404) return true;

    const text = await res.text();
    console.error(`[Outlook] Delete event failed: ${res.status} ${text}`);
    return false;
  } catch (err) {
    console.error("[Outlook] Delete event error:", err);
    return false;
  }
}
