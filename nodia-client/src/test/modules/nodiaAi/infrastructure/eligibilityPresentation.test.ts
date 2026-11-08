import { describe, expect, it } from "vitest";
import { nodiaAiEligibilityReasonKey, nodiaAiRunErrorKey } from "../../../../modules/nodiaAi/infrastructure/eligibilityPresentation";
import i18n from "../../../../translate";

describe("NodiaAI public eligibility reasons", () => {
  it.each([
    "runtime_busy", "session_required", "adapter_transport_unavailable", "adapter_unconfigured",
    "runtime_unconfigured", "adapter_connection_unavailable", "adapter_mode_unsupported",
    "model_unavailable", "model_option_mismatch", "thinking_level_unsupported",
    "adapter_protocol_unverified", "mcp_adapter_unverified", "adapter_invalid_observation", "adapter_invalid_response",
    "api_configuration_unavailable", "api_model_unavailable", "api_credential_unavailable",
  ])("maps the public %s category to translated feedback in both languages", reason => {
    const key = nodiaAiEligibilityReasonKey(`nodia_ai:${reason}`);
    expect(key).not.toBe("selection_unavailable");
    expect(i18n.exists(`nodiaAi:${key}`, { lng: "es" })).toBe(true);
    expect(i18n.exists(`nodiaAi:${key}`, { lng: "en" })).toBe(true);
  });

  it.each([null, undefined, "private text", "toString", "__proto__", "nodia_ai:adapter_unavailable"])("does not reflect absent or unmapped reason %s", reason => {
    expect(nodiaAiEligibilityReasonKey(reason)).toBe("selection_unavailable");
  });
});

describe("NodiaAI API public run feedback", () => {
  it("maps every supported API error to translated actionable feedback without changing legacy errors", () => {
    const categories = ["api_configuration_unavailable", "api_model_unavailable", "api_credential_unavailable",
      "api_provider_rate_limited", "api_provider_credential_rejected", "api_provider_rejected", "api_response_invalid",
      "api_response_incomplete", "api_response_limit", "api_payload_limit", "api_json_limit", "api_json_invalid",
      "api_tool_budget_exhausted", "api_exchange_budget_exhausted", "api_image_invalid", "api_image_effort_unsupported",
      "api_result_unknown", "api_runtime_start_failed", "api_acceptance_invalid", "compaction_invalid", "context_limit"];
    for (const category of categories) {
      const key = nodiaAiRunErrorKey(`nodia_ai:${category}`);
      expect(key).not.toBeNull();
      expect(i18n.exists(`nodiaAi:${key}`, { lng: "es" })).toBe(true);
      expect(i18n.exists(`nodiaAi:${key}`, { lng: "en" })).toBe(true);
    }
  });
  it("never displays arbitrary upstream text, missing codes or prototype properties", () => {
    for (const code of [null, undefined, "private provider response", "nodia_ai:new_unmapped_error", "toString", "__proto__"])
      expect(nodiaAiRunErrorKey(code)).toBeNull();
  });
});
