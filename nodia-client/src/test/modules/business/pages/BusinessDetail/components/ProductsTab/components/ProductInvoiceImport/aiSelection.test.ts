import { describe, expect, it } from "vitest";
import { getInvoiceAiModes, resolveInvoiceAiConfiguration, resolveInvoiceAiProvider } from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection";
import type { VerifyIaProviderItem } from "../../../../../../../../../modules/business/infrastructure/types";

const first: VerifyIaProviderItem = {
  id: "instance-1", key: "gemini", name: "First", mode: "web_session", is_active: true,
  can_use_model: true, is_default: true, use_token_plan_web: true, use_api_key: true,
  fields: { token_plan_web: { selected_model: "model-a", ocr_focus_model: "model-b" } },
};

describe("invoice AI selection", () => {
  it("uses instance IDs and retains an unavailable explicit selection", () => {
    const second = { ...first, id: "instance-2", is_default: false };
    expect(resolveInvoiceAiProvider([first, second], "instance-2")).toBe(second);
    expect(resolveInvoiceAiProvider([first], "instance-2")).toBeNull();
    expect(resolveInvoiceAiProvider([first, second], null)).toBe(first);
  });
  it("uses the assigned model without promoting OCR focus or allowing API keys", () => {
    expect(getInvoiceAiModes(first)).toEqual(["token_plan_web"]);
    expect(resolveInvoiceAiConfiguration(first, "token_plan_web")).toMatchObject({ model: "model-a", canAnalyze: true });
  });
  it("rejects missing models, inactive providers and disabled modes", () => {
    expect(resolveInvoiceAiConfiguration({ ...first, fields: {} }, "token_plan_web").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration({ ...first, is_active: false }, "token_plan_web").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration(first, "token_plan_agentic").canAnalyze).toBe(false);
  });
  it("requires both reasoning capability and configuration permission", () => {
    const provider = { ...first, fields: { token_plan_web: { selected_model: "model-a", available_models: [{ id: "model-a", capabilities: ["reasoning"] }] } } };
    expect(resolveInvoiceAiConfiguration(provider, "token_plan_web").supportsThinking).toBe(false);
    provider.fields.token_plan_web = { ...provider.fields.token_plan_web, ...{ enable_extended_thinking: true } };
    expect(resolveInvoiceAiConfiguration(provider, "token_plan_web").supportsThinking).toBe(true);
  });
  it("does not inherit a model from a different scoped subscription mode", () => {
    const provider = { ...first, use_token_plan_agentic: true, fields: { selected_model: "root-default", token_plan_web: { selected_model: "web-model" } } };
    expect(resolveInvoiceAiConfiguration(provider, "token_plan_agentic")).toMatchObject({ model: "", canAnalyze: false });
  });
  it("keeps selection by ID when the query reorders instances and models change", () => {
    const second = { ...first, id: "instance-2", fields: { token_plan_web: { selected_model: "second-model" } } };
    const updated = { ...second, fields: { token_plan_web: { selected_model: "updated-model" } } };
    const selected = resolveInvoiceAiProvider([updated, first], "instance-2");
    expect(resolveInvoiceAiConfiguration(selected, "token_plan_web").model).toBe("updated-model");
  });
});
