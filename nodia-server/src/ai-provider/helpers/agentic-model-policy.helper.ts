const allowedIdsKey = 'allowed_model_ids';
const legacyModelAliases = ['model', 'chat_model', 'default_model'] as const;
const modelRoles = ['selected_model', 'ocr_model', 'ocr_focus_model'] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function parseAgenticAllowedModelIds(value: unknown): Set<string> | null {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const ids = new Set<string>();
  for (const id of value) {
    if (typeof id !== 'string' || id === '' || id.trim() !== id || /[\p{Cc}\p{Cs}]/u.test(id)
      || Buffer.byteLength(id, 'utf8') > 1024 || ids.has(id))
      return null;
    ids.add(id);
  }
  return ids;
}

export function allowedAgenticModelIds(modeFields: unknown): ReadonlySet<string> | null {
  const fields = record(modeFields);
  if (!Object.hasOwn(fields, allowedIdsKey)) return null;
  // An invalid stored restriction must not reopen the provider's entire catalog.
  return parseAgenticAllowedModelIds(fields[allowedIdsKey]) ?? new Set<string>();
}

export function filterAgenticModels<T extends { id: string }>(
  modeFields: unknown,
  models: T[],
): T[] {
  const allowed = allowedAgenticModelIds(modeFields);
  return allowed ? models.filter(model => allowed.has(model.id)) : models;
}

export function isAgenticModelAllowed(modeFields: unknown, id: string): boolean {
  return allowedAgenticModelIds(modeFields)?.has(id) ?? true;
}

export function restrictAgenticModelFields(
  fields: Record<string, unknown>,
  allowed = allowedAgenticModelIds(fields),
): Record<string, unknown> {
  if (!allowed) return fields;
  const result = { ...fields };
  const isAllowed = (id: unknown) => typeof id === 'string' && allowed.has(id);
  if (Object.hasOwn(fields, 'available_models')) {
    result.available_models = Array.isArray(fields.available_models)
      ? fields.available_models.filter(model => isAllowed(record(model).id))
      : [];
  }
  if (!isAllowed(fields.selected_model)) {
    delete result.thinking_level;
    delete result.enable_extended_thinking;
  }
  for (const key of legacyModelAliases) delete result[key];
  for (const key of modelRoles) {
    if (fields[key] != null && !isAllowed(fields[key])) delete result[key];
  }
  if (Object.hasOwn(fields, 'thinking_levels'))
    result.thinking_levels = Object.fromEntries(
      Object.entries(record(fields.thinking_levels)).filter(([id]) => allowed.has(id)),
    );
  return result;
}

/** Discovery refreshes the metadata of models already activated on a curated connection. */
export function refreshAgenticModelMetadata<T extends { id: string }>(
  modeFields: unknown,
  models: readonly T[],
): readonly unknown[] {
  const allowed = allowedAgenticModelIds(modeFields);
  if (!allowed) return models;
  const saved = record(modeFields).available_models;
  if (!Array.isArray(saved)) return [];
  const discovered = new Map(models.map(model => [model.id, model]));
  return saved.flatMap((model: unknown) => {
    const { id } = record(model);
    if (typeof id !== 'string' || !allowed.has(id)) return [];
    return [discovered.get(id) ?? model];
  });
}
