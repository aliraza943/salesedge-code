import * as Auth from "@/lib/_core/auth";

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await Auth.getSessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}
