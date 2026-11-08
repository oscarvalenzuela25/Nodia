import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

const candidates = [
  'nodia_invoices_ocr',
  'nodia_businesses_list',
  'nodia_providers_list',
  'nodia_providers_get',
] as const;
const kinds = new Set([
  'read', 'prepare_change', 'read_artifact', 'analyze_attachment',
  'prepare_secure_flow', 'prepare_workflow', 'prepare_preference_change',
]);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const shape = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const key = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,127}$/.test(value);
const collection = (value: unknown): value is unknown[] => Array.isArray(value) && value.length <= 128;
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

/** Shape of the already reauthorized Snapshot.loadReferences projection, never a new authority check. */
function recoveryReferences(value: unknown): boolean | undefined {
  if (value === undefined) return false;
  if (!object(value) || !shape(value, ['schema_version', 'references', 'more']) || value.schema_version !== 1 ||
    typeof value.more !== 'boolean' || !Array.isArray(value.references) || value.references.length > 50) return undefined;
  const ids = new Set<string>();
  let relevant = false;
  for (const reference of value.references) {
    if (!object(reference) || !shape(reference, ['analysis_id', 'business_id', 'attachment_id', 'source_message_seq', 'provider_id', 'state_hint']) ||
      !uuid(reference.analysis_id) || !uuid(reference.business_id) || !uuid(reference.attachment_id) || ids.has(reference.analysis_id) ||
      typeof reference.source_message_seq !== 'string' || !/^[1-9][0-9]{0,18}$/.test(reference.source_message_seq) || BigInt(reference.source_message_seq) > 9223372036854775807n ||
      (reference.provider_id !== null && (typeof reference.provider_id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(reference.provider_id))) ||
      typeof reference.state_hint !== 'string' || !['awaiting_supplier', 'requested', 'stored_result', 'unknown', 'failed', 'cancelled'].includes(reference.state_hint)) return undefined;
    ids.add(reference.analysis_id);
    relevant ||= reference.state_hint === 'awaiting_supplier' || reference.state_hint === 'stored_result';
  }
  return Buffer.byteLength(JSON.stringify(value), 'utf8') <= 16384 ? relevant : undefined;
}

/** Optional planning metadata only. The caller supplies the current reauthorized discovery index. */
export function invoiceOcrDiscoveryHint(input: {
  readonly phase: unknown;
  readonly hasInvoiceOcrReferences: boolean;
  readonly capabilityIndex: unknown;
  readonly recoveryInvoiceOcrReferences?: unknown;
}): NodiaAiJsonObject | undefined {
  const index = input.capabilityIndex;
  if (input.phase !== 'discovery') return undefined;
  const recovery = recoveryReferences(input.recoveryInvoiceOcrReferences);
  if (recovery === undefined || (input.hasInvoiceOcrReferences !== true && !recovery) || !object(index) ||
    !shape(index, ['schema_version', 'catalog_version', 'catalog_hash', 'selection_required', 'modules']) ||
    index.schema_version !== 1 || index.selection_required !== true ||
    typeof index.catalog_version !== 'string' || !index.catalog_version.trim() || [...index.catalog_version].length > 128 ||
    typeof index.catalog_hash !== 'string' || !/^[a-f0-9]{64}$/.test(index.catalog_hash) || !collection(index.modules))
    return undefined;

  const modules = new Set<string>(), ids = new Set<string>(), tools = new Set<string>();
  for (const module of index.modules) {
    if (!object(module) || !shape(module, ['module_key', 'resources']) || !key(module.module_key) ||
      modules.has(module.module_key) || !collection(module.resources)) return undefined;
    modules.add(module.module_key);
    const resources = new Set<string>();
    for (const resource of module.resources) {
      if (!object(resource) || !shape(resource, ['resource_key', 'capabilities']) || !key(resource.resource_key) ||
        resources.has(resource.resource_key) || !collection(resource.capabilities)) return undefined;
      resources.add(resource.resource_key);
      for (const capability of resource.capabilities) {
        if (!object(capability) || !shape(capability, ['capability_id', 'tool_name', 'kind', 'description']) ||
          typeof capability.capability_id !== 'string' || !/^[a-z][a-z0-9_]{0,127}$/.test(capability.capability_id) ||
          typeof capability.tool_name !== 'string' || !/^nodia_[a-z0-9_]{1,120}$/.test(capability.tool_name) ||
          typeof capability.kind !== 'string' || !kinds.has(capability.kind) ||
          typeof capability.description !== 'string' || !capability.description.trim() || Buffer.byteLength(capability.description, 'utf8') > 4096 ||
          ids.has(capability.capability_id) || tools.has(capability.tool_name)) return undefined;
        ids.add(capability.capability_id); tools.add(capability.tool_name);
      }
    }
  }
  if (!candidates.every(id => ids.has(id))) return undefined;
  return {
    schema_version: 1,
    purpose: 'invoice_ocr_discovery_metadata_only',
    selection_tool: 'nodia_capabilities_select',
    catalog_version: index.catalog_version,
    catalog_hash: index.catalog_hash,
    candidate_capability_ids: [...candidates],
    grants_execution: false,
  };
}
