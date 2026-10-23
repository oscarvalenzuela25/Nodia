import { describe, expect, it } from "vitest";
import { nodiaAiEligibilityReasonKey } from "../../../../modules/nodiaAi/infrastructure/eligibilityPresentation";
import i18n from "../../../../translate";

describe("NodiaAI public eligibility reasons", () => {
  it.each([
    "runtime_busy", "session_required", "adapter_transport_unavailable", "adapter_unconfigured",
    "runtime_unconfigured", "adapter_connection_unavailable", "adapter_mode_unsupported",
    "model_unavailable", "model_option_mismatch", "thinking_level_unsupported",
    "adapter_protocol_unverified", "mcp_adapter_unverified", "adapter_invalid_observation", "adapter_invalid_response",
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
