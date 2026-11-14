import type { DiscoveredModelItem } from "./types";
import { modelCardContains, type ProviderModelCard } from "./modelCards";

export type SyncModelCard = ProviderModelCard<DiscoveredModelItem>;

/** A malformed discovery must not become an empty or partially guessed catalog. */
export function validDiscoveredModels(value: unknown): value is DiscoveredModelItem[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((item: unknown) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const model = item as Record<string, unknown>;
    if (typeof model.id !== "string" || !model.id.trim() || ids.has(model.id)
      || typeof model.name !== "string" || !model.name.trim()) return false;
    ids.add(model.id);
    return ["displayName", "description"].every(key => model[key] === undefined || typeof model[key] === "string")
      && (model.supportedReasoningEfforts === undefined || Array.isArray(model.supportedReasoningEfforts)
        && model.supportedReasoningEfforts.length <= 32
        && model.supportedReasoningEfforts.every(effort => typeof effort === "string" && /^[a-z][a-z0-9_-]{0,31}$/.test(effort)))
      && (model.capabilities === undefined || Array.isArray(model.capabilities) && model.capabilities.every(cap => typeof cap === "string"))
      && (model.contextWindow === undefined || model.contextWindow === null || typeof model.contextWindow === "number" && Number.isFinite(model.contextWindow))
      && (model.isRecommended === undefined || typeof model.isRecommended === "boolean")
      && (model.role === undefined || ["chat", "multimodal", "ocr"].includes(String(model.role)));
  });
}

export function syncCardIds(card: SyncModelCard): string[] {
  return card.variants.length ? card.variants.map(item => item.model.id) : [card.model.id];
}

export function syncCardSelected(card: SyncModelCard, selected: ReadonlySet<string>) {
  return syncCardIds(card).some(id => selected.has(id));
}

/** Activation belongs to a family; each executable variant remains in the catalog. */
export function selectSyncCards(cards: SyncModelCard[], selected: ReadonlySet<string>, enabled: boolean) {
  const next = new Set(selected);
  for (const card of cards) for (const id of syncCardIds(card)) {
    if (enabled) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function syncRoleOptions(cards: SyncModelCard[], selected: ReadonlySet<string>, roleId: string) {
  return cards.filter(card => syncCardSelected(card, selected)).map(card => ({
    value: modelCardContains(card, roleId) ? roleId : card.model.id,
    label: card.label,
    description: card.model.description,
  }));
}

/** Patch only the edited mode. The server merges omitted configuration atomically. */
export function syncModelsFieldsPatch({ fields, mode, defaultMode, models, mainId, ocrId, effortChanges }: {
  fields: Record<string, unknown>;
  mode: "agentic" | "api_key";
  defaultMode?: string | null;
  models: DiscoveredModelItem[];
  mainId: string;
  ocrId: string;
  effortChanges: Record<string, string>;
}) {
  const scoped = fields[mode];
  const previous = typeof scoped === "object" && scoped !== null && !Array.isArray(scoped)
    ? scoped as Record<string, unknown> : fields.agentic || fields.api_key ? {} : fields;
  const savedLevels = previous.thinking_levels;
  const changes: Record<string, unknown> = { ...effortChanges };
  if (Object.hasOwn(effortChanges, mainId) && ocrId && ocrId !== mainId
    && !Object.hasOwn(changes, ocrId)
    && !(typeof savedLevels === "object" && savedLevels !== null && Object.hasOwn(savedLevels, ocrId))) {
    // OCR may inherit the old general preference. Preserve its effective tuple
    // before the principal's new preference changes that general fallback.
    changes[ocrId] = previous.thinking_level ?? null;
  }
  const data: Record<string, unknown> = {
    available_models: models,
    selected_model: mainId,
    // undefined disappears from JSON and cannot clear the previous OCR selection.
    ocr_model: ocrId || null,
    ocr_focus_model: ocrId || null,
  };
  // With no declared default mode the server cannot scope legacy root fields.
  // Preserve that first explicit mode's existing preferences during conversion.
  const legacyWithoutMode = !fields.agentic && !fields.api_key && !defaultMode;
  if (legacyWithoutMode) {
    for (const key of ["thinking_level", "thinking_levels", "enable_extended_thinking"]) {
      if (Object.hasOwn(previous, key)) data[key] = previous[key];
    }
  }
  if (Object.keys(changes).length) data.thinking_levels = legacyWithoutMode
    ? { ...(typeof savedLevels === "object" && savedLevels !== null && !Array.isArray(savedLevels) ? savedLevels : {}), ...changes }
    : changes;
  if (Object.hasOwn(effortChanges, mainId)) data.thinking_level = effortChanges[mainId];
  const patch: Record<string, unknown> = { [mode]: data };
  if (!defaultMode || defaultMode === mode) {
    // Root maps have no server-side merge contract. Keep effort edits solely in
    // the authoritative mode map rather than overwriting another session's map.
    for (const key of ["available_models", "selected_model", "ocr_model", "ocr_focus_model", "thinking_level"]) {
      if (Object.hasOwn(data, key)) patch[key] = data[key];
    }
  }
  return patch;
}
