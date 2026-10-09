import type { AiProviderHealthItem, AiProvidersHealthResponse } from "../../../../../modules/generalSettings/pages/AiProviders/infrastructure/types";

export type ProviderMode = "api_key" | "token_plan_web" | "token_plan_agentic";
export type ModeState = "session_ready" | "healthy" | "needs_review" | "unverified";

export function enabledModes(provider: AiProviderHealthItem): ProviderMode[] {
  return ([
    ["api_key", provider.use_api_key ?? (provider.mode === "api_key")],
    ["token_plan_web", provider.use_token_plan_web ?? (provider.mode === "web_session")],
    ["token_plan_agentic", provider.use_token_plan_agentic ?? (provider.mode === "token_plan_agentic")],
  ] as const).flatMap(([mode, enabled]) => enabled === true ? [mode] : []);
}

export function modeHealth(provider: AiProviderHealthItem, mode: ProviderMode, health: AiProvidersHealthResponse, failed: boolean): ModeState {
  if (failed) return "unverified";
  if (provider.isActive !== true) return "needs_review";
  if (mode === "api_key") {
    // Aggregate session health does not prove that the API channel works.
    if (provider.mode !== "api_key") return "unverified";
    if (provider.status === "healthy") return "healthy";
    return ["degraded", "expired", "unconfigured"].includes(provider.status) ? "needs_review" : "unverified";
  }
  const key = typeof provider.key === "string" ? provider.key.toLowerCase() : "";
  const session = key === "openai" && mode === "token_plan_agentic" ? provider.codexSession
    : ["gemini", "google"].includes(key) ? health.engines?.[mode === "token_plan_web" ? "web" : "agentic"] : undefined;
  if (session?.available === false || session?.authenticated === false
    || (key === "openai" && mode === "token_plan_agentic" && provider.codexSession?.usageAllowed === false)) return "needs_review";
  return session?.available === true && session.authenticated === true ? "session_ready" : "unverified";
}
