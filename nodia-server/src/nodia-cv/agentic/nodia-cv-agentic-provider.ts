import {
  agenticHex,
  agenticTextHash,
  agenticUuid,
  agenticWellFormedText,
} from '../../ai-generation/agentic-text-contract.js';
import {
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CV_TAILORING_SCHEMA_VERSION,
} from '../engine/types.js';
import {
  CV_AGENTIC_CONTRACT,
  CV_AGENTIC_POLICY_VERSION,
  parseCvAgenticDescriptor,
  parseCvAgenticReceipt,
  type CvAgenticDescriptor,
  type CvAgenticReceipt,
} from './nodia-cv-agentic-contract.js';

export const CV_GEMINI_PROMPT_BYTES = 131072;
export const CV_GEMINI_RESPONSE_BYTES = 32768;

export type CvGeminiDescriptor = Omit<CvAgenticDescriptor, 'provider'> & {
  readonly provider: 'gemini';
};

export type CvGeminiReceipt = CvGeminiDescriptor &
  Pick<
    CvAgenticReceipt,
    'terminal_proof_id' | 'process_closed' | 'observed_at'
  > &
  (
    | { readonly remote_outcome: 'completed'; readonly response_hash: string }
    | {
        readonly remote_outcome: 'unknown' | 'not_dispatched';
        readonly response_hash: null;
      }
  );

export type CvProviderDescriptor = CvAgenticDescriptor | CvGeminiDescriptor;
export type CvProviderReceipt = CvAgenticReceipt | CvGeminiReceipt;

const geminiDescriptorKeys = [
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
] as const satisfies readonly (keyof CvGeminiDescriptor)[];

export function invalidCvGeminiProtocol(): never {
  throw new Error('nodiaCv:agentic_protocol_invalid');
}

export function cvGeminiRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    invalidCvGeminiProtocol();
  const fields = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(fields).length !== keys.length ||
    keys.some(
      (key) =>
        !Object.hasOwn(fields, key) ||
        !fields[key].enumerable ||
        !Object.hasOwn(fields[key], 'value'),
    )
  )
    invalidCvGeminiProtocol();
  return Object.fromEntries(keys.map((key) => [key, fields[key].value]));
}

function exactId(value: unknown, maxBytes: number): boolean {
  return (
    typeof value === 'string' &&
    value !== '' &&
    value.trim() === value &&
    !/\p{Cc}/u.test(value) &&
    agenticWellFormedText(value) &&
    Buffer.byteLength(value, 'utf8') <= maxBytes
  );
}

function bigintId(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

export function cvGeminiResourceKey(value: unknown): value is string {
  return (
    typeof value === 'string' && /^gemini-profile:[0-9a-f]{64}$/.test(value)
  );
}

export function parseCvGeminiDescriptor(value: unknown): CvGeminiDescriptor {
  const v = cvGeminiRecord(value, geminiDescriptorKeys);
  if (
    v.contract !== CV_AGENTIC_CONTRACT ||
    v.owner_kind !== 'cv' ||
    v.mode !== 'agentic' ||
    v.provider !== 'gemini' ||
    ![v.generation_id, v.attempt_id, v.profile_id].every(agenticUuid) ||
    !bigintId(v.actor_id) ||
    !bigintId(v.connection_id) ||
    typeof v.profile_revision !== 'number' ||
    !Number.isInteger(v.profile_revision) ||
    v.profile_revision < 1 ||
    v.profile_revision > 2147483647 ||
    !exactId(v.model_id, 1024) ||
    !(v.effort_id === null || exactId(v.effort_id, 256)) ||
    !cvGeminiResourceKey(v.resource_key) ||
    !agenticHex(v.session_generation, 32) ||
    ![
      v.payload_hash,
      v.configuration_generation,
      v.policy_hash,
      v.runtime_hash,
    ].every((hash) => agenticHex(hash)) ||
    v.purpose_version !== CV_TAILORING_PURPOSE ||
    v.prompt_version !== CV_TAILORING_PROMPT_VERSION ||
    v.schema_version !== CV_TAILORING_SCHEMA_VERSION ||
    v.policy_version !== CV_AGENTIC_POLICY_VERSION
  )
    invalidCvGeminiProtocol();
  return Object.freeze(v) as unknown as CvGeminiDescriptor;
}

export function parseCvGeminiReceipt(
  value: unknown,
  expected: CvGeminiDescriptor,
  text?: string,
): CvGeminiReceipt {
  const descriptor = parseCvGeminiDescriptor(expected);
  const v = cvGeminiRecord(value, [
    ...geminiDescriptorKeys,
    'terminal_proof_id',
    'process_closed',
    'observed_at',
    'remote_outcome',
    'response_hash',
  ]);
  const {
    terminal_proof_id,
    process_closed,
    observed_at,
    remote_outcome,
    response_hash,
  } = v;
  if (
    geminiDescriptorKeys.some((key) => v[key] !== descriptor[key]) ||
    !agenticUuid(terminal_proof_id) ||
    process_closed !== true ||
    typeof observed_at !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(observed_at) ||
    !Number.isFinite(Date.parse(observed_at)) ||
    new Date(observed_at).toISOString() !== observed_at
  )
    invalidCvGeminiProtocol();
  const receipt = {
    ...descriptor,
    terminal_proof_id,
    process_closed: true as const,
    observed_at,
  };
  if (remote_outcome === 'completed') {
    if (
      !agenticHex(response_hash) ||
      (text !== undefined &&
        (!agenticWellFormedText(text) ||
          !text.trim() ||
          Buffer.byteLength(text, 'utf8') > CV_GEMINI_RESPONSE_BYTES ||
          agenticTextHash(text) !== response_hash))
    )
      invalidCvGeminiProtocol();
    return Object.freeze({ ...receipt, remote_outcome, response_hash });
  }
  if (
    (remote_outcome !== 'unknown' && remote_outcome !== 'not_dispatched') ||
    response_hash !== null ||
    text !== undefined
  )
    invalidCvGeminiProtocol();
  return Object.freeze({ ...receipt, remote_outcome, response_hash });
}

export function parseCvProviderDescriptor(
  value: unknown,
): CvProviderDescriptor {
  return value !== null &&
    typeof value === 'object' &&
    Object.getOwnPropertyDescriptor(value, 'provider')?.value === 'gemini'
    ? parseCvGeminiDescriptor(value)
    : parseCvAgenticDescriptor(value);
}

export function parseCvProviderReceipt(
  value: unknown,
  expected: CvProviderDescriptor,
  text?: string,
): CvProviderReceipt {
  return expected.provider === 'gemini'
    ? parseCvGeminiReceipt(value, expected, text)
    : parseCvAgenticReceipt(value, expected, text);
}
