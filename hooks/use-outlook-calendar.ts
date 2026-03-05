/**
 * useOutlookCalendar
 *
 * Manages the Microsoft Outlook Calendar connection lifecycle:
 *  - Checks connection status from the server
 *  - Starts the OAuth flow using expo-web-browser (AuthSession)
 *  - Exchanges the auth code via the tRPC `outlook.connect` mutation
 *  - Disconnects by calling `outlook.disconnect`
 */

import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { trpc } from "@/lib/trpc";
import { getApiBaseUrl } from "@/constants/oauth";

// Required for expo-auth-session on web
WebBrowser.maybeCompleteAuthSession();

/**
 * The redirect URI that Microsoft will call after the user authenticates.
 * We use a server-side relay endpoint so the code comes back to us cleanly
 * on both web and native.
 */
function getOutlookRedirectUri(): string {
  const base = getApiBaseUrl();
  return `${base}/api/outlook/callback`;
}

export function useOutlookCalendar() {
  const utils = trpc.useUtils();

  // ── Status query ──────────────────────────────────────────────────────────
  const statusQuery = trpc.outlook.status.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const connectMut = trpc.outlook.connect.useMutation({
    onSuccess: () => {
      utils.outlook.status.invalidate();
    },
  });

  const disconnectMut = trpc.outlook.disconnect.useMutation({
    onSuccess: () => {
      utils.outlook.status.invalidate();
    },
  });

  // ── Auth URL query (lazy) ─────────────────────────────────────────────────
  const redirectUri = getOutlookRedirectUri();
  const authUrlQuery = trpc.outlook.getAuthUrl.useQuery(
    { redirectUri },
    { enabled: false, retry: false }
  );

  // ── Connect flow ──────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    try {
      // Fetch the Microsoft authorization URL from the server
      const result = await authUrlQuery.refetch();
      const authUrl = result.data?.url;
      if (!authUrl) {
        console.error("[Outlook] Could not get auth URL");
        return;
      }

      // Open the Microsoft login page in the system browser
      const browserResult = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri
      );

      if (browserResult.type !== "success") {
        console.log("[Outlook] Auth session cancelled or failed:", browserResult.type);
        return;
      }

      // Extract the `code` query param from the callback URL
      const url = browserResult.url;
      const codeMatch = url.match(/[?&]code=([^&]+)/);
      if (!codeMatch) {
        console.error("[Outlook] No code in callback URL:", url);
        return;
      }

      const code = decodeURIComponent(codeMatch[1]);
      await connectMut.mutateAsync({ code, redirectUri });
    } catch (err) {
      console.error("[Outlook] Connect flow error:", err);
    }
  }, [authUrlQuery, connectMut, redirectUri]);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    await disconnectMut.mutateAsync();
  }, [disconnectMut]);

  return {
    /** Whether the user has connected their Outlook account */
    isConnected: statusQuery.data?.connected ?? false,
    /** The connected Outlook email address */
    connectedEmail: statusQuery.data?.email ?? null,
    /** True while loading the connection status */
    isLoading: statusQuery.isLoading,
    /** True while the connect mutation is running */
    isConnecting: connectMut.isPending || authUrlQuery.isFetching,
    /** True while the disconnect mutation is running */
    isDisconnecting: disconnectMut.isPending,
    /** Start the Microsoft OAuth flow */
    connect,
    /** Remove the stored tokens and disconnect */
    disconnect,
    /** Any error from the connect mutation */
    connectError: connectMut.error,
  };
}
