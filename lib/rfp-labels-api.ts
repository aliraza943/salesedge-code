/**
 * Frontend client for RFP field labels REST API (MongoDB-backed).
 */

import { getApiBaseUrl } from "@/constants/oauth";
import { authHeaders } from "@/lib/api-auth";
import type { RfpFieldLabelOverrides } from "@/constants/rfp-field-labels";

const getBase = () => `${getApiBaseUrl()}/api/rfp-field-labels`;

export async function fetchRfpFieldLabels(): Promise<RfpFieldLabelOverrides> {
  const res = await fetch(getBase(), { headers: await authHeaders(), credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch RFP field labels: ${res.status}`);
  const data = await res.json();
  return data && typeof data === "object" ? data : {};
}

export async function updateRfpFieldLabels(labels: RfpFieldLabelOverrides): Promise<RfpFieldLabelOverrides> {
  const res = await fetch(getBase(), {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify({ labels }),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Failed to save RFP field labels: ${res.status}`);
  }
  const data = await res.json();
  return data && typeof data === "object" ? data : {};
}
