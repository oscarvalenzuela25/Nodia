/** Supplemental diagnostics: closed code-owned categories, never messages, SQL or provider payloads. */
const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'QueryFailedError',
  'EntityMetadataNotFoundError',
  'ForbiddenException',
  'UnauthorizedException',
  'BadRequestException',
  'NotFoundException',
  'ServiceUnavailableException',
  'NodiaAiLostLeaseError',
  'NodiaAiKnownPreDispatchError',
  'NodiaAiAdapterError',
  'AbortError',
  'TimeoutError',
]);
const errorCodes = new Set([
  'nodia_ai:invalid_tool_input',
  'nodia_ai:invalid_tool_output',
  'nodia_ai:invalid_input',
  'nodia_ai:invalid_selection',
  'nodia_ai:execution_limit',
  'nodia_ai:cancelled',
  'nodia_ai:capability_denied',
  'nodia_ai:catalog_changed',
  'nodia_ai:context_limit',
  'nodia_ai:tool_catalog_limit',
  'nodia_ai:deadline_exceeded',
  'nodia_ai:eligibility_changed',
  'nodia_ai:agentic_observation_timeout',
  'nodia_ai:stage_failed',
  'nodia_ai:outcome_unknown',
  'nodia_ai:module_not_allowed',
  'nodia_ai:business_scope_not_allowed',
  'nodia_ai:business_result_scope_invalid',
  'nodia_ai:business_operation_invalid',
  'nodia_ai:business_result_invalid',
  'nodia_ai:invalid_knowledge_request',
  'nodia_ai:forbidden_knowledge_fragment',
  'nodia_ai:knowledge_release_changed',
  'nodia_ai:knowledge_not_available',
  'nodia_ai:request_conflict',
  'nodia_ai:invalid_provider_response',
  'nodia_ai:tool_registry_invalid',
  'nodia_ai:operation_not_implemented',
  'authorization:transaction_required',
  'authorization:statement_timeout',
  'auth:session_expired',
  'mcp_result_unknown',
  'mcp_call_invalid',
  'mcp_result_invalid',
  'mcp_events_invalid',
  'mcp_cancelled',
  'mcp_terminal_missing',
  'adapter_configuration_changed',
  'runtime_busy',
  'nodia_ai:runtime_busy',
  'adapter_invalid_selection',
  'adapter_mode_unsupported',
  'adapter_connection_unavailable',
  'adapter_invalid_observation',
  'adapter_invalid_request',
  'adapter_attachments_unverified',
  'mcp_catalog_invalid',
]);
const sqlStates = new Set([
  '23503',
  '23505',
  '23502',
  '22P02',
  '22007',
  '42703',
  '42P01',
  '40001',
  '40P01',
  '57014',
  '55P03',
]);
const eligibilityReasons = new Set([
  // Source-owned Gemini observation/status categories; arbitrary upstream text is excluded.
  'runtime_unconfigured', 'session_required', 'adapter_protocol_unverified',
  'model_unavailable', 'model_option_mismatch', 'session_adapter_unverified',
  'agentic_cli_incompatible', 'agentic_session_required', 'agentic_session_unverified',
  'agentic_timeout', 'agentic_unavailable', 'agentic_login_in_progress', 'runtime_busy',
  // Source-owned Codex observation categories; unknown session reasons remain redacted.
  'codex_model_unavailable', 'codex_session_unverified',
]);
const eligibilitySources = new Set(['gemini_live_session_and_catalog', 'codex_live_session_and_catalog']);
const eligibilityContracts = new Set(['nodia-ai-gemini-chat/1', 'nodia-ai-codex-chat/1']);
const eligibilityPhases = new Set(['discovery', 'selection_requested', 'ack_pending', 'execution']);
const eligibilityBooleanKeys = [
  'available', 'delegated', 'resource_key_present', 'resource_key_matches',
  'configuration_matches', 'session_matches', 'adapter_identity_matches', 'supports_mcp',
] as const;
type EligibilityBooleanKey = (typeof eligibilityBooleanKeys)[number];
export interface NodiaAiEligibilityDiagnostic extends Record<EligibilityBooleanKey, boolean | null> {
  location: 'inference_observation_guard' | 'other';
  reason: string | null;
  source: string;
  adapter_contract: string;
  selection_phase: string;
}
const eligibilityByError = new WeakMap<Error, Readonly<NodiaAiEligibilityDiagnostic>>();

