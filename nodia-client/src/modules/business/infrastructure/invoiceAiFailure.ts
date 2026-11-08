/** Only structured, allowlisted reasons reported by Server describe runtime closure. */
export type InvoiceAiAvailabilityReason =
  | "runtime_busy"
  | "native_proof_missing"
  | "native_proof_mismatch";

export const invoiceAiRuntimeMessageKey = (reason: unknown) => {
  if (reason === "runtime_busy") return "business:invoice_ai_runtime_busy";
  if (reason === "native_proof_missing" || reason === "native_proof_mismatch") {
    return "business:invoice_ai_closure_unconfirmed";
  }
  return null;
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const invoiceAiAnalysisMessageKey = (error: unknown) =>
  invoiceAiRuntimeMessageKey(record(record(record(error).response).data).upstreamErrorCode);
