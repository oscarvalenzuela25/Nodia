import { describe, expect, it } from "vitest";
import { selectionIssue, validSelection, withObservedModels, type ConnectionCatalog, type ConnectionModelsObservation } from "../../../../modules/teacher/infrastructure/selection";

const draft = { connection_id: "fixture-a", mode: "agentic" as const, model_id: "fixture-model", effort_id: "medium" };
const catalog: ConnectionCatalog = { items: [{ connection_id: draft.connection_id, provider_key: "openai", label: "Fixture A", is_active: true,
  is_default: true, default_mode: "agentic", modes: [{ mode: "agentic", configured_selection: draft, configuration: "configured",
    models: [{ model_id: draft.model_id, label: "Stored model", efforts: [] }] }] }], next_cursor: null };
const observation: ConnectionModelsObservation = { connection_id: draft.connection_id, mode: "agentic", models: [
  { model_id: draft.model_id, label: "Observed model", efforts: ["medium", "future"].map(effort_id => ({ effort_id, label: effort_id })) },
  { model_id: "unconfigured-fixture", label: "Must not activate", efforts: [] },
] };

describe("Teacher selection catalog", () => {
  it("recovers real reasoning metadata for the same configured ID without mutating configuration or adding models", () => {
    expect(selectionIssue(catalog, draft)).toBe("effort_unreported");
    expect(validSelection(catalog, draft)).toBeNull();
    const recovered = withObservedModels(catalog, observation, draft.connection_id, draft.mode);
    expect(recovered?.items[0].modes[0].models).toEqual([observation.models[0]]);
    expect(validSelection(recovered, draft)).toEqual(draft);
    expect(selectionIssue(recovered, draft)).toBeNull();
    expect(catalog.items[0].modes[0].models[0].efforts).toEqual([]);
    expect(recovered?.items[0].modes[0].configured_selection).toBe(draft);
  });
  it("ignores late observations for another connection or mode and preserves removed models for explicit correction", () => {
    expect(withObservedModels(catalog, observation, "fixture-b", draft.mode)).toBe(catalog);
    expect(withObservedModels(catalog, observation, draft.connection_id, "api_key")).toBe(catalog);
    const removed = withObservedModels(catalog, { ...observation, models: [] }, draft.connection_id, draft.mode);
    expect(selectionIssue(removed, draft)).toBe("model_missing");
    expect(validSelection(removed, draft)).toBeNull();
    expect(removed?.items[0].modes[0].configured_selection).toEqual(draft);
  });
  it("distinguishes an incomplete choice, a missing model and an unavailable reasoning level", () => {
    expect(selectionIssue(catalog, { ...draft, connection_id: "" })).toBe("selection_incomplete");
    expect(selectionIssue(catalog, { ...draft, connection_id: "missing" })).toBe("connection_missing");
    expect(selectionIssue(catalog, { ...draft, model_id: "missing" })).toBe("model_missing");
    const live = withObservedModels(catalog, observation, draft.connection_id, draft.mode);
    expect(selectionIssue(live, { ...draft, effort_id: "retired" })).toBe("effort_missing");
    expect(selectionIssue(live, { ...draft, mode: "api_key" })).toBe("mode_missing");
    expect(selectionIssue(catalog, { ...draft, effort_id: null })).toBeNull();
  });
});