/** Read only own data descriptors: accessors, inherited fields and hostile proxies cannot emit data. */
function ownDiagnosticValue(input: unknown, key: string): unknown {
  try {
    if (!input || typeof input !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}
function closedDiagnosticCategory(value: unknown, allowed: ReadonlySet<string>): string {
  return typeof value === 'string' && allowed.has(value) ? value : 'other';
}
/** Pure fixed-shape projection; never retain resources, models, hashes, messages or provider payloads. */
export function nodiaAiEligibilityDiagnostic(input: unknown): Readonly<NodiaAiEligibilityDiagnostic> {
  const reason = ownDiagnosticValue(input, 'reason');
  const booleans = Object.fromEntries(eligibilityBooleanKeys.map((key) => {
    const value = ownDiagnosticValue(input, key);
    return [key, typeof value === 'boolean' ? value : null];
  })) as Record<EligibilityBooleanKey, boolean | null>;
  return Object.freeze({
    location: ownDiagnosticValue(input, 'location') === 'inference_observation_guard' ? 'inference_observation_guard' : 'other',
    reason: reason === null ? null : closedDiagnosticCategory(reason, eligibilityReasons),
    source: closedDiagnosticCategory(ownDiagnosticValue(input, 'source'), eligibilitySources),
    adapter_contract: closedDiagnosticCategory(ownDiagnosticValue(input, 'adapter_contract'), eligibilityContracts),
    selection_phase: closedDiagnosticCategory(ownDiagnosticValue(input, 'selection_phase'), eligibilityPhases),
    ...booleans,
  });
}
/** Supplemental private sidecar; failures preparing telemetry never replace or mutate the original error. */
export function withNodiaAiEligibilityDiagnostic<T extends Error>(error: T, input: () => unknown): T {
  try {
    eligibilityByError.set(error, nodiaAiEligibilityDiagnostic(input()));
  } catch {
    /* Diagnostics cannot change authority, retryability or the original failure. */
  }
  return error;
}
export interface NodiaAiFailureDiagnostic {
  error_type: string;
  error_code: string | null;
  sql_state: string | null;
  eligibility?: Readonly<NodiaAiEligibilityDiagnostic>;
}
export function nodiaAiFailureDiagnostic(
  error: unknown,
): NodiaAiFailureDiagnostic {
  const result: NodiaAiFailureDiagnostic = {
    error_type: 'Other',
    error_code: null,
    sql_state: null,
  };
  try {
    if (!error || typeof error !== 'object') return result;
    const value = error as {
      constructor?: { name?: unknown };
      message?: unknown;
      code?: unknown;
      errorCode?: unknown;
      driverError?: { code?: unknown };
    };
    const name = value.constructor?.name;
    if (typeof name === 'string' && errorTypes.has(name))
      result.error_type = name;
    for (const code of [value.errorCode, value.code, value.message]) {
      if (typeof code === 'string' && errorCodes.has(code)) {
        result.error_code = code;
        break;
      }
    }
    const sqlState = value.driverError?.code ?? value.code;
    if (typeof sqlState === 'string' && sqlStates.has(sqlState))
      result.sql_state = sqlState;
    if (result.error_code === 'nodia_ai:eligibility_changed' && error instanceof Error) {
      const eligibility = eligibilityByError.get(error);
      if (eligibility) result.eligibility = eligibility;
    }
  } catch {
    /* Hostile getters and diagnostic failures never replace the original failure. */
  }
  return result;
}
