/** Presentation-only grouping of catalog variants. Executable IDs stay literal. */
type DisplayModel = { id: string; displayName?: string; name?: string };
export type ModelCardVariant<T> = { model: T; effort: string };
export type ModelCardPreferenceConflict = { modelId: string; effort: string; savedPreference: unknown };
export type ProviderModelCard<T> = {
  key: string;
  label: string;
  model: T;
  variants: ModelCardVariant<T>[];
  preferenceConflicts: ModelCardPreferenceConflict[];
};
type Selection = {
  selectedModel: string | null | undefined;
  ocrModel?: string | null;
  thinkingLevel?: unknown;
  thinkingLevels?: Record<string, unknown>;
};

/** Gemini's three configurable preferences; not evidence of inference support. */
const variantPreferences = new Set(["low", "medium", "high"]);

export function providerModelCards<T extends DisplayModel>(
  models: T[],
  groupGeminiVariants: boolean,
  selection: Selection,
): ProviderModelCard<T>[] {
  const label = (model: T) => model.displayName || model.name || model.id;
  const flat = (model: T): ProviderModelCard<T> => ({ key: model.id, label: label(model), model, variants: [], preferenceConflicts: [] });
  if (!groupGeminiVariants) return models.map(flat);
  const groups = new Map<string, { label: string; variants: ModelCardVariant<T>[] }>();
  for (const model of models) {
    const match = /^(\S(?:.*\S)?) \(([^()]+)\)$/.exec(label(model));
    if (!match) continue;
    const effort = match[2].toLowerCase();
    if (!variantPreferences.has(effort) || !model.id.endsWith(`-${effort}`)) continue;
    const baseId = model.id.slice(0, -effort.length - 1);
    if (!baseId) continue;
    const key = JSON.stringify([baseId, match[1]]);
    const group = groups.get(key) ?? { label: match[1], variants: [] };
    group.variants.push({ model, effort });
    groups.set(key, group);
  }
  const byId = new Map<string, ProviderModelCard<T>>();
  for (const [key, group] of groups) {
    if (group.variants.length < 2 || new Set(group.variants.map(item => item.effort)).size !== group.variants.length
      || models.some(item => label(item) === group.label)
      || [...groups.values()].some(other => other !== group && other.label === group.label)) continue;
    const references = group.variants.filter(item => item.model.id === selection.selectedModel || item.model.id === selection.ocrModel);
    // Group the catalog while exposing historical contradictions for explicit correction.
    const preferenceConflicts = references.flatMap(item => {
      const saved = selection.thinkingLevels && Object.hasOwn(selection.thinkingLevels, item.model.id)
        ? selection.thinkingLevels[item.model.id]
        : item.model.id === selection.selectedModel ? selection.thinkingLevel : undefined;
      return saved !== undefined && saved !== null && saved !== item.effort
        ? [{ modelId: item.model.id, effort: item.effort, savedPreference: saved }] : [];
    });
    const representative = group.variants.find(item => item.model.id === selection.selectedModel)
      ?? group.variants.find(item => item.model.id === selection.ocrModel) ?? group.variants[0];
    const card: ProviderModelCard<T> = { key, label: group.label, model: representative.model, variants: group.variants, preferenceConflicts };
    for (const variant of group.variants) byId.set(variant.model.id, card);
  }
  const emitted = new Set<ProviderModelCard<T>>();
  return models.flatMap(model => {
    const card = byId.get(model.id);
    if (!card) return [flat(model)];
    if (emitted.has(card)) return [];
    emitted.add(card);
    return [card];
  });
}

export function modelCardContains<T extends DisplayModel>(card: ProviderModelCard<T>, id: string | null | undefined) {
  return card.model.id === id || card.variants.some(item => item.model.id === id);
}

/** A human effort choice resolves only to an ID already present in this card. */
export function modelCardEffort<T>(card: ProviderModelCard<T>, effort: string) {
  return card.variants.find(item => item.effort === effort);
}

/** Supported API protocol preferences, not per-model capability or inference evidence. */
export const openAiApiReasoningPreferences = ["low", "medium", "high", "xhigh", "max"] as const;
