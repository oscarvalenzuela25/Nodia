import type { NodiaAiConnectionConfiguration } from '../nodia-ai-connections.service.js';
import type { NodiaAiSelection } from '../types/nodia-ai-persistence.types.js';

export function configurationRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function identifier(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, 'utf8') <= maximum
  );
}

/** Saved preferences are configuration, never proof of provider availability. */
export function configuredNodiaAiSelection(
  row: NodiaAiConnectionConfiguration,
  mode: NodiaAiSelection['mode'],
): NodiaAiSelection | null {
  const fields = configurationRecord(configurationRecord(row.fields)[mode]);
  if (!identifier(fields.selected_model, 1024)) return null;
  const model = fields.selected_model;
  const levels = configurationRecord(fields.thinking_levels);
  const effort = Object.hasOwn(levels, model)
    ? levels[model]
    : (fields.thinking_level ?? null);
  if (effort !== null && !identifier(effort, 256)) return null;
  return { connection_id: row.id, mode, model_id: model, effort_id: effort };
}

/** No first-connection, alternate-mode, root-fields or model fallback. */
export function defaultNodiaAiSelection(
  row: NodiaAiConnectionConfiguration | null,
): NodiaAiSelection | null {
  if (!row?.is_default || !row.is_active || !row.catalog_active) return null;
  const mode = row.default_mode;
  if (mode !== 'agentic' && mode !== 'api_key') return null;
  if (row[`use_${mode}`] !== true || row[`can_use_${mode}`] !== true)
    return null;
  return configuredNodiaAiSelection(row, mode);
}
