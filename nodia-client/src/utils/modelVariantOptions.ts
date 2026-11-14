export type CatalogModelEffort = { effort_id: string; label: string };
export type CatalogVariantModel = { model_id: string; label: string; efforts: CatalogModelEffort[] };
type ModelSelection = { model_id: string; effort_id: string | null };
type ModelVariant<T> = { model: T; effort: string };
export type CatalogModelOption<T> = { value: string; label: string; variants: ModelVariant<T>[]; model: T };

/** Present explicit catalog variants together without creating an executable family ID. */
export function catalogModelOptions<T extends CatalogVariantModel>(
  models: T[], groupVariants: boolean, current: ModelSelection,
): CatalogModelOption<T>[] {
  const flat = (model: T): CatalogModelOption<T> => ({ value: model.model_id, label: model.label, variants: [], model });
  if (!groupVariants) return models.map(flat);
  const groups = new Map<string, { label: string; variants: ModelVariant<T>[] }>();
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
  const byId = new Map<string, CatalogModelOption<T>>();
  for (const group of groups.values()) {
    if (group.variants.length < 2 || new Set(group.variants.map(item => item.effort)).size !== group.variants.length
      || models.some(item => item.label === group.label)
      || [...groups.values()].some(other => other !== group && other.label === group.label)) continue;
    // A contradictory historical tuple stays literal until the person edits it.
    const selected = group.variants.find(item => item.model.model_id === current.model_id);
    if (selected && current.effort_id !== null && current.effort_id !== selected.effort) continue;
    const first = group.variants[0].model;
    const option: CatalogModelOption<T> = { value: first.model_id, label: group.label, model: first, variants: group.variants };
    for (const variant of group.variants) byId.set(variant.model.model_id, option);
  }
  const seen = new Set<CatalogModelOption<T>>();
  return models.flatMap(model => {
    const option = byId.get(model.model_id);
    if (!option) return [flat(model)];
    if (seen.has(option)) return [];
    seen.add(option);
    return [option];
  });
}

export function modelOptionFor<T extends CatalogVariantModel>(options: CatalogModelOption<T>[], modelId: string) {
  return options.find(item => item.value === modelId || item.variants.some(variant => variant.model.model_id === modelId));
}

export function modelOptionEfforts<T extends CatalogVariantModel>(option: CatalogModelOption<T> | undefined) {
  return option?.variants.length
    ? option.variants.map(item => item.model.efforts.find(effort => effort.effort_id === item.effort)!)
    : option?.model.efforts ?? [];
}

export function modelOptionComplete<T extends CatalogVariantModel>(option: CatalogModelOption<T> | undefined, draft: ModelSelection) {
  return !option?.variants.length || option.variants.some(item => item.model.model_id === draft.model_id && item.effort === draft.effort_id);
}

/** Only an explicit effort choice may switch to another reported executable variant. */
export function chooseModelEffort<T extends CatalogVariantModel, D extends ModelSelection>(
  option: CatalogModelOption<T> | undefined, draft: D, effort: string | null,
): D {
  if (!option?.variants.length || effort === null) return { ...draft, effort_id: effort };
  const variant = option.variants.find(item => item.effort === effort);
  return variant ? { ...draft, model_id: variant.model.model_id, effort_id: effort } : draft;
}
