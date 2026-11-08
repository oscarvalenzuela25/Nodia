import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { nativeDispatchRejection, assertNativeDispatchRejection } from './native-dispatch-rejection.js';
import { NodiaAiAdapterTransport } from '../../nodia-ai-adapter/nodia-ai-adapter.service.js';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';

vi.mock('../../config/envs.config.js', () => ({ envs: {
  GEMINI_SERVICE_TOKEN: 'a'.repeat(64), GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:9999',
} }));
const route = '/nodia-ai/agentic/mcp/start';
const payload = { attempt_id: '8e687984-ebbd-46cd-977c-279207164d69',
  resource_key: 'gemini-profile:' + 'b'.repeat(64), session_generation: 'c'.repeat(32),
  configuration_generation: 'd'.repeat(64), canonical_prompt: 'synthetic private document' };
const body = { code: 'runtime_busy', detail: 'synthetic private detail', request_id: 'e'.repeat(32) };
const bytes = JSON.stringify(body);
const request = { engine: 'agentic' as const, attemptId: payload.attempt_id, operationRef: payload.attempt_id,
  resourceKey: payload.resource_key, sessionGeneration: payload.session_generation };
function input() { return { route, payload, requestBytes: JSON.stringify(payload), responseBytes: Buffer.from(bytes),
  body, status: 409, requestIdHeader: body.request_id, contentType: 'application/json', redirected: false }; }
afterEach(() => vi.unstubAllGlobals());

describe('private native rejection contract', () => {
  it('binds actual transport response to exact identity and digests without retaining private strings', async () => {
    const fetch = vi.fn(async () => new Response(bytes, { status: 409,
      headers: { 'content-type': 'application/json', 'x-request-id': body.request_id } }));
    vi.stubGlobal('fetch', fetch);
    const error = await new NodiaAiAdapterTransport().request(route, payload, new AbortController().signal, true)
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(NodiaAiAdapterError);
    const failure = error as NodiaAiAdapterError;
    expect(failure.outcome).toBe('not_dispatched');
    expect(() => assertNativeDispatchRejection(request, failure.rejectionProof!, payload.configuration_generation)).not.toThrow();
    expect(failure.rejectionProof!.requestSha256).toBe(createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
    expect(failure.rejectionProof!.responseSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(JSON.stringify(failure.rejectionProof)).not.toContain('synthetic private');
    expect(failure.rejectionProof).not.toHaveProperty('terminalProofId');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['route', 'status', 'code', 'header', 'extra', 'redirect', 'session', 'request_bytes', 'response_bytes'])('does not certify invalid %s', field => {
    const value = input();
    if (field === 'route') value.route = '/nodia-ai/agentic/invoice/turn';
    if (field === 'status') value.status = 503;
    if (field === 'code') value.body = { ...body, code: 'internal_error' };
    if (field === 'header') value.requestIdHeader = 'f'.repeat(32);
    if (field === 'extra') value.body = Object.assign({}, body, { extra: true });
    if (field === 'redirect') value.redirected = true;
    if (field === 'session') value.payload = { ...payload, session_generation: 'invalid' };
    if (field === 'request_bytes') value.requestBytes += ' ';
    if (field === 'response_bytes') value.responseBytes = Buffer.from('{"code":"internal_error"}');
    expect(nativeDispatchRejection(value)).toBeUndefined();
  });
  it('rejects structural copies and identity/configuration substitution', () => {
    const proof = nativeDispatchRejection(input())!;
    expect(() => assertNativeDispatchRejection(request, { ...proof }, payload.configuration_generation)).toThrow('invalid_dispatch_rejection');
    for (const changed of [{ ...request, attemptId: 'different' }, { ...request, resourceKey: 'different' },
      { ...request, sessionGeneration: 'f'.repeat(32) }])
      expect(() => assertNativeDispatchRejection(changed, proof, payload.configuration_generation)).toThrow();
    expect(() => assertNativeDispatchRejection(request, proof, 'f'.repeat(64))).toThrow();
  });
  it.each(['network', 'invalid_json', 'missing_header'])('keeps ambiguous %s unknown and never retries', async mode => {
    const fetch = vi.fn(async () => {
      if (mode === 'network') throw new Error('private network error');
      return new Response(mode === 'invalid_json' ? '{' : bytes, { status: 409,
        headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetch);
    const error = await new NodiaAiAdapterTransport().request(route, payload, new AbortController().signal, true).catch((value: unknown) => value) as NodiaAiAdapterError;
    expect(error.outcome).toBe('unknown'); expect(error.rejectionProof).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
