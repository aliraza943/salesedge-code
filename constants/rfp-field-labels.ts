/**
 * RFP form field label configuration.
 * Keys are fixed (data/database); only display labels can be customized.
 */

export const RFP_FIELD_LABEL_KEYS = [
  "case",
  "brokerage",
  "brokerageContact",
  "lives",
  "effectiveDate",
  "premium",
  "followUpDate",
  "notes",
] as const;

export type RfpFieldLabelKey = (typeof RFP_FIELD_LABEL_KEYS)[number];

export const DEFAULT_RFP_FIELD_LABELS: Record<RfpFieldLabelKey, string> = {
  case: "Case",
  brokerage: "Brokerage",
  brokerageContact: "Brokerage Contact",
  lives: "Lives",
  effectiveDate: "Effective Date",
  premium: "Premium ($)",
  followUpDate: "Follow-Up Date",
  notes: "Notes",
};

export type RfpFieldLabelOverrides = Partial<Record<RfpFieldLabelKey, string>>;

/** Merge defaults with overrides; empty override means use default. */
export function getEffectiveRfpLabels(overrides: RfpFieldLabelOverrides): Record<RfpFieldLabelKey, string> {
  const result = { ...DEFAULT_RFP_FIELD_LABELS };
  for (const key of RFP_FIELD_LABEL_KEYS) {
    if (overrides[key] != null && String(overrides[key]).trim() !== "") {
      result[key] = String(overrides[key]).trim();
    }
  }
  return result;
}
