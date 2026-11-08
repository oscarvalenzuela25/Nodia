import { NodiaAiSelectionDto } from '../dto/nodia-ai-selection.dto.js';
import { NodiaAiRoutingSnapshotDto } from '../dto/nodia-ai-routing.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';

type HistoricalSelection = {
  connection_id: string;
  mode: 'agentic' | 'api_key' | 'retired';
  model_id: string;
  effort_id: string | null;
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_historical_snapshot');
  return value as Record<string, unknown>;
};

/** Read projection only. Never use this function for admission, dispatch, replay or persistence. */
export function projectHistoricalAiSnapshots(
  selectionValue: unknown,
  routingValue: unknown,
) {
  const source = object(selectionValue);
  const originalMode = source.mode;
  const mode =
    originalMode === 'token_plan_agentic'
      ? 'agentic'
      : originalMode === 'token_plan_web'
        ? 'retired'
        : originalMode;
  if (!['agentic', 'api_key', 'retired'].includes(String(mode)))
    throw new Error('invalid_historical_mode');
  if (mode === 'retired' && originalMode !== 'token_plan_web')
    throw new Error('invalid_historical_mode');
  // Reuse the strict identity/model/effort validator without widening its writable mode enum.
  const checked = validateNodiaAiDto(NodiaAiSelectionDto, {
    ...source,
    mode: mode === 'retired' ? 'agentic' : mode,
  });
  if (checked.effort_id === undefined)
    throw new Error('invalid_historical_effort');
  const selection: HistoricalSelection = {
    ...checked,
    mode: mode as HistoricalSelection['mode'],
    effort_id: checked.effort_id,
  };
  const originalRouting = object(routingValue);
  let target: unknown = originalRouting.target;
  if (target !== null) {
    const record = object(target),
      targetSelection = object(record.selection);
    const targetMode =
      targetSelection.mode === 'token_plan_agentic'
        ? 'agentic'
        : targetSelection.mode;
    if (targetMode !== 'agentic') throw new Error('invalid_historical_target');
    target = { ...record, selection: { ...targetSelection, mode: 'agentic' } };
  }
  const routing = validateNodiaAiDto(NodiaAiRoutingSnapshotDto, {
    ...originalRouting,
    target,
  });
  if (routing.enabled && (!routing.target || originalMode !== 'token_plan_web'))
    throw new Error('invalid_historical_routing');
  if (
    routing.target &&
    (routing.target.selection.connection_id !== checked.connection_id ||
      routing.target.selection.mode !== 'agentic' ||
      routing.target.selection.effort_id === undefined)
  )
    throw new Error('invalid_historical_target');
  return { selection, routing };
}
