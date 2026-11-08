import { describe, expect, it } from "vitest";
import historical from "../../../../../modules/nodiaAi/components/VoiceActivity";
import VoiceActivity from "../../../../../components/VoiceActivity";

describe("historical NodiaAI activity import", () => {
  it("exports the shared stream observer without another audio lifecycle", () => { expect(historical).toBe(VoiceActivity); });
});
