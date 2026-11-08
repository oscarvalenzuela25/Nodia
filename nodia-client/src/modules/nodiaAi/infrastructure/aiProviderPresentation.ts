export const nodiaAiProviderResources = ["ai_providers", "ai_provider_catalog"] as const;
const tools = ["nodia_ai_providers_prepare_create", "nodia_ai_providers_prepare_update", "nodia_ai_providers_prepare_catalog_create", "nodia_ai_providers_prepare_catalog_update"];
export const nodiaAiProviderTool = (name: string) => tools.includes(name);
export const nodiaAiProviderRoute = (resource: string, id: string): string | undefined => resource === "ai_providers" ? `/ai-providers?provider=${encodeURIComponent(id)}` : resource === "ai_provider_catalog" ? "/ai-providers" : undefined;
const fields = ["secure_operation", "connection", "key_selection_impact", "sort_order", "is_selected", "provider_id", "provider_key", "catalog_active", "id", "name", "key", "catalog_id", "catalog", "label", "mode", "default_mode", "is_active", "is_default", "use_api_key", "use_agentic", "can_use_api_key", "can_use_agentic", "auto_rotate_api_keys", "translates", "es", "en", "selected_model", "ocr_model", "resolved_existing", "catalog_details", "configuration_status", "configured", "availability_unknown", "previous_defaults", "affected_connections", "availability", "changes_chat_configuration", "reasoning_preferences", "model_id", "model_override", "general_level", "legacy_boolean", ...["api_key", "agentic"].flatMap(mode => ["selected_model", "ocr_model", "ocr_focus_model", "thinking_level"].map(field => `${mode}.${field}`))];
export const nodiaAiProviderFieldLabels: Record<string, string> = Object.fromEntries(fields.map(field => [field, `nodiaAi:proposal.ai_provider_fields.${field}`]));

export const nodiaAiProviderValueKey = (field: string | undefined, value: string): string | undefined => field === "secure_operation" && ["api_key_create", "api_key_update", "api_key_delete", "connection_login", "nodia_logout", "codex_logout", "sync_models"].includes(value) ? `nodiaAi:secure.kinds.${value}` : field === "availability" && value === "unknown" ? "nodiaAi:proposal.ai_provider_values.unknown" : field === "default_mode" || field === "mode" ? ["api_key", "agentic"].includes(value) ? `nodiaAi:proposal.ai_provider_modes.${value}` : undefined : undefined;

const providerErrors: Record<string, string> = {
  "nodia_ai:ai_provider_model_unavailable": "nodiaAi:proposal.ai_provider_errors.model_unavailable",
  "nodia_ai:ai_provider_reasoning_unavailable": "nodiaAi:proposal.ai_provider_errors.reasoning_unavailable",
  "nodia_ai:ai_provider_translation_removal_unsupported": "nodiaAi:proposal.ai_provider_errors.translation_removal_unsupported",
};
export const nodiaAiProviderErrorKey = (value: unknown): string | undefined => typeof value === "string" && Object.hasOwn(providerErrors, value) ? providerErrors[value] : undefined;
