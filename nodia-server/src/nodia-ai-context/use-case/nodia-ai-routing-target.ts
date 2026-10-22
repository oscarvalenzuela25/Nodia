import type { EntityManager } from 'typeorm';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
/** The automatic target comes from that connection's own Agentic configuration, never Web or first model. */
export async function verifyConfiguredRoutingTarget(
  manager: EntityManager,
  selection: NodiaAiSelection,
): Promise<void> {
  const rows: { configuration: unknown }[] = await manager.query(
    "SELECT fields->'token_plan_agentic' AS configuration FROM ai_providers WHERE id=$1 FOR SHARE",
    [selection.connection_id],
  );
  const value = rows[0]?.configuration;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('nodia_ai:invalid_selection');
  const fields = value as Record<string, unknown>,
    model = fields.selected_model;
  const raw = fields.thinking_levels;
  const levels =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const effort =
    typeof model === 'string' && Object.hasOwn(levels, model)
      ? levels[model]
      : (fields.thinking_level ?? null);
  if (
    model !== selection.model_id ||
    effort !== selection.effort_id ||
    selection.mode !== 'token_plan_agentic'
  )
    throw new Error('nodia_ai:invalid_selection');
}
