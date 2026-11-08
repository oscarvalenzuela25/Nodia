// Only public categories explicitly returned by the eligibility use case are
// presented. Never reflect arbitrary provider/error text into the chat.
const reasonKeys: Readonly<Record<string, string>> = {
  "nodia_ai:runtime_busy": "eligibility_reasons.busy",
  "nodia_ai:session_required": "eligibility_reasons.session_required",
  "nodia_ai:adapter_transport_unavailable": "eligibility_reasons.transport_unavailable",
  "nodia_ai:adapter_unconfigured": "eligibility_reasons.unconfigured",
  "nodia_ai:runtime_unconfigured": "eligibility_reasons.unconfigured",
  "nodia_ai:adapter_connection_unavailable": "eligibility_reasons.connection_unavailable",
  "nodia_ai:adapter_mode_unsupported": "eligibility_reasons.mode_unsupported",
  "nodia_ai:model_unavailable": "eligibility_reasons.model_unavailable",
  "nodia_ai:model_option_mismatch": "eligibility_reasons.option_unsupported",
  "nodia_ai:thinking_level_unsupported": "eligibility_reasons.option_unsupported",
  "nodia_ai:adapter_protocol_unverified": "eligibility_reasons.protocol_unverified",
  "nodia_ai:mcp_adapter_unverified": "eligibility_reasons.protocol_unverified",
  "nodia_ai:adapter_invalid_observation": "eligibility_reasons.invalid_observation",
  "nodia_ai:adapter_invalid_response": "eligibility_reasons.invalid_observation",
  "nodia_ai:api_configuration_unavailable": "eligibility_reasons.unconfigured",
  "nodia_ai:api_model_unavailable": "eligibility_reasons.model_unavailable",
  "nodia_ai:api_credential_unavailable": "eligibility_reasons.api_credential_required",
};

export const nodiaAiEligibilityReasonKey = (reason: string | null | undefined): string =>
  (reason && Object.hasOwn(reasonKeys, reason) ? reasonKeys[reason] : undefined) ?? "selection_unavailable";

const runErrorKeys: Readonly<Record<string, string>> = {
  "nodia_ai:compaction_invalid": "context_errors.compaction_invalid",
  "nodia_ai:context_sources_changed": "context_errors.context_sources_changed",
  "nodia_ai:context_snapshot_invalid": "context_errors.context_snapshot_invalid",
  "nodia_ai:context_limit": "context_errors.context_limit",
  "nodia_ai:invalid_image_generation_request": "nodia_ai:invalid_image_generation_request",
  "nodia_ai:invalid_generated_image": "nodia_ai:invalid_generated_image",
  "nodia_ai:generated_image_storage_unavailable": "nodia_ai:generated_image_storage_unavailable",
  "nodia_ai:api_configuration_unavailable": "eligibility_reasons.unconfigured",
  "nodia_ai:api_model_unavailable": "eligibility_reasons.model_unavailable",
  "nodia_ai:api_credential_unavailable": "eligibility_reasons.api_credential_required",
  "nodia_ai:api_provider_rate_limited": "api_errors.rate_limited",
  "nodia_ai:api_provider_credential_rejected": "api_errors.credential_rejected",
  "nodia_ai:api_provider_rejected": "api_errors.provider_rejected",
  "nodia_ai:api_response_invalid": "api_errors.response_invalid",
  "nodia_ai:api_response_incomplete": "api_errors.response_invalid",
  "nodia_ai:api_response_limit": "api_errors.response_invalid",
  "nodia_ai:api_payload_limit": "api_errors.exchange_invalid",
  "nodia_ai:api_json_limit": "api_errors.exchange_invalid",
  "nodia_ai:api_json_invalid": "api_errors.exchange_invalid",
  "nodia_ai:api_tool_budget_exhausted": "api_errors.budget_exhausted",
  "nodia_ai:api_exchange_budget_exhausted": "api_errors.budget_exhausted",
  "nodia_ai:api_image_invalid": "api_errors.image_invalid",
  "nodia_ai:api_image_effort_unsupported": "api_errors.image_effort_unsupported",
  "nodia_ai:api_result_unknown": "api_errors.result_unknown",
  "nodia_ai:api_runtime_start_failed": "api_errors.runtime_start_failed",
  "nodia_ai:api_acceptance_invalid": "api_errors.acceptance_invalid",
};

/** Public categories only; arbitrary provider text and object prototype names stay hidden. */
export const nodiaAiRunErrorKey = (code: string | null | undefined): string | null =>
  code && Object.hasOwn(runErrorKeys, code) ? runErrorKeys[code] : null;
