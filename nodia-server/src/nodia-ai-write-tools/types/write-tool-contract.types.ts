import { readFileSync } from 'node:fs';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';

export interface WriteToolContract {
  readonly tool_name: string;
  readonly input_definition: string;
  readonly resource_key: string;
  readonly description: string;
  /** Secure channels remain human-owned; this selects preparation only. */
  readonly kind?: 'prepare_secure_flow';
  /** Only these explicitly registered native data fields use the closed tagged JSON wire format. */
  readonly json_fields?: readonly string[];
}
export interface WriteContractBundle {
  readonly schema: NodiaAiJsonObject;
  readonly tools: readonly WriteToolContract[];
}
export function loadNodiaAiWriteContracts(): readonly WriteContractBundle[] {
  return loadContracts([
    'write-finance-business',
    'write-reservations',
    'write-core-provider',
  ]);
}
export function loadNodiaAiSecureContracts(): readonly WriteContractBundle[] {
  return loadContracts(['secure-flows']);
}
function loadContracts(
  names: readonly string[],
): readonly WriteContractBundle[] {
  return names.map((name) => {
    const value = parseNodiaAiStrictJson(
      readFileSync(
        new URL(
          `../../nodia-ai-products/contracts/${name}.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !('schema' in value) ||
      !value.schema ||
      typeof value.schema !== 'object' ||
      Array.isArray(value.schema) ||
      !('tools' in value) ||
      !Array.isArray(value.tools) ||
      Object.keys(value).some((key) => !['schema', 'tools'].includes(key))
    )
      throw Error('nodia_ai:write_contract_invalid');
    const tools: WriteToolContract[] = value.tools.map((tool) => {
      if (
        !tool ||
        typeof tool !== 'object' ||
        Array.isArray(tool) ||
        typeof tool.tool_name !== 'string' ||
        !/^nodia_[a-z0-9_]+_prepare_[a-z0-9_]+$/.test(tool.tool_name) ||
        typeof tool.input_definition !== 'string' ||
        !/^[A-Za-z][A-Za-z0-9_]*$/.test(tool.input_definition) ||
        typeof tool.resource_key !== 'string' ||
        !/^[a-z][a-z0-9_]*$/.test(tool.resource_key) ||
        typeof tool.description !== 'string' ||
        !tool.description.trim() ||
        Object.keys(tool).some(
          (key) =>
            ![
              'tool_name',
              'input_definition',
              'resource_key',
              'description',
              'kind',
              'json_fields',
            ].includes(key),
        ) ||
        (tool.kind !== undefined && tool.kind !== 'prepare_secure_flow') ||
        (tool.json_fields !== undefined &&
          (!Array.isArray(tool.json_fields) ||
            tool.json_fields.some(
              (field: unknown) => typeof field !== 'string',
            ) ||
            new Set(tool.json_fields).size !== tool.json_fields.length))
      )
        throw Error('nodia_ai:write_contract_invalid');
      return {
        tool_name: tool.tool_name,
        input_definition: tool.input_definition,
        resource_key: tool.resource_key,
        description: tool.description,
        ...(tool.kind ? { kind: tool.kind as 'prepare_secure_flow' } : {}),
        ...(tool.json_fields
          ? { json_fields: tool.json_fields as string[] }
          : {}),
      };
    });
    return { schema: value.schema as NodiaAiJsonObject, tools };
  });
}
