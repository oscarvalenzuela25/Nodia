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
};

export const nodiaAiEligibilityReasonKey = (reason: string | null | undefined): string =>
  (reason && Object.hasOwn(reasonKeys, reason) ? reasonKeys[reason] : undefined) ?? "selection_unavailable";
