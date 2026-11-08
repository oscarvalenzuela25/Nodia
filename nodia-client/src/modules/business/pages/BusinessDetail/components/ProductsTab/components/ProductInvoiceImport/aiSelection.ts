import type { VerifyIaProviderItem, InvoiceAiConnectionMode } from "../../../../../../infrastructure/types";

export type InvoiceAiMode = InvoiceAiConnectionMode;

export const isInvoiceAiMode = (mode: unknown): mode is InvoiceAiMode =>
  mode === "agentic" || mode === "api_key";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const getInvoiceAiModes = (provider: VerifyIaProviderItem | null): InvoiceAiMode[] => {
  if (!provider?.is_active) return [];
  const modes: InvoiceAiMode[] = [];
  if (provider.use_agentic ?? (provider.mode === "agentic")) modes.push("agentic");
  if (provider.use_api_key ?? (provider.mode === "api_key" || provider.active_mode === "api_key")) modes.push("api_key");
  return modes;
};

export const hasAgenticEligibilityIssues = (provider: VerifyIaProviderItem | null): boolean => {
  if (!provider) return false;
  // API key eligibility is reported independently of the Agentic session.
  if (provider.use_api_key || provider.mode === "api_key" || provider.active_mode === "api_key") {
    return false;
  }
  const operatesAgentic = provider.mode === "agentic"
    || provider.default_mode === "agentic" || provider.use_agentic === true;

  if (!operatesAgentic) return false;
  return !provider.can_use_model || Boolean(provider.error);
};

export const isProviderVisibleInInvoiceImport = (provider: VerifyIaProviderItem): boolean => {
  if (!provider.is_active) return false;
  if (getInvoiceAiModes(provider).length === 0) return false;
  // Keep a configured instance selectable when unavailable; never replace its identity.
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
  const hasScopedConfiguration = ["agentic", "api_key"].some((key) => fields[key] !== undefined);
  const hasModeFields = mode !== null && fields[mode] !== undefined;
  const legacyMatchesMode = mode !== null && [provider?.default_mode, provider?.mode, provider?.active_mode].includes(mode);
  const modeFields = hasModeFields ? asRecord(fields[mode]) : !hasScopedConfiguration && legacyMatchesMode ? fields : {};
  const selected = modeFields.selected_model ?? (!hasScopedConfiguration && legacyMatchesMode ? provider?.default_model : undefined);
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
  const level = Object.hasOwn(levels, model) ? levels[model] : modeFields.thinking_level;
  const thinkingLevel = provider?.key === "openai" && mode === "agentic"
    ? typeof level === "string" && /^[a-z][a-z0-9_-]{0,31}$/.test(level) ? level : undefined
    : level === "low" || level === "medium" || level === "high" ? level : undefined;
  const observedMode = provider?.active_mode
    ?? (isInvoiceAiMode(provider?.default_mode) ? provider.default_mode : isInvoiceAiMode(provider?.mode) ? provider.mode : null);
  return {
    model,
    supportsThinking,
    thinkingLevel,
    canAnalyze: Boolean(provider?.is_active && provider.can_use_model && !provider.error && !provider.availability_reason && mode
      && getInvoiceAiModes(provider).includes(mode) && model
      && observedMode === mode),
  };
};
