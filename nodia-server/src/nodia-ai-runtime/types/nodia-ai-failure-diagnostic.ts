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
export interface NodiaAiFailureDiagnostic {
  error_type: string;
  error_code: string | null;
  sql_state: string | null;
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
  } catch {
    /* Hostile getters and diagnostic failures never replace the original failure. */
  }
  return result;
}
