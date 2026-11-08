import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodiaAiAdapterTransport } from './nodia-ai-adapter.service.js';

vi.mock('../config/envs.config.js', () => ({ envs: {
  GEMINI_MICROSERVICE_URL: 'http://127.0.0.1:8000', GEMINI_SERVICE_TOKEN: 'ab'.repeat(32),
} }));
afterEach(() => vi.unstubAllGlobals());

describe('explicit image response bound', () => {
  it('accepts a larger successful image envelope only on the opted-in dispatch route', async () => {
    const value = { fixture: 'x'.repeat(140000) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
    await expect(new NodiaAiAdapterTransport().request('/nodia-ai/agentic/image/turn', {}, AbortSignal.timeout(1000), true)).resolves.toEqual(value);
  });
  it.each([
    ['/nodia-ai/agentic/turn', true, 200],
    ['/nodia-ai/agentic/image/turn', false, 200],
    ['/nodia-ai/agentic/image/turn', true, 409],
  ] as const)('keeps the original limit for %s dispatch=%s status=%s', async (path, dispatch, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ fixture: 'x'.repeat(140000) }), { status })));
    await expect(new NodiaAiAdapterTransport().request(path, {}, AbortSignal.timeout(1000), dispatch)).rejects.toMatchObject({ code: 'adapter_invalid_response' });
  });
});
