import * as ReactNative from "react-native";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};
const API_BASE_URL = extra.apiBaseUrl || "";

/**
 * Get the API base URL for the backend.
 */
export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }
  if (ReactNative.Platform.OS !== "web") {
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (debuggerHost) {
      if (debuggerHost.includes("-") && !debuggerHost.startsWith("192.") && !debuggerHost.startsWith("10.") && !debuggerHost.startsWith("172.")) {
        const hostWithoutPort = debuggerHost.replace(/:[\d]+$/, "");
        const apiHost = hostWithoutPort.replace(/^8081-/, "3000-");
        return `https://${apiHost}`;
      }
      const [ip] = debuggerHost.split(":");
      return `http://${ip}:3000`;
    }
  }
  // return `http://192.168.100.180:3000`;
  return ``;
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "app_user_info";
