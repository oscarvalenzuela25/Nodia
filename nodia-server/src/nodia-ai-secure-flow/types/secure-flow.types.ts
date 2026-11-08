import { InternalServerErrorException } from '@nestjs/common';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
export type SecureFlowKind =
  | 'api_key_create'
  | 'api_key_update'
  | 'api_key_delete'
  | 'connection_login'
  | 'nodia_logout'
  | 'codex_logout'
  | 'gemini_web_logout'
  | 'sync_models';
export type SecureFlowState =
  | 'waiting'
  | 'invoking'
  | 'pending'
  | 'completed'
  | 'unknown'
  | 'cancelled'
  | 'expired'
  | 'failed';
export type SecureFlowAction =
  | 'key'
  | 'delete'
  | 'start'
  | 'status'
  | 'code'
  | 'frame'
  | 'input'
  | 'cancel'
  | 'logout'
  | 'sync';
/** Private durable witness. Never returned by proposal, MCP, transcript or events. */
export type SecureFlowNativeRequest = NodiaAiJsonObject & {
  request_id: string;
  provider_id: string;
  provider_key: 'gemini' | 'openai';
  mode: 'agentic';
};
export type SecureFlowDescriptor = NodiaAiJsonObject & {
  schema_version: 1;
  kind: 'secure_human_flow';
  reference: string;
  flow_kind: SecureFlowKind;
  actor_id: string;
  session_id: string;
  expires_at: string;
  status: SecureFlowState;
  native_reference: NodiaAiJsonObject | null;
  request_id: string | null;
  request_action: SecureFlowAction | null;
  request_revision: number | null;
  /** Optional only for pre-R01 witnesses. New dispatches persist it before native I/O. */
  native_request?: SecureFlowNativeRequest | null;
};
export const secureUuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const kinds: readonly string[] = [
  'api_key_create',
  'api_key_update',
  'api_key_delete',
  'connection_login',
  'nodia_logout',
  'codex_logout',
  'gemini_web_logout',
  'sync_models',
];
const actions: readonly string[] = [
  'key',
  'delete',
  'start',
  'status',
  'code',
  'frame',
  'input',
  'cancel',
  'logout',
  'sync',
];
const states: readonly string[] = [
  'waiting',
  'invoking',
  'pending',
  'completed',
  'unknown',
  'cancelled',
  'expired',
  'failed',
];
export function secureObject(value: unknown): value is NodiaAiJsonObject {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
export function secureDescriptor(value: unknown): SecureFlowDescriptor {
  const invalid = (): never => {
    throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
  };
  if (
    !secureObject(value) ||
    Object.keys(value)
      .filter((key) => key !== 'native_request')
      .sort()
      .join(',') !==
      [
        'schema_version',
        'kind',
        'reference',
        'flow_kind',
        'actor_id',
        'session_id',
        'expires_at',
        'status',
        'native_reference',
        'request_id',
        'request_action',
        'request_revision',
      ]
        .sort()
        .join(',') ||
    value.schema_version !== 1 ||
    value.kind !== 'secure_human_flow' ||
    typeof value.reference !== 'string' ||
    !secureUuid.test(value.reference) ||
    typeof value.flow_kind !== 'string' ||
    !kinds.includes(value.flow_kind) ||
    typeof value.actor_id !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(value.actor_id) ||
    typeof value.session_id !== 'string' ||
    !secureUuid.test(value.session_id) ||
    typeof value.expires_at !== 'string' ||
    !Number.isFinite(Date.parse(value.expires_at)) ||
    typeof value.status !== 'string' ||
    !states.includes(value.status) ||
    !(
      value.request_id === null ||
      (typeof value.request_id === 'string' &&
        secureUuid.test(value.request_id))
    ) ||
    !(
      value.request_action === null ||
      (typeof value.request_action === 'string' &&
        actions.includes(value.request_action))
    ) ||
    (value.request_id === null) !== (value.request_action === null) ||
    (value.request_id === null) !== (value.request_revision === null) ||
    (value.request_revision !== null &&
      (!Number.isSafeInteger(value.request_revision) ||
        Number(value.request_revision) < 1 ||
        Number(value.request_revision) > 2147483646))
  )
    return invalid();
  if (value.native_request !== undefined && value.native_request !== null) {
    const request = value.native_request;
    if (
      value.flow_kind !== 'connection_login' ||
      !secureObject(request) ||
      Object.keys(request).sort().join(',') !==
        'mode,provider_id,provider_key,request_id' ||
      typeof request.request_id !== 'string' ||
      !secureUuid.test(request.request_id) ||
      typeof request.provider_id !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(request.provider_id) ||
      BigInt(request.provider_id) > 9223372036854775807n ||
      !['gemini', 'openai'].includes(String(request.provider_key)) ||
      !['agentic'].includes(String(request.mode)) ||
      (request.provider_key === 'openai' && request.mode !== 'agentic')
    )
      return invalid();
  }
  if (value.native_reference !== null) {
    const ref = value.native_reference;
    if (
      !secureObject(ref) ||
      Object.keys(ref).sort().join(',') !==
        'job_id,mode,provider_id,provider_key' ||
      typeof ref.provider_id !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(ref.provider_id) ||
      !['gemini', 'openai'].includes(String(ref.provider_key)) ||
      !['agentic'].includes(String(ref.mode)) ||
      typeof ref.job_id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(ref.job_id)
    )
      return invalid();
    const request = value.native_request;
    if (
      request &&
      secureObject(request) &&
      ['provider_id', 'provider_key', 'mode'].some(
        (key) => ref[key] !== request[key],
      )
    )
      return invalid();
  }
  return value as SecureFlowDescriptor;
}
export function secureFlowReceipt(
  descriptor: SecureFlowDescriptor,
): NodiaAiJsonObject {
  return {
    schema_version: 1,
    resource_key: 'secure_flows',
    id: descriptor.reference,
    operation: descriptor.flow_kind,
  };
}

/** Read-only validation of immutable pre-retirement receipts; never authorizes native I/O. */
export function historicalSecureDescriptor(
  value: unknown,
): SecureFlowDescriptor {
  if (!secureObject(value)) return secureDescriptor(value);
  const projected = structuredClone(value);
  const request = projected.native_request;
  const reference = projected.native_reference;
  if (
    secureObject(request) &&
    secureObject(reference) &&
    request.mode !== reference.mode
  )
    throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
  for (const witness of [request, reference]) {
    if (!secureObject(witness)) continue;
    if (
      witness.mode === 'token_plan_agentic' ||
      witness.mode === 'token_plan_web'
    ) {
      if (
        witness.mode === 'token_plan_web' &&
        witness.provider_key !== 'gemini'
      )
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      witness.mode = 'agentic';
    }
  }
  return secureDescriptor(projected);
}
