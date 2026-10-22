import type { NodiaAiAdapterTool } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiRegisteredTool } from './tool-registry.types.js';

export interface NodiaAiToolSelectionProfile {
  readonly profile_id: string;
  readonly revision: number;
  readonly capability_ids: readonly string[];
  /** These capabilities are essential to this profile; never silently degrade it. */
  readonly required_capability_ids: readonly string[];
}

export interface NodiaAiToolSelectionProfiles {
  readonly schema_version: 1;
  readonly default_profile_id: string;
  readonly technical_tool_names: readonly string[];
  readonly profiles: readonly NodiaAiToolSelectionProfile[];
}

export interface NodiaAiFrozenToolSelectionProfile {
  readonly schema_version: 1;
  readonly profile_id: string;
  readonly revision: number;
  readonly sha256: string;
}

export interface NodiaAiTechnicalToolSelection {
  readonly descriptor: NodiaAiAdapterTool;
  readonly contractHash: string;
}

export interface NodiaAiSelectTurnToolsInput {
  readonly profileId?: string;
  /** Rehydration must use the exact trusted profile admitted earlier. */
  readonly expectedProfile?: NodiaAiFrozenToolSelectionProfile;
  /** Complete registered catalog, before the current actor's authority filter. */
  readonly registeredTools: readonly NodiaAiRegisteredTool[];
  readonly publishedCapabilityIds: readonly string[];
  /** Computed by the existing policy/discovery use case, never supplied by the model. */
  readonly authorizedToolNames: readonly string[];
  readonly technicalTools: readonly NodiaAiTechnicalToolSelection[];
}

export interface NodiaAiSelectedTurnTools {
  readonly profile: NodiaAiFrozenToolSelectionProfile;
  readonly capabilityIds: readonly string[];
  readonly toolContracts: Readonly<Record<string, string>>;
  readonly descriptors: readonly NodiaAiAdapterTool[];
  readonly catalogUtf8Bytes: number;
}

export interface NodiaAiToolSelectionState {
  schema_version: 1;
  phase: 'discovery' | 'selection_requested' | 'ack_pending' | 'execution';
  catalog_hash: string;
  request?: {
    attempt_id: string;
    tool_call_id: string;
    capability_ids: string[];
    profile: NodiaAiFrozenToolSelectionProfile;
    tool_contracts: Record<string, string>;
  };
}

/** Private persistence is validated as rigorously as wire data before granting a continuation. */
export function nodiaAiToolSelectionState(
  value: unknown,
): NodiaAiToolSelectionState | undefined {
  const plain = (item: unknown): item is Record<string, unknown> =>
    !!item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(item));
  const exact = (item: Record<string, unknown>, keys: string[]) =>
    Object.keys(item).sort().join(',') === keys.sort().join(',');
  const hash = (item: unknown) =>
    typeof item === 'string' && /^[a-f0-9]{64}$/.test(item);
  const protocol = (item: unknown) =>
    typeof item === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      item,
    );
  const key = (item: unknown) =>
    typeof item === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(item);
  if (
    !plain(value) ||
    value.schema_version !== 1 ||
    !hash(value.catalog_hash) ||
    !['discovery', 'selection_requested', 'ack_pending', 'execution'].includes(
      String(value.phase),
    ) ||
    !exact(value, [
      'schema_version',
      'phase',
      'catalog_hash',
      ...(value.request === undefined ? [] : ['request']),
    ])
  )
    return undefined;
  if (value.request === undefined)
    return value.phase === 'discovery' || value.phase === 'execution'
      ? (value as unknown as NodiaAiToolSelectionState)
      : undefined;
  const request = value.request;
  if (
    value.phase === 'discovery' ||
    !plain(request) ||
    !exact(request, [
      'attempt_id',
      'tool_call_id',
      'capability_ids',
      'profile',
      'tool_contracts',
    ]) ||
    !protocol(request.attempt_id) ||
    !protocol(request.tool_call_id) ||
    !Array.isArray(request.capability_ids) ||
    request.capability_ids.length < 1 ||
    request.capability_ids.length > 67 ||
    !request.capability_ids.every(key) ||
    new Set(request.capability_ids).size !== request.capability_ids.length ||
    !plain(request.profile) ||
    !exact(request.profile, [
      'schema_version',
      'profile_id',
      'revision',
      'sha256',
    ]) ||
    request.profile.schema_version !== 1 ||
    request.profile.profile_id !== 'selected_capabilities' ||
    request.profile.revision !== 1 ||
    !hash(request.profile.sha256) ||
    !plain(request.tool_contracts)
  )
    return undefined;
  const contracts = request.tool_contracts;
  if (
    Object.keys(contracts).length !== request.capability_ids.length + 7 ||
    Object.keys(contracts).length > 74 ||
    !Object.keys(contracts).every(key) ||
    !Object.values(contracts).every(hash)
  )
    return undefined;
  return value as unknown as NodiaAiToolSelectionState;
}
