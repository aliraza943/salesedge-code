import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  const sessionToken = await Auth.getSessionToken();
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }
  const baseUrl = getApiBaseUrl();
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = (errorJson as any).error || (errorJson as any).message || errorText;
    } catch {
      // ignore
    }
    throw new Error(errorMessage || `API call failed: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export type SignUpInput = {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  securityAnswer: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string;
};

export async function signUp(data: SignUpInput): Promise<{ token: string; user: AuthUser }> {
  const result = await apiCall<{ token: string; user: AuthUser }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result;
}

export async function login(data: LoginInput): Promise<{ token: string; user: AuthUser }> {
  const result = await apiCall<{ token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result;
}

export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const result = await apiCall<{ user: AuthUser }>("/api/auth/me");
    return result?.user ?? null;
  } catch {
    return null;
  }
}

export async function deleteAccount(): Promise<void> {
  await apiCall<{ ok: boolean }>("/api/auth/account", { method: "DELETE" });
}

// ─── Forgot password (security question flow) ──────────────

export async function requestPasswordReset(email: string): Promise<{ success: true; securityQuestion: string }> {
  return apiCall<{ success: true; securityQuestion: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function verifySecurityAnswer(email: string, answer: string): Promise<{ success: true; resetToken: string }> {
  return apiCall<{ success: true; resetToken: string }>("/api/auth/verify-security-answer", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), answer: answer.trim() }),
  });
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<{ success: true; message: string }> {
  return apiCall<{ success: true; message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ resetToken, newPassword }),
  });
}
