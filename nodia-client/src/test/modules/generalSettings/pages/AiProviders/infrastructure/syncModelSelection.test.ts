import { describe, expect, it } from "vitest";
import { providerModelCards } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/modelCards";
import { selectSyncCards, syncCardSelected, syncModelsFieldsPatch, syncRoleOptions, validDiscoveredModels } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/syncModelSelection";

const variants = ["high", "medium", "low"].map(effort => ({
  id: `fixture-family-${effort}`, name: `Fixture Family (${effort})`,
}));
const other = { id: "fixture-other", name: "Other" };
const cards = providerModelCards([...variants, other], true, { selectedModel: variants[0].id });

describe("sync model family selection", () => {
  it("rejects missing, malformed and duplicate discoveries while retaining real zero and unknown context", () => {
    for (const input of [undefined, null, {}, "models", [null], [{ id: "x" }],
      [{ id: "x", name: "X", capabilities: [42] }], [{ id: "x", name: "X", contextWindow: Infinity }],
      [other, other], [{ ...other, displayName: {} }]]) expect(validDiscoveredModels(input)).toBe(false);
    expect(validDiscoveredModels([])).toBe(true);
    expect(validDiscoveredModels([{ ...other, contextWindow: 0 }, { id: "unknown", name: "Unknown", contextWindow: null }])).toBe(true);
  });
  it("activates all real variants and removes the whole family without touching another selected family", () => {
    const original = new Set([variants[1].id, other.id]);
    expect(syncCardSelected(cards[0], original)).toBe(true);
    expect([...selectSyncCards([cards[0]], original, true)]).toEqual([variants[1].id, other.id, variants[0].id, variants[2].id]);
    expect([...selectSyncCards([cards[0]], original, false)]).toEqual([other.id]);
    expect([...original]).toEqual([variants[1].id, other.id]);
  });

  it("retains dynamic discovered reasoning metadata and rejects malformed options before saving", () => {
    const models = [{ ...other, supportedReasoningEfforts: ["future_effort", "medium"] }];
    expect(validDiscoveredModels(models)).toBe(true);
    const patch = syncModelsFieldsPatch({ fields: {}, mode: "agentic", models, mainId: other.id, ocrId: "", effortChanges: {} });
    expect(patch.agentic).toMatchObject({ available_models: models });
    for (const value of [null, "medium", [42], ["INVALID"], Array(33).fill("medium")]) {
      expect(validDiscoveredModels([{ ...other, supportedReasoningEfforts: value }])).toBe(false);
    }
    expect(validDiscoveredModels([{ ...other, supportedReasoningEfforts: [] }])).toBe(true);
  });

  it("offers one family per role while keeping independent primary and OCR IDs", () => {
    const selected = new Set(variants.map(model => model.id));
    expect(syncRoleOptions(cards, selected, variants[1].id)).toEqual([
      { value: variants[1].id, label: "Fixture Family", description: undefined },
    ]);
    expect(syncRoleOptions(cards, selected, variants[0].id)[0].value).toBe(variants[0].id);
    expect(syncRoleOptions(cards, new Set(), variants[1].id)).toEqual([]);
  });

  it("serializes explicit OCR removal and only patches the edited mode and chosen efforts", () => {
    const patch = syncModelsFieldsPatch({ fields: { thinking_levels: { historical: "low" } },
      mode: "agentic", defaultMode: "api_key", models: variants, mainId: variants[1].id,
      ocrId: "", effortChanges: { [variants[1].id]: "medium" } });
    expect(JSON.parse(JSON.stringify(patch))).toEqual({ agentic: {
      available_models: variants, selected_model: variants[1].id, ocr_model: null, ocr_focus_model: null,
      thinking_levels: { [variants[1].id]: "medium" }, thinking_level: "medium",
    } });
  });

  it("mirrors default scalar fields, confines effort patches to their mode, and preserves independent OCR", () => {
    const patch = syncModelsFieldsPatch({ fields: { thinking_levels: { historical: "low" } },
      mode: "agentic", defaultMode: "agentic", models: variants, mainId: variants[1].id,
      ocrId: variants[0].id, effortChanges: { [variants[1].id]: "medium" } });
    expect(patch.ocr_model).toBe(variants[0].id);
    expect(patch).not.toHaveProperty("thinking_levels");
    expect(patch.agentic).toMatchObject({ thinking_levels: { [variants[1].id]: "medium", [variants[0].id]: null } });
    expect(patch.thinking_level).toBe("medium");
    const untouched = syncModelsFieldsPatch({ fields: {}, mode: "agentic", models: variants,
      mainId: variants[0].id, ocrId: variants[1].id, effortChanges: {} });
    expect(untouched).not.toHaveProperty("thinking_level");
    expect(untouched).not.toHaveProperty("thinking_levels");
  });

  it("pins OCR's inherited effort before changing the principal's general preference", () => {
    const fields = { agentic: { selected_model: variants[0].id, ocr_model: variants[0].id, thinking_level: "high" } };
    const patch = syncModelsFieldsPatch({ fields, mode: "agentic", defaultMode: "agentic", models: variants,
      mainId: variants[1].id, ocrId: variants[0].id, effortChanges: { [variants[1].id]: "medium" } });
    expect(patch.agentic).toMatchObject({ thinking_level: "medium", thinking_levels: {
      [variants[0].id]: "high", [variants[1].id]: "medium",
    } });
    const explicit = syncModelsFieldsPatch({ fields: { agentic: { thinking_level: "high", thinking_levels: { [variants[0].id]: null } } },
      mode: "agentic", models: variants, mainId: variants[1].id, ocrId: variants[0].id, effortChanges: { [variants[1].id]: "medium" } });
    expect(explicit.agentic).toMatchObject({ thinking_levels: { [variants[1].id]: "medium" } });
    expect((explicit.agentic as Record<string, unknown>).thinking_levels).not.toHaveProperty(variants[0].id);
  });

  it("preserves unscoped historical preferences when the connection has no default mode", () => {
    const fields = { thinking_level: "high", thinking_levels: { [variants[0].id]: "high", historical: null } };
    const patch = syncModelsFieldsPatch({ fields, mode: "agentic", defaultMode: null, models: variants,
      mainId: variants[0].id, ocrId: "", effortChanges: {} });
    expect(patch.agentic).toMatchObject(fields);
    const edited = syncModelsFieldsPatch({ fields, mode: "agentic", defaultMode: null, models: variants,
      mainId: variants[1].id, ocrId: variants[0].id, effortChanges: { [variants[1].id]: "medium" } });
    expect(edited.agentic).toMatchObject({ thinking_level: "medium", thinking_levels: {
      [variants[0].id]: "high", historical: null, [variants[1].id]: "medium",
    } });
    expect(edited).not.toHaveProperty("thinking_levels");
  });
});
