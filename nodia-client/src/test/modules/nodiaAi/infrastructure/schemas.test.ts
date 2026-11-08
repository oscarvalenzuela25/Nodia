import { describe, expect, it } from "vitest";
import { nodiaAiEligibilitySchema } from "../../../../modules/nodiaAi/infrastructure/schemas";
import { selection } from "./fixtures";

const eligibility = { selection: { ...selection, mode: "agentic" }, available: true, reason: null,
  observed_at: null, supports_mcp: true, routing_target: null };
const invoiceOcr = { media_types: ["image/png", "image/jpeg", "image/webp", "application/pdf"], file_bytes: 10485760 };

describe("transport-independent tools eligibility", () => {
  it("accepts legacy absence and preserves explicit true or false without changing MCP", () => {
    expect(nodiaAiEligibilitySchema.parse(eligibility).supports_tools).toBeUndefined();
    for (const supports_tools of [true, false]) {
      const parsed = nodiaAiEligibilitySchema.parse({ ...eligibility,
        selection: { ...eligibility.selection, mode: "api_key" }, supports_tools, supports_mcp: false,
      });
      expect(parsed.supports_tools).toBe(supports_tools);
      expect(parsed.supports_mcp).toBe(false);
    }
  });
  it.each([null, "true", "false", 1, 0, {}, []])("rejects non-boolean tools capability %j", supports_tools => {
    expect(nodiaAiEligibilitySchema.safeParse({ ...eligibility, supports_tools }).success).toBe(false);
  });
});

describe("image generation eligibility contract", () => {
  it("preserves legacy absence and explicit qualified or unverified state without assuming another capability", () => {
    expect(nodiaAiEligibilitySchema.parse(eligibility).supports_image_generation).toBeUndefined();
    for (const supports_image_generation of [true, false]) {
      const result = nodiaAiEligibilitySchema.parse({ ...eligibility,
        selection: { ...eligibility.selection, mode: "api_key" }, supports_image_generation,
        supports_tools: true, supports_mcp: false,
      });
      expect(result.supports_image_generation).toBe(supports_image_generation);
      expect(result.supports_mcp).toBe(false);
      expect(result.invoice_ocr).toBeUndefined();
    }
  });
  it.each([null, "true", "false", 1, 0, {}, []])("rejects non-boolean image qualification %j", supports_image_generation => {
    expect(nodiaAiEligibilitySchema.safeParse({ ...eligibility, supports_image_generation }).success).toBe(false);
  });
});

describe("invoice OCR eligibility contract", () => {
  it("accepts historical absence, explicit null and the separately reported OCR route", () => {
    expect(nodiaAiEligibilitySchema.parse(eligibility).invoice_ocr).toBeUndefined();
    expect(nodiaAiEligibilitySchema.parse({ ...eligibility, invoice_ocr: null }).invoice_ocr).toBeNull();
    expect(nodiaAiEligibilitySchema.parse({ ...eligibility, invoice_ocr: invoiceOcr }).invoice_ocr).toEqual(invoiceOcr);
  });
  it("accepts an explicitly authorized API OCR route without claiming MCP or other modalities", () => {
    const parsed = nodiaAiEligibilitySchema.parse({ ...eligibility,
      selection: { ...eligibility.selection, mode: "api_key" }, supports_tools: true,
      supports_mcp: false, invoice_ocr: invoiceOcr,
    });
    expect(parsed.invoice_ocr).toEqual(invoiceOcr);
    expect(parsed.supports_mcp).toBe(false);
  });
  it.each([
    { ...invoiceOcr, media_types: ["audio/wav"] },
    { ...invoiceOcr, media_types: [] },
    { ...invoiceOcr, media_types: ["image/png", "image/png"] },
    { ...invoiceOcr, file_bytes: 10485761 },
    { ...invoiceOcr, file_bytes: null },
    { ...invoiceOcr, native_verified: true },
  ])("rejects invalid OCR route data without manufacturing native support: %j", invoice_ocr => {
    expect(nodiaAiEligibilitySchema.safeParse({ ...eligibility, invoice_ocr }).success).toBe(false);
  });
});
