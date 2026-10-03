import type { VerifyIaProviderItem } from "../../../../../../infrastructure/types";

export type InvoiceAiMode = "token_plan_web" | "token_plan_agentic";

export const isInvoiceAiMode = (mode: unknown): mode is InvoiceAiMode =>
  mode === "token_plan_web" || mode === "token_plan_agentic";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const getInvoiceAiModes = (provider: VerifyIaProviderItem | null): InvoiceAiMode[] => {
  if (!provider?.is_active) return [];
  const modes: InvoiceAiMode[] = [];
  if (provider.use_token_plan_agentic) modes.push("token_plan_agentic");
  if (provider.use_token_plan_web) modes.push("token_plan_web");
  return modes;
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
  const level = levels[model] ?? modeFields.thinking_level;
  const thinkingLevel: "low" | "medium" | "high" | undefined = level === "low" || level === "medium" || level === "high" ? level : undefined;
  return {
    model,
    supportsThinking,
    thinkingLevel,
    canAnalyze: Boolean(provider?.is_active && provider.can_use_model && mode
      && getInvoiceAiModes(provider).includes(mode) && model),
  };
};
