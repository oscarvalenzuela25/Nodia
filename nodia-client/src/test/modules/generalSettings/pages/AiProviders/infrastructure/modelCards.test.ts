import { describe, expect, it } from "vitest";
import { modelCardContains, modelCardEffort, openAiApiReasoningPreferences, providerModelCards } from "../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/modelCards";

const models = ["high", "medium", "low"].map(effort => ({
  id: `fixture-future-family-${effort}`, displayName: `Fixture Future Family (${effort.toUpperCase()})`,
  supportedReasoningEfforts: [effort],
}));
const selected = { selectedModel: models[0].id, ocrModel: models[0].id, thinkingLevel: "high" };

describe("provider model cards", () => {
  it("groups reported variants without inventing a callable family ID or writing preferences", () => {
    const original = structuredClone(models);
    const [card] = providerModelCards(models, true, selected);
    expect(card.label).toBe("Fixture Future Family");
    expect(card.model).toBe(models[0]);
    expect(card.variants.map(item => item.model.id)).toEqual(models.map(item => item.id));
    expect(modelCardContains(card, models[1].id)).toBe(true);
    expect(modelCardEffort(card, "medium")?.model).toBe(models[1]);
    expect(modelCardEffort(card, "unreported")).toBeUndefined();
    expect(models).toEqual(original);
  });
  it("uses the selected exact model as representative and preserves independent OCR identity", () => {
    const cards = providerModelCards(models, true, { ...selected, selectedModel: models[1].id,
      thinkingLevel: "medium", ocrModel: models[0].id });
    expect(cards).toHaveLength(1);
    expect(cards[0].model).toBe(models[1]);
    expect(modelCardContains(cards[0], models[0].id)).toBe(true);
    expect(modelCardContains(cards[0], "retired-fixture")).toBe(false);
  });
  it("keeps one card and exposes contradictory selected or OCR tuples without repairing them", () => {
    const input = { ...selected, ocrModel: models[1].id, thinkingLevel: "medium",
      thinkingLevels: { [models[1].id]: "high" } };
    const original = structuredClone(input);
    const cards = providerModelCards(models, true, input);
    expect(cards).toHaveLength(1);
    expect(cards[0].model).toBe(models[0]);
    expect(cards[0].preferenceConflicts).toEqual([
      { modelId: models[0].id, effort: "high", savedPreference: "medium" },
      { modelId: models[1].id, effort: "medium", savedPreference: "high" },
    ]);
    expect(input).toEqual(original);
    const [scoped] = providerModelCards(models, true, { ...selected, thinkingLevels: { [models[0].id]: "low" } });
    expect(scoped.preferenceConflicts).toEqual([{ modelId: models[0].id, effort: "high", savedPreference: "low" }]);
    expect(providerModelCards(models, true, selected)[0].preferenceConflicts).toEqual([]);
  });
  it("does not infer variants from names alone, unsupported suffixes or ambiguous families", () => {
    expect(providerModelCards(models, false, selected)).toHaveLength(3);
    expect(providerModelCards(models.map((item, index) => ({ ...item, id: `opaque-${index}` })), true, selected)).toHaveLength(3);
    expect(providerModelCards([...models, { ...models[0], id: "base-fixture", displayName: "Fixture Future Family" }], true, selected)).toHaveLength(4);
    expect(providerModelCards([...models, models[0]], true, selected)).toHaveLength(4);
    expect(providerModelCards([...models, ...models.map(item => ({ ...item, id: "another-" + item.id }))], true, selected)).toHaveLength(6);
    expect(providerModelCards([models[0]], true, selected)[0].variants).toEqual([]);
    expect(providerModelCards([], true, selected)).toEqual([]);
  });
  it("lists only protocol preferences implemented for OpenAI API, without claiming Ultra", () => {
    expect(openAiApiReasoningPreferences).toEqual(["low", "medium", "high", "xhigh", "max"]);
  });
});
