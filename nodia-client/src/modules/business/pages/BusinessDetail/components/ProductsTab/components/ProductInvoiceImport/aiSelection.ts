import type { VerifyIaProviderItem } from "../../../../../../infrastructure/types";

export type InvoiceAiMode = "token_plan_web" | "token_plan_agentic" | "api_key";

export const isInvoiceAiMode = (mode: unknown): mode is InvoiceAiMode =>
  mode === "token_plan_web" || mode === "token_plan_agentic" || mode === "api_key";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const getInvoiceAiModes = (provider: VerifyIaProviderItem | null): InvoiceAiMode[] => {
  if (!provider?.is_active) return [];
  const modes: InvoiceAiMode[] = [];
  if (provider.use_token_plan_agentic) modes.push("token_plan_agentic");
  if (provider.key !== "openai" && provider.use_token_plan_web) modes.push("token_plan_web");
  if (provider.use_api_key || provider.mode === "api_key" || provider.active_mode === "api_key") modes.push("api_key");
  return modes;
};

export const isTokenPlanWithIssues = (provider: VerifyIaProviderItem | null): boolean => {
  if (!provider) return false;
  // If the provider has an API key mode, it is an API key provider, not a token plan
  if (provider.use_api_key || provider.mode === "api_key" || provider.active_mode === "api_key") {
    return false;
  }
  const operatesTokenPlan =
    provider.mode === "token_plan_web" ||
    provider.mode === "token_plan_agentic" ||
    provider.mode === "web_session" ||
    provider.mode === "agentic" ||
    provider.default_mode === "token_plan_web" ||
    provider.default_mode === "token_plan_agentic" ||
    provider.use_token_plan_web === true ||
    provider.use_token_plan_agentic === true;

  if (!operatesTokenPlan) return false;
  return !provider.can_use_model || Boolean(provider.error);
};

export const isProviderVisibleInInvoiceImport = (provider: VerifyIaProviderItem): boolean => {
  if (!provider.is_active) return false;
  if (getInvoiceAiModes(provider).length === 0) return false;
  if (isTokenPlanWithIssues(provider)) return false;
  return true;
};

export const resolveInvoiceAiProvider = (
  providers: VerifyIaProviderItem[],
  selectedId: string | null,
): VerifyIaProviderItem | null => {
  // An explicit selection must never silently resolve to a different instance.
  if (selectedId !== null) return providers.find((p) => p.id === selectedId) ?? null;
  return providers.find((p) => p.is_active && p.is_default)
    ?? providers.find((p) => p.is_active && getInvoiceAiModes(p).length > 0)
    ?? null;
};

export const resolveInvoiceAiConfiguration = (
  provider: VerifyIaProviderItem | null,
  mode: InvoiceAiMode | null,
) => {
  const fields = asRecord(provider?.fields);
  const hasScopedConfiguration = ["token_plan_web", "token_plan_agentic", "api_key"].some((key) => fields[key] !== undefined);
  const hasModeFields = mode !== null && fields[mode] !== undefined;
  const modeFields = hasModeFields ? asRecord(fields[mode]) : hasScopedConfiguration ? {} : fields;
  const selected = modeFields.selected_model ?? (!hasScopedConfiguration ? provider?.default_model : undefined);
  const model = typeof selected === "string" ? selected.trim() : "";
  const available = modeFields.available_models;
  const modelInfo = Array.isArray(available)
    ? available.map(asRecord).find((item) => item.id === model)
    : undefined;
  const discoveredThinking = Array.isArray(modelInfo?.capabilities)
    && modelInfo.capabilities.includes("reasoning");
  const thinkingEnabled = modeFields.enable_extended_thinking === true
    || (!hasScopedConfiguration && provider?.extended_thinking_enabled === true);
  const supportsThinking = Boolean(
    thinkingEnabled && (discoveredThinking || (!hasScopedConfiguration && provider?.supports_thinking === true)),
  );
  const levels = asRecord(modeFields.thinking_levels);
  const level = provider?.key === "openai" && mode === "token_plan_agentic" && Object.hasOwn(levels, model)
    ? levels[model] : levels[model] ?? modeFields.thinking_level;
  const thinkingLevel = provider?.key === "openai" && mode === "token_plan_agentic"
    ? typeof level === "string" && /^[a-z][a-z0-9_-]{0,31}$/.test(level) ? level : undefined
    : level === "low" || level === "medium" || level === "high" ? level : undefined;
  return {
    model,
    supportsThinking,
    thinkingLevel,
    canAnalyze: Boolean(provider?.is_active && provider.can_use_model && !provider.error && mode
      && getInvoiceAiModes(provider).includes(mode) && model
      && (provider.key !== "openai" || !provider.active_mode || provider.active_mode === mode)),
  };
};
