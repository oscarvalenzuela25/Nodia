import type { ConnectionCatalog, SelectionDraft } from "./selection";

type Model = ConnectionCatalog["items"][number]["modes"][number]["models"][number];
type Variant = { model: Model; effort: string };
export type ModelOption = { value: string; label: string; variants: Variant[]; model: Model };

/** Organize reported labels, never create an executable family ID or infer provider support. */
export function teacherModelOptions(models: Model[], groupVariants: boolean, current: SelectionDraft): ModelOption[] {
  const flat = (model: Model): ModelOption => ({ value: model.model_id, label: model.label, variants: [], model });
  if (!groupVariants) return models.map(flat);
  const groups = new Map<string, { label: string; variants: Variant[] }>();
  for (const model of models) {
    const label = /^(\S(?:.*\S)?) \(([^()]+)\)$/.exec(model.label);
    if (!label) continue;
    const matches = model.efforts.filter(item => item.effort_id.toLowerCase() === label[2].toLowerCase());
    const effort = matches.length === 1 ? matches[0] : undefined;
    if (!effort || !model.model_id.endsWith(`-${effort.effort_id}`)) continue;
    const baseId = model.model_id.slice(0, -effort.effort_id.length - 1);
    if (!baseId) continue;
    const key = JSON.stringify([baseId, label[1]]);
    const group = groups.get(key) ?? { label: label[1], variants: [] };
    group.variants.push({ model, effort: effort.effort_id });
    groups.set(key, group);
  }
  const byId = new Map<string, ModelOption>();
  for (const group of groups.values()) {
    if (group.variants.length < 2 || new Set(group.variants.map(item => item.effort)).size !== group.variants.length
      || models.some(item => item.label === group.label)
      || [...groups.values()].some(other => other !== group && other.label === group.label)) continue;
    // A historical cross-variant preference remains literal and visible; never repair it on read.
    const selected = group.variants.find(item => item.model.model_id === current.model_id);
    if (selected && current.effort_id !== null && current.effort_id !== selected.effort) continue;
    const first = group.variants[0].model;
    const option: ModelOption = { value: first.model_id, label: group.label, model: first, variants: group.variants };
    for (const variant of group.variants) byId.set(variant.model.model_id, option);
  }
  const seen = new Set<ModelOption>();
  return models.flatMap(model => {
    const option = byId.get(model.model_id);
    if (!option) return [flat(model)];
    if (seen.has(option)) return [];
    seen.add(option);
    return [option];
  });
}

export function modelOptionFor(options: ModelOption[], modelId: string) {
  return options.find(item => item.value === modelId || item.variants.some(variant => variant.model.model_id === modelId));
}

export function modelOptionEfforts(option: ModelOption | undefined) {
  return option?.variants.length
    ? option.variants.map(item => item.model.efforts.find(effort => effort.effort_id === item.effort)!)
    : option?.model.efforts ?? [];
}

export function modelOptionComplete(option: ModelOption | undefined, draft: SelectionDraft) {
  return !option?.variants.length || option.variants.some(item => item.model.model_id === draft.model_id && item.effort === draft.effort_id);
}

/** Only an explicit effort choice changes variant; all returned IDs came from this catalog. */
export function chooseModelEffort(option: ModelOption | undefined, draft: SelectionDraft, effort: string | null): SelectionDraft {
  if (!option?.variants.length || effort === null) return { ...draft, effort_id: effort };
  const variant = option.variants.find(item => item.effort === effort);
  return variant ? { ...draft, model_id: variant.model.model_id, effort_id: effort } : draft;
}
