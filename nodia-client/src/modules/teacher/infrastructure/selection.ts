import type { z } from "zod";
import type { connectionModelsSchema, connectionsSchema, Selection } from "./schemas";

export type ConnectionCatalog = z.infer<typeof connectionsSchema>;
export type SelectionDraft = { connection_id: string; mode: Selection["mode"] | null; model_id: string; effort_id: string | null };

export const emptySelection: SelectionDraft = { connection_id: "", mode: null, model_id: "", effort_id: null };
export type ConnectionModelsObservation = z.infer<typeof connectionModelsSchema>;

/** Live metadata may refine configured identities, never activate or replace them. */
export function withObservedModels(catalog: ConnectionCatalog | undefined, observation: ConnectionModelsObservation | undefined,
  connectionId: string, mode: SelectionDraft["mode"]): ConnectionCatalog | undefined {
  if (!catalog || !observation || observation.connection_id !== connectionId || observation.mode !== mode) return catalog;
  const live = new Map(observation.models.map(model => [model.model_id, model]));
  return { ...catalog, items: catalog.items.map(connection => connection.connection_id !== connectionId ? connection : {
    ...connection, modes: connection.modes.map(item => item.mode !== mode ? item : {
      ...item, models: item.models.flatMap(model => { const observed = live.get(model.model_id); return observed ? [observed] : []; }),
    }),
  }) };
}

export function selectionIssue(catalog: ConnectionCatalog | undefined, draft: SelectionDraft) {
  if (!draft.connection_id) return "selection_incomplete";
  const connection = catalog?.items.find(item => item.connection_id === draft.connection_id);
  if (!connection) return "connection_missing";
  if (!draft.mode) return "selection_incomplete";
  const mode = connection.modes.find(item => item.mode === draft.mode);
  if (!mode) return "mode_missing";
  if (!connection.is_active || mode.configuration === "disabled") return "mode_disabled";
  if (!draft.model_id) return "selection_incomplete";
  const model = mode.models.find(item => item.model_id === draft.model_id);
  if (!model) return "model_missing";
  if (draft.effort_id !== null && !model.efforts.some(item => item.effort_id === draft.effort_id)) {
    return model.efforts.length ? "effort_missing" : "effort_unreported";
  }
  return mode.configuration !== "configured" ? "mode_incomplete" : null;
}
export function sameSelection(left: SelectionDraft | null | undefined, right: SelectionDraft | null | undefined) {
  return Boolean(left && right && left.connection_id === right.connection_id && left.mode === right.mode && left.model_id === right.model_id && left.effort_id === right.effort_id);
}

/** Only the persisted instance/mode preference may seed a selection; never the first discovered model. */
export function configuredSelection(connection: ConnectionCatalog["items"][number] | undefined, mode = connection?.default_mode): SelectionDraft {
  const modeConfig = connection?.modes.find(item => item.mode === mode);
  const saved = modeConfig?.configured_selection;
  if (saved && connection && saved.connection_id === connection.connection_id && saved.mode === modeConfig?.mode) return saved;
  return { ...emptySelection, connection_id: connection?.connection_id ?? "", mode: modeConfig?.mode ?? null };
}

export function defaultSelection(catalog: ConnectionCatalog | undefined): SelectionDraft | null {
  const defaults = catalog?.items.filter(item => item.is_default) ?? [];
  if (defaults.length !== 1) return null;
  return configuredSelection(defaults[0]);
}

export function validSelection(catalog: ConnectionCatalog | undefined, draft: SelectionDraft): Selection | null {
  const connection = catalog?.items.find(item => item.connection_id === draft.connection_id);
  const mode = connection?.modes.find(item => item.mode === draft.mode);
  const model = mode?.models.find(item => item.model_id === draft.model_id);
  if (!connection?.is_active || mode?.configuration !== "configured" || !model || !draft.mode
    || (draft.effort_id !== null && !model.efforts.some(item => item.effort_id === draft.effort_id))) return null;
  return { ...draft, mode: draft.mode };
}
