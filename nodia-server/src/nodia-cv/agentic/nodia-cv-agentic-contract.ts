import {
  agenticHash,
  agenticHex,
  agenticTextHash,
  agenticUuid,
  agenticWellFormedText,
} from '../../ai-generation/agentic-text-contract.js';
import {
  CV_TAILORING_MAX_RESPONSE_BYTES,
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CV_TAILORING_SCHEMA_VERSION,
  type PreparedCvTailoring,
} from '../engine/types.js';

export const CV_AGENTIC_CONTRACT = 'cv-agentic-text/1';
export const CV_AGENTIC_POLICY_VERSION = 'cv-agentic-text-policy/1';

export interface CvAgenticDescriptor {
  readonly contract: typeof CV_AGENTIC_CONTRACT;
  readonly owner_kind: 'cv';
  readonly provider: 'openai';
  readonly mode: 'agentic';
  readonly generation_id: string;
  readonly attempt_id: string;
  readonly actor_id: string;
  readonly profile_id: string;
  readonly profile_revision: number;
  readonly payload_hash: string;
  readonly resource_key: string;
  readonly configuration_generation: string;
  readonly session_generation: string;
  readonly connection_id: string;
  readonly model_id: string;
  readonly effort_id: string | null;
  readonly purpose_version: typeof CV_TAILORING_PURPOSE;
  readonly prompt_version: typeof CV_TAILORING_PROMPT_VERSION;
  readonly schema_version: typeof CV_TAILORING_SCHEMA_VERSION;
  readonly policy_version: typeof CV_AGENTIC_POLICY_VERSION;
  readonly policy_hash: string;
  readonly runtime_hash: string;
}

export type CvAgenticReceipt = CvAgenticDescriptor & {
  readonly terminal_proof_id: string;
  readonly process_closed: true;
  readonly observed_at: string;
} & (
    | { readonly remote_outcome: 'completed'; readonly response_hash: string }
    | {
        readonly remote_outcome: 'unknown' | 'not_dispatched';
        readonly response_hash: null;
      }
  );

const descriptorKeys = [
  'contract',
  'owner_kind',
  'provider',
  'mode',
  'generation_id',
  'attempt_id',
  'actor_id',
  'profile_id',
  'profile_revision',
  'payload_hash',
  'resource_key',
  'configuration_generation',
  'session_generation',
  'connection_id',
  'model_id',
  'effort_id',
  'purpose_version',
  'prompt_version',
  'schema_version',
  'policy_version',
  'policy_hash',
  'runtime_hash',
] as const satisfies readonly (keyof CvAgenticDescriptor)[];

const receiptKeys = [
  ...descriptorKeys,
  'terminal_proof_id',
  'process_closed',
  'observed_at',
  'remote_outcome',
  'response_hash',
] as const satisfies readonly (keyof CvAgenticReceipt)[];

function invalidContract(): never {
  throw new Error('nodiaCv:agentic_protocol_invalid');
}

function exactRecord(value: unknown, keys: readonly string[]) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    invalidContract();
  }
  const fields = Object.getOwnPropertyDescriptors(value);
  if (
    keys.some(
      (key) => !fields[key].enumerable || !Object.hasOwn(fields[key], 'value'),
    )
  )
    invalidContract();
  return Object.fromEntries(
    keys.map((key) => [key, fields[key].value as unknown]),
  );
}

function bigintId(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

function exactId(value: unknown, maxBytes: number): boolean {
  return (
    typeof value === 'string' &&
    Buffer.byteLength(value, 'utf8') <= maxBytes &&
    value !== '' &&
    value.trim() === value &&
    !/\p{Cc}/u.test(value) &&
    agenticWellFormedText(value)
  );
}

function observationInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    return false;
  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

export function cvAgenticPayloadHash(
  payload: Pick<PreparedCvTailoring, 'systemPrompt' | 'userPrompt'>,
): string {
  return agenticHash({
    systemPrompt: payload.systemPrompt,
    userPrompt: payload.userPrompt,
  });
}

export function parseCvAgenticDescriptor(value: unknown): CvAgenticDescriptor {
  const v = exactRecord(value, descriptorKeys);
  const revision = v.profile_revision;
  if (
    v.contract !== CV_AGENTIC_CONTRACT ||
    v.owner_kind !== 'cv' ||
    v.provider !== 'openai' ||
    v.mode !== 'agentic' ||
    ![v.generation_id, v.attempt_id, v.profile_id].every(agenticUuid) ||
    !bigintId(v.actor_id) ||
    !bigintId(v.connection_id) ||
    typeof revision !== 'number' ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    revision > 2147483647 ||
    !exactId(v.model_id, 1024) ||
    !(v.effort_id === null || exactId(v.effort_id, 256)) ||
    typeof v.resource_key !== 'string' ||
    !/^codex-profile:[0-9a-f]{64}$/.test(v.resource_key) ||
    !agenticHex(v.session_generation, 32) ||
    ![
      v.configuration_generation,
      v.payload_hash,
      v.policy_hash,
      v.runtime_hash,
    ].every((hash) => agenticHex(hash)) ||
    v.purpose_version !== CV_TAILORING_PURPOSE ||
    v.prompt_version !== CV_TAILORING_PROMPT_VERSION ||
    v.schema_version !== CV_TAILORING_SCHEMA_VERSION ||
    v.policy_version !== CV_AGENTIC_POLICY_VERSION
  ) {
    invalidContract();
  }
  return Object.freeze({ ...v }) as unknown as CvAgenticDescriptor;
}

/** Pass responseText when consuming a live response. Recovery may validate the receipt alone. */
export function parseCvAgenticReceipt(
  value: unknown,
  expected: CvAgenticDescriptor,
  responseText?: string,
): CvAgenticReceipt {
  const descriptor = parseCvAgenticDescriptor(expected);
  const v = exactRecord(value, receiptKeys);
  const { terminal_proof_id, observed_at, remote_outcome, response_hash } = v;
  if (
    descriptorKeys.some((key) => v[key] !== descriptor[key]) ||
    !agenticUuid(terminal_proof_id) ||
    !observationInstant(observed_at) ||
    v.process_closed !== true
  )
    invalidContract();

  const receipt = {
    ...descriptor,
    terminal_proof_id,
    observed_at,
    process_closed: true as const,
  };
  if (remote_outcome === 'completed') {
    if (
      !agenticHex(response_hash) ||
      (responseText !== undefined &&
        (typeof responseText !== 'string' ||
          Buffer.byteLength(responseText, 'utf8') >
            CV_TAILORING_MAX_RESPONSE_BYTES ||
          !responseText.trim() ||
          !agenticWellFormedText(responseText) ||
          agenticTextHash(responseText) !== response_hash))
    )
      invalidContract();
    return Object.freeze({ ...receipt, remote_outcome, response_hash });
  }

  if (
    (remote_outcome !== 'unknown' && remote_outcome !== 'not_dispatched') ||
    response_hash !== null ||
    responseText !== undefined
  )
    invalidContract();
  return Object.freeze({ ...receipt, remote_outcome, response_hash });
}
