import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { canonicalModuleRoute, contractModuleRoute } from '../../authorization/canonical-module-route.js';
import type { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import type { NodiaAiRegisteredTool } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type {
  NodiaAiResultNavigation,
  NodiaAiToolObservation,
} from '../types/nodia-ai-tool-observation.types.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function object(value: unknown): NodiaAiJsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as NodiaAiJsonObject)
    : null;
}
function propertyId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
/** Only explicit native fields and supported app destinations are projected; never model URLs. */
export function projectNodiaAiToolObservation(
  call: NodiaAiToolCall,
  tool: NodiaAiRegisteredTool,
  input: NodiaAiJsonObject,
  result: NodiaAiJsonObject,
  moduleRoute: string,
): NodiaAiToolObservation {
  const destination = canonicalModuleRoute(moduleRoute);
  const meta = object(result.meta);
  const total = meta?.total_items;
  const data = result.data;
  const candidates = result.candidates;
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(candidates)
      ? candidates
      : null;
  const navigation: NodiaAiResultNavigation[] = [];
  const seen = new Set<string>();
  const add = (
    kind: NodiaAiResultNavigation['kind'],
    id: string,
    label: unknown,
  ) => {
    if (navigation.length >= 25 || seen.has(`${kind}:${id}`)) return;
    seen.add(`${kind}:${id}`);
    navigation.push({
      kind,
      id,
      module_route: contractModuleRoute(destination),
      label:
        typeof label === 'string' && label.length >= 1 && label.length <= 256
          ? label
          : null,
    });
  };
  if (
    destination === '/business' &&
    ['nodia_businesses_get', 'nodia_businesses_list'].includes(tool.toolName)
  ) {
    for (const row of rows ?? [data]) {
      const item = object(row);
      if (typeof item?.id === 'string' && uuid.test(item.id))
        add('business_detail', item.id, item.name);
    }
  }
  if (destination === '/reservations') {
    if (
      ['nodia_rental_properties_get', 'nodia_rental_properties_list'].includes(
        tool.toolName,
      )
    ) {
      for (const row of rows ?? [result]) {
        const item = object(row);
        if (propertyId(item?.id)) add('rental_property', item.id, item.name);
      }
    } else if (propertyId(input.property_id)) {
      // verifyAuthority has already checked this exact native property, even for empty results.
      add('rental_property', input.property_id, null);
    }
  }
  if (navigation.length === 0)
    navigation.push({
      kind: 'module',
      id: null,
      module_route: contractModuleRoute(destination),
      label: null,
    });
  return {
    result_ref: {
      tool_call_id: call.id,
      tool_name: tool.toolName,
      contract_hash: tool.contractHash,
    },
    observed_at: call.completed_at!.toISOString(),
    source: {
      module_key: tool.moduleKey,
      resource_key: tool.resourceKey,
      operation_key: tool.operationKey,
      description_key: tool.descriptionKey,
    },
    summary: {
      total:
        typeof total === 'number' && Number.isSafeInteger(total) && total >= 0
          ? total
          : typeof total === 'string' && /^(0|[1-9][0-9]{0,127})$/.test(total)
            ? total
            : null,
      returned: rows?.length ?? null,
    },
    navigation,
  };
}
