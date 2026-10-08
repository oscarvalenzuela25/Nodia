import { describe, expect, it } from "vitest";
import { getInvoiceAiModes, isProviderVisibleInInvoiceImport, isTokenPlanWithIssues, resolveInvoiceAiConfiguration, resolveInvoiceAiProvider } from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection";
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
  it("uses the assigned model and supports both token plan and API keys", () => {
    expect(getInvoiceAiModes(first)).toEqual(["token_plan_web", "api_key"]);
    expect(resolveInvoiceAiConfiguration(first, "token_plan_web")).toMatchObject({ model: "model-a", canAnalyze: true });
  });
  it("allows Codex Agentic with a newly discovered effort and never exposes OpenAI Web", () => {
    const provider: VerifyIaProviderItem = { ...first, key: "openai", mode: "token_plan_agentic", active_mode: "token_plan_agentic", use_token_plan_agentic: true,
      use_token_plan_web: true, fields: { token_plan_agentic: { selected_model: "synthetic-codex", thinking_levels: { "synthetic-codex": "new_effort" } }, api_key: { selected_model: "api-only" } } };
    expect(getInvoiceAiModes(provider)).not.toContain("token_plan_web");
    expect(resolveInvoiceAiConfiguration(provider, "token_plan_agentic")).toMatchObject({ model: "synthetic-codex", thinkingLevel: "new_effort", canAnalyze: true });
  });
  it("does not use API verification as evidence for a selected Codex mode", () => {
    const provider: VerifyIaProviderItem = { ...first, key: "openai", active_mode: "api_key", use_token_plan_agentic: true,
      fields: { token_plan_agentic: { selected_model: "synthetic-codex" } } };
    expect(resolveInvoiceAiConfiguration(provider, "token_plan_agentic").canAnalyze).toBe(false);
  });
  it("supports dedicated api_key mode provider", () => {
    const apiKeyProvider: VerifyIaProviderItem = {
      id: "instance-openai", key: "openai", name: "OpenAI", mode: "api_key", is_active: true,
      can_use_model: true, is_default: false, use_api_key: true,
      fields: { api_key: { selected_model: "gpt-6.1-sol" } },
    };
    expect(getInvoiceAiModes(apiKeyProvider)).toEqual(["api_key"]);
    expect(resolveInvoiceAiConfiguration(apiKeyProvider, "api_key")).toMatchObject({ model: "gpt-6.1-sol", canAnalyze: true });
  });
  it("rejects missing models, inactive providers and disabled modes", () => {
    expect(resolveInvoiceAiConfiguration({ ...first, fields: {} }, "token_plan_web").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration({ ...first, is_active: false }, "token_plan_web").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration(first, "token_plan_agentic").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration({ ...first, can_use_model: false, error: "Token plan unauthorized" }, "token_plan_web").canAnalyze).toBe(false);
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
  it("filters out token plan providers with errors or unauthorized, but keeps working token plans and API key providers", () => {
    const brokenTokenPlan: VerifyIaProviderItem = {
      id: "broken-gemini", key: "gemini", name: "Mi gemini", mode: "token_plan_web",
      is_active: true, can_use_model: false, error: "No hay sesión activa para token_plan_web",
      is_default: true, use_token_plan_web: true, default_mode: "token_plan_web",
    };
    const healthyTokenPlan: VerifyIaProviderItem = {
      id: "healthy-gemini", key: "gemini", name: "Gemini Ok", mode: "token_plan_web",
      is_active: true, can_use_model: true, error: null,
      is_default: false, use_token_plan_web: true, default_mode: "token_plan_web",
    };
    const apiKeyProvider: VerifyIaProviderItem = {
      id: "api-chatgpt", key: "openai", name: "Chatgpt pega", mode: "api_key",
      is_active: true, can_use_model: true, error: null,
      is_default: false, use_api_key: true, default_mode: "api_key",
    };

    expect(isTokenPlanWithIssues(brokenTokenPlan)).toBe(true);
    expect(isProviderVisibleInInvoiceImport(brokenTokenPlan)).toBe(false);

    expect(isTokenPlanWithIssues(healthyTokenPlan)).toBe(false);
    expect(isProviderVisibleInInvoiceImport(healthyTokenPlan)).toBe(true);

    expect(isTokenPlanWithIssues(apiKeyProvider)).toBe(false);
    expect(isProviderVisibleInInvoiceImport(apiKeyProvider)).toBe(true);
  });
});
