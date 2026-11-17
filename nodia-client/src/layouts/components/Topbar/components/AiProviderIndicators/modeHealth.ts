import type { AiProviderHealthItem, AiProvidersHealthResponse } from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";

export type ProviderMode = "api_key" | "agentic";
export type ModeState = "configured" | "session_ready" | "healthy" | "needs_review" | "unverified" | "disabled";

type ModeConfiguration = Pick<AiProviderHealthItem, "use_api_key" | "use_agentic"> & { mode?: AiProviderHealthItem["mode"] };
type AgenticObservation = {
  available?: boolean | null;
  authenticated?: boolean | null;
  reason?: string | null;
  usageAllowed?: boolean | null;
};

export function enabledModes(provider: ModeConfiguration): ProviderMode[] {
  return ([
    ["api_key", provider.use_api_key ?? (provider.mode === "api_key")],
    ["agentic", provider.use_agentic ?? (provider.mode === "agentic")],
  ] as const).flatMap(([mode, enabled]) => enabled === true ? [mode] : []);
}

// This is stored configuration and carries no inference qualification.
export function apiKeyModeHealth(hasApiKey: boolean): ModeState {
  return hasApiKey ? "configured" : "needs_review";
}

export function agenticModeHealth(isActive: boolean, session: AgenticObservation | null | undefined, failed: boolean): ModeState {
  if (failed) return "unverified";
  if (isActive !== true) return "needs_review";
  if (session?.usageAllowed === false) return "needs_review";
  if (session?.reason === "runtime_busy" || session?.reason === "codex_profile_busy"
    || (session?.reason === "codex_runtime_unverified" && session.authenticated === null)) return "unverified";
  if (session?.available === false || session?.authenticated === false) return "needs_review";
  return session?.available === true && session.authenticated === true ? "session_ready" : "unverified";
}

export function modeHealth(provider: AiProviderHealthItem, mode: ProviderMode, health: AiProvidersHealthResponse, failed: boolean): ModeState {
  if (!enabledModes(provider).includes(mode)) return "disabled";
  if (mode === "api_key") {
    return apiKeyModeHealth((provider.apiKeysCount ?? 0) > 0 || provider.selectedApiKey != null);
  }
  const key = typeof provider.key === "string" ? provider.key.toLowerCase() : "";
  const session = key === "openai" ? provider.codexSession
    : ["gemini", "google"].includes(key) ? health.engines?.agentic : undefined;
  return agenticModeHealth(provider.isActive, session, failed);
}
