import { describe, expect, it } from "vitest";
import { nodiaAiModeSchema, nodiaAiRunSchema, nodiaAiSelectionSchema } from "../../../../modules/nodiaAi/infrastructure/schemas";
import { AiConnectionMode } from "../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";
import { isInvoiceAiMode } from "../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection";

import { run, selection } from "./fixtures";

describe("the two supported AI modes", () => {
  it.each(["token_plan_web", "web_session", "token_plan_agentic", "web", "unknown"])(
    "rejects the retired or unrecognized mode %s before building a request",
    (mode) => {
      expect(nodiaAiModeSchema.safeParse(mode).success).toBe(false);
      expect(isInvoiceAiMode(mode)).toBe(false);
    },
  );

  it.each(["agentic", "api_key"])("retains the explicit mode %s", (mode) => {
    expect(nodiaAiModeSchema.parse(mode)).toBe(mode);
    expect(isInvoiceAiMode(mode)).toBe(true);
  });

  it("offers exactly Agentic and API key without compatibility aliases", () => {
    expect(Object.values(AiConnectionMode).sort()).toEqual(["agentic", "api_key"]);
  });
  it("reads a retired historical run without accepting it as a new selection", () => {
    expect(nodiaAiRunSchema.parse({ ...run, selection: { ...selection, mode: "retired" } }).selection.mode).toBe("retired");
    expect(nodiaAiSelectionSchema.safeParse({ ...selection, mode: "retired" }).success).toBe(false);
  });

});
