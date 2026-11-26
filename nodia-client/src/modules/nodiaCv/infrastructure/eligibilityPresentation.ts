export function cvEligibilityReasonKey(reason: string | null) {
  switch (reason) {
    case "agentic_transport_unavailable":
      return "model_selector.agentic_host_unavailable";
    case "configuration_unavailable":
    case "qualification_required":
    case "available":
    case "qualified":
    case "codex_runtime_unavailable":
    case "codex_session_required":
    case "codex_session_unverified":
    case "codex_model_unavailable":
    case "codex_effort_unavailable":
    case "codex_profile_busy":
    case "codex_usage_unavailable":
    case "gemini_runtime_unavailable":
    case "gemini_session_required":
    case "gemini_session_unverified":
    case "gemini_model_unavailable":
    case "gemini_effort_unavailable":
    case "gemini_profile_busy":
      return `model_selector.${reason}` as const;
    default:
      return "model_selector.selection_unavailable";
  }
}
