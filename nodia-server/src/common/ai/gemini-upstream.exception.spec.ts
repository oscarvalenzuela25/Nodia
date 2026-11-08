import { describe, expect, it } from 'vitest';
import { GeminiUpstreamException } from './gemini-upstream.exception.js';

describe('Gemini upstream error classification', () => {
  it.each(['runtime_busy', 'native_proof_missing', 'native_proof_mismatch'])(
    'preserves the safe admission conflict %s instead of reporting invalid extraction',
    (code) => {
      const error = GeminiUpstreamException.fromResponse(
        new Response('private upstream content', {
          status: 409,
          headers: { 'X-Nodia-Error-Code': code },
        }),
      );
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({ upstreamErrorCode: code });
      expect(JSON.stringify(error.getResponse())).not.toContain(
        'private upstream content',
      );
      expect(error.message).not.toContain('no devolvió una extracción válida');
    },
  );

  it.each([
    [409, 'untrusted_message'],
    [502, 'runtime_busy'],
    [401, 'runtime_busy'],
  ])(
    'does not trust an unknown code or incompatible status %s/%s',
    (status, code) => {
      const error = GeminiUpstreamException.fromResponse(
        new Response(null, {
          status,
          headers: { 'X-Nodia-Error-Code': code },
        }),
      );
      expect(error.upstreamErrorCode).toBeNull();
      expect(error.getStatus()).toBe(status === 401 ? 503 : 502);
    },
  );

  it('retains timeout classification, request identity sanitation and bounded retry hints', () => {
    const error = GeminiUpstreamException.fromResponse(
      new Response(null, {
        status: 504,
        headers: {
          'X-Nodia-Error-Code': 'analysis_timeout',
          'x-request-id': 'a'.repeat(32),
          'Retry-After': '99999',
        },
      }),
    );
    expect(error.getStatus()).toBe(504);
    expect(error.getResponse()).toMatchObject({
      upstreamErrorCode: 'analysis_timeout',
      upstreamRequestId: 'a'.repeat(32),
    });
    expect(error.retryAfterSeconds).toBe(86400);
  });
});
