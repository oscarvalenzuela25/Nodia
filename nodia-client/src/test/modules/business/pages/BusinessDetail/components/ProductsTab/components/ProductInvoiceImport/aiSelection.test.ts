import { describe, expect, it } from "vitest";
import { getInvoiceAiModes, isProviderVisibleInInvoiceImport, hasAgenticEligibilityIssues, resolveInvoiceAiConfiguration, resolveInvoiceAiProvider } from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/aiSelection";
import type { VerifyIaProviderItem } from "../../../../../../../../../modules/business/infrastructure/types";

const first: VerifyIaProviderItem = {
  id: "instance-1", key: "gemini", name: "First", mode: "agentic", is_active: true,
  can_use_model: true, is_default: true, use_agentic: true, use_api_key: true,
  fields: { agentic: { selected_model: "model-a", ocr_focus_model: "model-b" } },
};

describe("invoice AI selection", () => {
  it.each(["agentic", "api_key"] as const)("preserves an explicit null reasoning override in %s without inheriting the general level", mode => {
    const provider: VerifyIaProviderItem = { ...first, mode, active_mode: mode,
      fields: { [mode]: { selected_model: "model-a", thinking_levels: { "model-a": null }, thinking_level: "high" } } };
    expect(resolveInvoiceAiConfiguration(provider, mode).thinkingLevel).toBeUndefined();
  });
  it("uses instance IDs and retains an unavailable explicit selection", () => {
    const second = { ...first, id: "instance-2", is_default: false };
    expect(resolveInvoiceAiProvider([first, second], "instance-2")).toBe(second);
    expect(resolveInvoiceAiProvider([first], "instance-2")).toBeNull();
    expect(resolveInvoiceAiProvider([first, second], null)).toBe(first);
  });
  it("uses the assigned model and supports both token plan and API keys", () => {
    expect(getInvoiceAiModes(first)).toEqual(["agentic", "api_key"]);
    expect(resolveInvoiceAiConfiguration(first, "agentic")).toMatchObject({ model: "model-a", canAnalyze: true });
  });
  it("allows Codex Agentic with a newly discovered effort and never exposes OpenAI Web", () => {
    const provider: VerifyIaProviderItem = { ...first, key: "openai", mode: "agentic", active_mode: "agentic", use_agentic: true, fields: { agentic: { selected_model: "synthetic-codex", thinking_levels: { "synthetic-codex": "new_effort" } }, api_key: { selected_model: "api-only" } } };
    expect(getInvoiceAiModes(provider)).not.toContain("token_plan_web");
    expect(resolveInvoiceAiConfiguration(provider, "agentic")).toMatchObject({ model: "synthetic-codex", thinkingLevel: "new_effort", canAnalyze: true });
  });
  it("does not use API verification as evidence for a selected Codex mode", () => {
    const provider: VerifyIaProviderItem = { ...first, key: "openai", active_mode: "api_key", use_agentic: true,
      fields: { agentic: { selected_model: "synthetic-codex" } } };
    expect(resolveInvoiceAiConfiguration(provider, "agentic").canAnalyze).toBe(false);
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
    expect(resolveInvoiceAiConfiguration({ ...first, fields: {} }, "agentic").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration({ ...first, is_active: false }, "agentic").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration({ ...first, use_agentic: false }, "agentic").canAnalyze).toBe(false);
    expect(resolveInvoiceAiConfiguration({ ...first, can_use_model: false, error: "Token plan unauthorized" }, "agentic").canAnalyze).toBe(false);
  });
  it("requires both reasoning capability and configuration permission", () => {
    const provider = { ...first, fields: { agentic: { selected_model: "model-a", available_models: [{ id: "model-a", capabilities: ["reasoning"] }] } } };
    expect(resolveInvoiceAiConfiguration(provider, "agentic").supportsThinking).toBe(false);
    provider.fields.agentic = { ...provider.fields.agentic, ...{ enable_extended_thinking: true } };
    expect(resolveInvoiceAiConfiguration(provider, "agentic").supportsThinking).toBe(true);
  });
  it("does not inherit a model from a different scoped subscription mode", () => {
    const provider = { ...first, use_agentic: true, fields: { selected_model: "root-default", api_key: { selected_model: "api-model" } } };
    expect(resolveInvoiceAiConfiguration(provider, "agentic")).toMatchObject({ model: "", canAnalyze: false });
  });
  it("keeps selection by ID when the query reorders instances and models change", () => {
    const second = { ...first, id: "instance-2", fields: { agentic: { selected_model: "second-model" } } };
    const updated = { ...second, fields: { agentic: { selected_model: "updated-model" } } };
    const selected = resolveInvoiceAiProvider([updated, first], "instance-2");
    expect(resolveInvoiceAiConfiguration(selected, "agentic").model).toBe("updated-model");
  });
  it("keeps unavailable configured instances visible while blocking their execution", () => {
    const brokenAgenticPlan: VerifyIaProviderItem = {
      id: "broken-gemini", key: "gemini", name: "Mi gemini", mode: "agentic",
      is_active: true, can_use_model: false, error: "No hay sesión activa para agentic",
      is_default: true, use_agentic: true, default_mode: "agentic",
    };
    const healthyAgenticPlan: VerifyIaProviderItem = {
      id: "healthy-gemini", key: "gemini", name: "Gemini Ok", mode: "agentic",
      is_active: true, can_use_model: true, error: null,
      is_default: false, use_agentic: true, default_mode: "agentic",
    };
    const apiKeyProvider: VerifyIaProviderItem = {
      id: "api-chatgpt", key: "openai", name: "Chatgpt pega", mode: "api_key",
      is_active: true, can_use_model: true, error: null,
      is_default: false, use_api_key: true, default_mode: "api_key",
    };

    expect(hasAgenticEligibilityIssues(brokenAgenticPlan)).toBe(true);
    expect(isProviderVisibleInInvoiceImport(brokenAgenticPlan)).toBe(true);
    expect(resolveInvoiceAiProvider([brokenAgenticPlan, healthyAgenticPlan], brokenAgenticPlan.id)).toBe(brokenAgenticPlan);
    expect(resolveInvoiceAiConfiguration(brokenAgenticPlan, "agentic").canAnalyze).toBe(false);

    expect(hasAgenticEligibilityIssues(healthyAgenticPlan)).toBe(false);
    expect(isProviderVisibleInInvoiceImport(healthyAgenticPlan)).toBe(true);

    expect(hasAgenticEligibilityIssues(apiKeyProvider)).toBe(false);
    expect(isProviderVisibleInInvoiceImport(apiKeyProvider)).toBe(true);
  });
  it.each(["runtime_busy", "native_proof_missing", "native_proof_mismatch"] as const)("blocks a reported %s even if an inconsistent response says can_use_model", reason => {
    const provider = { ...first, availability_reason: reason };
    expect(isProviderVisibleInInvoiceImport(provider)).toBe(true);
    expect(resolveInvoiceAiConfiguration(provider, "agentic").canAnalyze).toBe(false);
  });
});
