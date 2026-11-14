import { describe, expect, it } from "vitest";
import { catalogModelOptions, chooseModelEffort, modelOptionComplete, modelOptionEfforts, modelOptionFor } from "../../utils/modelVariantOptions";

// Synthetic future catalog; no named production model or inference capability is assumed.
const models = ["precise", "fast"].map(effort_id => ({
  model_id: `fixture-next-family-${effort_id}`, label: `Fixture Next Family (${effort_id.toUpperCase()})`,
  efforts: [{ effort_id, label: `Observed ${effort_id}` }], metadata: effort_id,
}));
const current = { connection_id: "fixture-connection", model_id: models[1].model_id, effort_id: "fast" };

describe("shared catalog variant options", () => {
  it("presents one family and retains the exact selection and source metadata", () => {
    const original = structuredClone(models);
    const options = catalogModelOptions(models, true, current);
    expect(options.map(item => item.label)).toEqual(["Fixture Next Family"]);
    expect(modelOptionFor(options, current.model_id)).toBe(options[0]);
    expect(options[0].variants[1].model.metadata).toBe("fast");
    expect(modelOptionComplete(options[0], current)).toBe(true);
    expect(models).toEqual(original);
  });

  it("switches executable identity only after an explicit reported effort choice", () => {
    const [option] = catalogModelOptions(models, true, current);
    expect(modelOptionEfforts(option)).toEqual(models.flatMap(item => item.efforts));
    expect(chooseModelEffort(option, current, "precise")).toEqual({ ...current, model_id: models[0].model_id, effort_id: "precise" });
    expect(chooseModelEffort(option, current, "unreported")).toBe(current);
    expect(modelOptionComplete(option, { ...current, effort_id: null })).toBe(false);
    expect(modelOptionComplete(option, { ...current, effort_id: "precise" })).toBe(false);
  });

  it("preserves historical contradictions and opts out for other providers or modes", () => {
    expect(catalogModelOptions(models, true, { ...current, effort_id: "precise" }).map(item => item.label)).toEqual(models.map(item => item.label));
    expect(catalogModelOptions(models, false, current).map(item => item.value)).toEqual(models.map(item => item.model_id));
    expect(modelOptionFor(catalogModelOptions(models, true, current), "retired-fixture")).toBeUndefined();
  });

  it("leaves absent, ambiguous and unreported metadata ungrouped", () => {
    expect(catalogModelOptions([], true, current)).toEqual([]);
    expect(catalogModelOptions(models.map(item => ({ ...item, efforts: [] })), true, current)).toHaveLength(2);
    expect(catalogModelOptions([...models, models[0]], true, current)).toHaveLength(3);
    expect(catalogModelOptions([...models, { ...models[0], model_id: "fixture-base", label: "Fixture Next Family" }], true, current)).toHaveLength(3);
    expect(catalogModelOptions(models.map((item, index) => ({ ...item, model_id: `opaque-${index}` })), true, current)).toHaveLength(2);
  });
});
