import { describe, expect, it } from "vitest";
import { chooseModelEffort, modelOptionComplete, modelOptionEfforts, modelOptionFor, teacherModelOptions } from "../../../../modules/teacher/infrastructure/modelOptions";
import type { SelectionDraft } from "../../../../modules/teacher/infrastructure/selection";

// Synthetic catalog: labels organize choices; they do not certify inference support.
const models = ["high", "medium", "low"].map(effort => ({
  model_id: `fixture-future-model-${effort}`, label: `Fixture Future Model (${effort.toUpperCase()})`,
  efforts: ["high", "medium", "low"].map(effort_id => ({ effort_id, label: effort_id })),
}));
const current: SelectionDraft = { connection_id: "9", mode: "agentic", model_id: models[0].model_id, effort_id: "high" };

describe("Teacher reported variant presentation", () => {
  it("shows one dynamic label while preserving the exact existing selection", () => {
    const options = teacherModelOptions(models, true, current);
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe("Fixture Future Model");
    expect(modelOptionFor(options, current.model_id)).toBe(options[0]);
    expect(modelOptionComplete(options[0], current)).toBe(true);
    expect(current).toEqual({ connection_id: "9", mode: "agentic", model_id: "fixture-future-model-high", effort_id: "high" });
  });
  it("maps an explicit intensity to its reported executable ID without creating a base ID", () => {
    const [option] = teacherModelOptions(models, true, current);
    const next = chooseModelEffort(option, current, "low");
    expect(next).toEqual({ ...current, model_id: "fixture-future-model-low", effort_id: "low" });
    expect(chooseModelEffort(option, current, "unreported")).toBe(current);
    expect(modelOptionComplete(option, chooseModelEffort(option, current, null))).toBe(false);
  });
  it("lists only observed variants even if other effort preferences are configurable", () => {
    const [option] = teacherModelOptions(models.slice(0, 2), true, current);
    expect(modelOptionEfforts(option).map(item => item.effort_id)).toEqual(["high", "medium"]);
    expect(chooseModelEffort(option, current, "low")).toBe(current);
  });
  it("leaves mismatched historical tuples and other providers/modes literal", () => {
    expect(teacherModelOptions(models, true, { ...current, effort_id: "medium" }).map(item => item.label)).toEqual(models.map(item => item.label));
    expect(teacherModelOptions(models, false, current).map(item => item.value)).toEqual(models.map(item => item.model_id));
    expect(modelOptionFor(teacherModelOptions(models, true, current), "retired-fixture")).toBeUndefined();
  });
  it("does not group by names alone or when IDs/labels conflict", () => {
    expect(teacherModelOptions(models.map((item, index) => ({ ...item, model_id: `opaque-${index}` })), true, current)).toHaveLength(3);
    expect(teacherModelOptions([...models, { ...models[0], model_id: "fixture-base", label: "Fixture Future Model" }], true, current)).toHaveLength(4);
    expect(teacherModelOptions([...models, ...models.map(item => ({ ...item, model_id: `other-${item.model_id}` }))], true, current)).toHaveLength(6);
    expect(teacherModelOptions([], true, current)).toEqual([]);
  });
  it("keeps unmatched labels, individual variants and ambiguous effort metadata flat", () => {
    expect(teacherModelOptions([models[0]], true, current)[0].label).toBe(models[0].label);
    expect(teacherModelOptions(models.map(item => ({ ...item, label: item.label.replace(/\([^)]*\)/, "(Experimental)") })), true, current)).toHaveLength(3);
    expect(teacherModelOptions(models.map(item => ({ ...item, efforts: [...item.efforts, { effort_id: "HIGH", label: "HIGH" }] })), true, current).find(item => item.value === models[0].model_id)?.variants).toEqual([]);
  });
});
