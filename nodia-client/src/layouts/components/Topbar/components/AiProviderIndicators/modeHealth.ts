import type { AiProviderHealthItem, AiProvidersHealthResponse } from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";

export type ProviderMode = "api_key" | "token_plan_web" | "token_plan_agentic";
export type ModeState = "configured" | "session_ready" | "healthy" | "needs_review" | "unverified" | "disabled";

export function enabledModes(provider: AiProviderHealthItem): ProviderMode[] {
  return ([
    ["api_key", provider.use_api_key ?? (provider.mode === "api_key")],
    ["token_plan_web", provider.use_token_plan_web ?? (provider.mode === "web_session")],
    ["token_plan_agentic", provider.use_token_plan_agentic ?? (provider.mode === "token_plan_agentic")],
  ] as const).flatMap(([mode, enabled]) => enabled === true ? [mode] : []);
}

export function modeHealth(provider: AiProviderHealthItem, mode: ProviderMode, health: AiProvidersHealthResponse, failed: boolean): ModeState {
  if (!enabledModes(provider).includes(mode)) return "disabled";
  if (mode === "api_key") {
    // This indicator reports stored configuration, independently of the model
    // or another channel's session. It does not certify API inference.
    return (provider.apiKeysCount ?? 0) > 0 || provider.selectedApiKey != null
      ? "configured" : "needs_review";
  }
  if (failed) return "unverified";
  if (provider.isActive !== true) return "needs_review";
  const key = typeof provider.key === "string" ? provider.key.toLowerCase() : "";
  const session = key === "openai" && mode === "token_plan_agentic" ? provider.codexSession
    : ["gemini", "google"].includes(key) ? health.engines?.[mode === "token_plan_web" ? "web" : "agentic"] : undefined;
  // An expired process-local snapshot has no current account observation.
  // Preserve explicit credential/usage denials; absence is not either denial.
  if (key === "openai" && mode === "token_plan_agentic"
    && provider.codexSession?.reason === "codex_runtime_unverified"
    && provider.codexSession.authenticated === null && provider.codexSession.usageAllowed !== false) return "unverified";
  if (session?.available === false || session?.authenticated === false
    || (key === "openai" && mode === "token_plan_agentic" && provider.codexSession?.usageAllowed === false)) return "needs_review";
  return session?.available === true && session.authenticated === true ? "session_ready" : "unverified";
}
