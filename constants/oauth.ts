import * as Linking from "expo-linking";
import * as ReactNative from "react-native";
import Constants from "expo-constants";

// Read OAuth config from app.config.ts extra field
// These values are resolved at config-load time (after load-env.js runs),
// so VITE_* env vars are properly mapped to the extra fields.
const extra = Constants.expoConfig?.extra ?? {};

const env = {
  portal: extra.oauthPortalUrl || "",
  server: extra.oauthServerUrl || "",
  appId: extra.appId || "",
  ownerId: extra.ownerOpenId || "",
  ownerName: extra.ownerName || "",
  apiBaseUrl: extra.apiBaseUrl || "",
  deepLinkScheme: extra.deepLinkScheme || "",
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  // If API_BASE_URL is explicitly set, use it
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  // On web, derive from current hostname by replacing port 8081 with 3000
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // On native (iOS/Android in Expo Go), derive from the debugger host
  // The debuggerHost looks like "8081-sandboxid.region.domain:443" or "192.168.x.x:8081"
  if (ReactNative.Platform.OS !== "web") {
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

    if (debuggerHost) {
      // Case 1: Manus proxy URL like "8081-sandboxid.region.domain:443"
      // Replace 8081 with 3000 to get the API server
      if (debuggerHost.includes("-") && !debuggerHost.startsWith("192.") && !debuggerHost.startsWith("10.") && !debuggerHost.startsWith("172.")) {
        const hostWithoutPort = debuggerHost.replace(/:[\d]+$/, "");
        const apiHost = hostWithoutPort.replace(/^8081-/, "3000-");
        return `https://${apiHost}`;
      }
      // Case 2: Local network IP like "192.168.1.5:8081"
      const [ip] = debuggerHost.split(":");
      return `http://${ip}:3000`;
    }
  }

  // Fallback to empty (will use relative URL on web)
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * Both web and native use the same server callback endpoint.
 */
export const getRedirectUri = () => {
  return `${getApiBaseUrl()}/api/oauth/callback`;
};

export const getLoginUrl = () => {
  const redirectUri = getRedirectUri();
  // Encode platform info into state so the server callback knows where to redirect
  const statePayload = ReactNative.Platform.OS === "web"
    ? redirectUri
    : `${redirectUri}|native|${env.deepLinkScheme}`;
  const state = encodeState(statePayload);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = getLoginUrl();

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}
