const ERROR_KEYS: Readonly<Record<string, string>> = {
  invalid_generated_content: "teacher:invalid_generated_content",
  configuration_changed: "teacher:configuration_changed",
  authority_changed: "teacher:authority_changed",
  budget_exhausted: "teacher:budget_exhausted",
  capacity_unavailable: "teacher:capacity_unavailable",
  adapter_unqualified: "teacher:adapter_unqualified",
  provider_unavailable: "teacher:provider_unavailable",
  session_paused: "teacher:session_paused",
  queue_deadline: "teacher:queue_deadline",
  job_deadline: "teacher:job_deadline",
  provider_outcome_unknown: "teacher:job_error_provider_unknown",
  provider_result_lost: "teacher:job_error_result_lost",
  local_closure_unproven: "teacher:job_error_closure_unproven",
  worker_lost_before_dispatch: "teacher:job_error_worker_lost",
  agentic_preflight_failed: "teacher:job_error_preflight",
  lifecycle_cli_timeout: "teacher:job_error_timeout",
};

export function jobErrorKey(code: string | null, knownFailure = false): string | null {
  if (!code) return null;
  const exact = code.startsWith("teacher:") ? code.slice(8) : code;
  if (exact === "native_dispatch_excluded" && knownFailure) return "teacher:job_error_native_excluded";
  return Object.hasOwn(ERROR_KEYS, exact) ? ERROR_KEYS[exact] : "teacher:job_error_unrecognized";
}
