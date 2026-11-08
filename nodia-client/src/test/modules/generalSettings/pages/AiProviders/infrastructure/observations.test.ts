import { describe, expect, it } from "vitest";
import { getObservedSessionStatus } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/observations";

describe("observed Agentic session status", () => {
  it.each([
    [undefined, "unverified"],
    [{ available: true, authenticated: undefined }, "unverified"],
    [{ available: false, authenticated: true }, "degraded"],
    [{ available: true, authenticated: false }, "expired"],
    [{ available: true, authenticated: true }, "healthy"],
    [{ available: true, authenticated: true, usageAllowed: false }, "degraded"],
    [{ available: true, authenticated: true, reason: "codex_runtime_unverified" }, "unverified"],
  ] as const)("projects only the actual observation %j as %s", (observation, status) => {
    expect(getObservedSessionStatus(observation)).toBe(status);
  });
});
