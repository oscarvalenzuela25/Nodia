const secureTools: Readonly<Record<string, string>> = {
  nodia_secure_flows_prepare_api_key_create: "api_key_create",
  nodia_secure_flows_prepare_api_key_update: "api_key_update",
  nodia_api_keys_prepare_delete: "api_key_delete",
  nodia_secure_flows_prepare_connection_login: "connection_login",
  nodia_secure_flows_prepare_nodia_logout: "nodia_logout",
  nodia_ai_providers_prepare_codex_logout: "codex_logout",
  nodia_ai_providers_prepare_gemini_web_logout: "gemini_web_logout",
  nodia_ai_providers_prepare_sync_models: "sync_models",
};
export const nodiaAiSecureKind = (tool: string): string | undefined => Object.hasOwn(secureTools, tool) ? secureTools[tool] : undefined;
