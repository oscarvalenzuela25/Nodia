import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseNodiaAiStrictJson } from '../nodia-ai-context/strict-json.js';
import type { NodiaAiToolSchemaReference } from '../nodia-ai-tools/types/tool-registry.types.js';
import { nodiaAiTeacherOperationIdentity } from './teacher-operation-identity.js';

interface TeacherToolContract {
  readonly toolName: string;
  readonly resourceKey: string;
  readonly operationKey: string;
  readonly kind: 'read' | 'prepare_change';
  readonly description: string;
  readonly inputSchema: string;
  readonly outputSchema: string;
}

function invalid(): never {
  throw new Error('nodia_ai:invalid_teacher_contract');
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function contract(value: unknown): TeacherToolContract {
  if (
    !object(value) ||
    typeof value.toolName !== 'string' ||
    typeof value.resourceKey !== 'string' ||
    typeof value.operationKey !== 'string' ||
    (value.kind !== 'read' && value.kind !== 'prepare_change') ||
    typeof value.description !== 'string' ||
    typeof value.inputSchema !== 'string' ||
    typeof value.outputSchema !== 'string'
  )
    return invalid();
  const identity = nodiaAiTeacherOperationIdentity(value.toolName);
  if (value.kind === 'prepare_change') {
    if (
      !identity ||
      identity.resourceKey !== value.resourceKey ||
      identity.operation !== value.operationKey ||
      value.outputSchema !== 'PreparationResult'
    )
      return invalid();
  } else if (
    identity ||
    !['list', 'get'].includes(value.operationKey) ||
    value.toolName !== `nodia_${value.resourceKey}_${value.operationKey}` ||
    !value.resourceKey.startsWith('teacher_')
  )
    return invalid();
  return {
    toolName: value.toolName,
    resourceKey: value.resourceKey,
    operationKey: value.operationKey,
    kind: value.kind,
    description: value.description,
    inputSchema: value.inputSchema,
    outputSchema: value.outputSchema,
  };
}

export function loadTeacherToolContracts(): ReadonlyMap<
  string,
  TeacherToolContract
> {
  const metadata = parseNodiaAiStrictJson(
    readFileSync(
      new URL(
        '../nodia-ai-products/contracts/teacher-study.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  if (!object(metadata) || !Array.isArray(metadata.tools)) return invalid();
  const tools = metadata.tools.map(contract);
  const byName = new Map(tools.map((tool) => [tool.toolName, tool]));
  if (byName.size !== tools.length) return invalid();
  return byName;
}

export function loadTeacherToolSchemaSource(): string {
  return readFileSync(
    new URL(
      '../nodia-ai-products/contracts/teacher-study.schema.json',
      import.meta.url,
    ),
    'utf8',
  );
}

export function loadTeacherProposalSchemaSource(): string {
  return readFileSync(
    new URL(
      '../nodia-ai-products/contracts/teacher-study-proposal-result.schema.json',
      import.meta.url,
    ),
    'utf8',
  );
}

export function teacherSchemaReference(
  sourceJson: string,
  definition: string,
): NodiaAiToolSchemaReference {
  return {
    sourceJson,
    definition,
    sha256: createHash('sha256').update(sourceJson).digest('hex'),
  };
}
