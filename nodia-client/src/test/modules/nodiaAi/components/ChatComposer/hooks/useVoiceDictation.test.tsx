import { describe, expect, it } from "vitest";
import { useVoiceDictation as historical } from "../../../../../../modules/nodiaAi/components/ChatComposer/hooks/useVoiceDictation";
import { useVoiceDictation } from "../../../../../../hooks/useVoiceDictation";

describe("historical NodiaAI dictation import", () => {
  it("exports the same shared lifecycle without creating another capture owner", () => { expect(historical).toBe(useVoiceDictation); });
});
