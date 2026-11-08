import { describe, expect, it } from "vitest";
import type { CodexSession } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession";
import { codexConnectionState, codexDetailStatus, selectCodexSession } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSessionState";

const observed: CodexSession = {
  available: true, authenticated: true, checkedAt: "2026-11-01T18:00:00Z",
  planType: null, reason: null, quotas: null, lastInferenceAt: null, usageAllowed: null,
};

describe("Codex authentication observation", () => {
  it.each([
    [undefined, "unknown"],
    [{ ...observed, available: false, authenticated: null, reason: "codex_runtime_unverified" }, "unknown"],
    [{ ...observed, available: false, authenticated: null, reason: "codex_profile_busy" }, "busy"],
    [{ ...observed, available: false, authenticated: null, reason: "codex_runtime_unavailable" }, "unavailable"],
    [{ ...observed, authenticated: false }, "disconnected"],
    [observed, "connected"],
    [{ ...observed, usageAllowed: false }, "connected"],
  ] as const)("separates observed auth from stale metadata, busy and inference %j", (session, expected) => {
    expect(codexConnectionState(session)).toBe(expected);
  });
  it("does not erase actual authentication with an undated aggregate-health expiry", () => {
    const stale: CodexSession = { ...observed, available: false, authenticated: null, checkedAt: null, reason: "codex_runtime_unverified" };
    expect(selectCodexSession(observed, stale)).toBe(observed);
    expect(selectCodexSession(undefined, stale)).toBe(stale);
  });
  it("honors a demonstrably newer observed disconnect from parent health", () => {
    const newer = { ...observed, authenticated: false, checkedAt: "2026-11-01T18:00:01Z" };
    expect(selectCodexSession(observed, newer)).toBe(newer);
  });
  it("never turns authentication metadata into verified inference availability", () => {
    expect(codexDetailStatus(observed)).toBe("unverified");
    expect(codexDetailStatus({ ...observed, usageAllowed: false })).toBe("degraded");
    expect(codexDetailStatus({ ...observed, authenticated: false })).toBe("expired");
    expect(codexDetailStatus({ ...observed, available: false, authenticated: null, reason: "codex_profile_busy" })).toBe("unverified");
  });
});
