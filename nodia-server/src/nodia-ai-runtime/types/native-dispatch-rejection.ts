import { createHash } from 'node:crypto';
import type { NodiaAiRuntimeProofRequest } from './reconciliation.types.js';

/** A receiver rejection, never a native process terminal and never acknowledged. */
export interface NodiaAiNativeDispatchRejection {
  readonly kind: 'native_dispatch_rejected';
  readonly engine: 'agentic';
  readonly attemptId: string;
  readonly operationRef: string;
  readonly resourceKey: string;
  readonly sessionGeneration: string;
  readonly configurationGeneration: string;
  readonly route: '/nodia-ai/agentic/mcp/start';
  readonly httpStatus: 409;
  readonly code: 'runtime_busy';
  readonly requestId: string;
  readonly requestSha256: string;
  readonly responseSha256: string;
  readonly observedAt: string;
}

const issued = new WeakSet<object>();
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const hash = /^[a-f0-9]{64}$/u;
const generation = /^[a-f0-9]{32}$/u;
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

/** Called only with the bytes/headers received by the configured private transport.
 * Only this route/code is known to reject before native ledger arming. In particular,
 * runtime_busy from invoice/turn must not be promoted by a generic code whitelist.
 */
export function nativeDispatchRejection(input: {
  route: string; payload: object; requestBytes: string; responseBytes: Uint8Array;
  body: unknown; status: number; requestIdHeader: string | null;
  contentType: string | null; redirected: boolean;
}): NodiaAiNativeDispatchRejection | undefined {
  const payload = record(input.payload), body = record(input.body);
  try {
    if (input.responseBytes.byteLength > 131072 ||
        JSON.stringify(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.responseBytes))) !== JSON.stringify(body))
      return undefined;
  } catch { return undefined; }
  if (input.route !== '/nodia-ai/agentic/mcp/start' || input.status !== 409 ||
      input.redirected || !/^application\/json(?:;|$)/iu.test(input.contentType ?? '') ||
      !body || Object.keys(body).length !== 3 ||
      !['code', 'detail', 'request_id'].every(key => Object.hasOwn(body, key)) ||
      body.code !== 'runtime_busy' || typeof body.detail !== 'string' ||
      Buffer.byteLength(body.detail) > 4096 || typeof body.request_id !== 'string' ||
      !generation.test(body.request_id) || body.request_id !== input.requestIdHeader ||
      !payload || typeof payload.attempt_id !== 'string' || !uuid.test(payload.attempt_id) ||
      typeof payload.resource_key !== 'string' || !/^gemini-profile:[a-f0-9]{64}$/u.test(payload.resource_key) ||
      typeof payload.session_generation !== 'string' || !generation.test(payload.session_generation) ||
      typeof payload.configuration_generation !== 'string' || !hash.test(payload.configuration_generation) ||
      input.requestBytes !== JSON.stringify(payload)) return undefined;
  const proof: NodiaAiNativeDispatchRejection = Object.freeze({
    kind: 'native_dispatch_rejected', engine: 'agentic',
    attemptId: payload.attempt_id, operationRef: payload.attempt_id,
    resourceKey: payload.resource_key, sessionGeneration: payload.session_generation,
    configurationGeneration: payload.configuration_generation,
    route: '/nodia-ai/agentic/mcp/start', httpStatus: 409, code: 'runtime_busy',
    requestId: body.request_id,
    requestSha256: createHash('sha256').update(input.requestBytes).digest('hex'),
    responseSha256: createHash('sha256').update(input.responseBytes).digest('hex'),
    observedAt: new Date().toISOString(),
  });
  issued.add(proof);
  return proof;
}

export function assertNativeDispatchRejection(
  request: NodiaAiRuntimeProofRequest,
  proof: NodiaAiNativeDispatchRejection,
  configurationGeneration: unknown,
): void {
  if (!proof || !issued.has(proof) || request.adapterIdentity !== undefined ||
      request.engine !== 'agentic' || proof.attemptId !== request.attemptId ||
      proof.operationRef !== request.operationRef || proof.resourceKey !== request.resourceKey ||
      proof.sessionGeneration !== request.sessionGeneration ||
      proof.configurationGeneration !== configurationGeneration)
    throw Error('nodia_ai:invalid_dispatch_rejection');
}
