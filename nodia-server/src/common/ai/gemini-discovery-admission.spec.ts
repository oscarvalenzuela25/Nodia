import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../config/envs.config.js', () => ({
  envs: {
    GEMINI_MICROSERVICE_URL: 'http://synthetic-native.invalid',
    GEMINI_SERVICE_TOKEN: 'a'.repeat(64),
  },
}));
import { GeminiService } from './gemini.service.js';

afterEach(() => vi.unstubAllGlobals());
describe('Gemini discovery admission boundary', () => {
  it.each(['runtime_busy', 'native_proof_missing', 'native_proof_mismatch'])(
    'preserves the safe rejection %s without another request',
    async (reason) => {
      const fetch = vi.fn().mockResolvedValue(
        new Response('not exposed', {
          status: 409,
          headers: { 'X-Nodia-Error-Code': reason },
        }),
      );
      vi.stubGlobal('fetch', fetch);
      const result = await new GeminiService().getModelsAndQuota('agentic');
      expect(result).toMatchObject({
        available: false,
        authenticated: false,
        reason,
        models: [],
      });
      expect(fetch).toHaveBeenCalledOnce();
      expect(JSON.stringify(result)).not.toContain('not exposed');
    },
  );
  it('preserves a busy observational result without making configured models executable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          engine: 'agentic',
          available: false,
          authenticated: false,
          reason: 'runtime_busy',
          models: [{ id: 'opaque-synthetic', name: 'Synthetic' }],
        }),
      ),
    );
    const result = await new GeminiService().getModelsAndQuota('agentic');
    expect(result).toMatchObject({
      available: false,
      authenticated: false,
      reason: 'runtime_busy',
      models: [],
    });
  });
  it('does not forward an unrecognized discovery reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          engine: 'agentic',
          available: false,
          authenticated: false,
          reason: 'private-unknown',
          models: [],
        }),
      ),
    );
    const result = await new GeminiService().getModelsAndQuota('agentic');
    expect(result.reason).toBeNull();
  });
});
