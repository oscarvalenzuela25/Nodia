import { describe, expect, it } from "vitest";
import { invoiceAiAnalysisMessageKey, invoiceAiRuntimeMessageKey } from "../../../../modules/business/infrastructure/invoiceAiFailure";

describe("invoice runtime failure presentation", () => {
  it.each(["runtime_busy", "native_proof_missing", "native_proof_mismatch"])("recognizes the structured %s reason without inferring authentication failure", code => {
    const message = invoiceAiAnalysisMessageKey({ response: { status: 409, data: { upstreamErrorCode: code, message: "synthetic safe server message" } } });
    expect(message).toBe(invoiceAiRuntimeMessageKey(code));
    expect(message).toBe(code === "runtime_busy" ? "business:invoice_ai_runtime_busy" : "business:invoice_ai_closure_unconfirmed");
  });
  it.each([null, undefined, {}, { response: { data: { upstreamErrorCode: ["runtime_busy"] } } }, { response: { data: { upstreamErrorCode: "future_reason" } } }, { response: { data: { message: "runtime_busy" } } }])("leaves absent, malformed and unknown codes to normal server feedback: %j", error => {
    expect(invoiceAiAnalysisMessageKey(error)).toBeNull();
  });
});
