import { afterEach, describe, expect, it, vi } from 'vitest';
import asset from '../../nodia-ai-runtime/config/runtime-policy.json' with { type: 'json' };
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiAdapterRequest } from '../types/nodia-ai-adapter.types.js';
import type { ApiNodiaAiCredentialsService } from '../api-nodia-ai-credentials.service.js';
import type { ApiNodiaAiAcceptanceService } from '../api-nodia-ai-acceptance.service.js';
import type { ApiNodiaAiRuntimeService } from '../api-nodia-ai-runtime.service.js';
import { ApiNodiaAiAdapterUseCase } from './api-nodia-ai-adapter.use-case.js';

const policy = asset.policy as unknown as NodiaAiRuntimePolicy;
function setup() {
  const config = {
    providerKey: 'openai' as const,
    connectionId: '4',
    keyId: '5',
    configurationGeneration: 'c'.repeat(64),
    resourceKey: 'api-connection:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
  };
  const configuration = vi.fn().mockResolvedValue(config);
  const secret = vi.fn().mockResolvedValue('synthetic-secret');
  const acceptance = {
    read: vi.fn().mockResolvedValue({
      verifiedMediaTypes: [],
      imageGeneration: false,
      observedAt: null,
    }),
    validateCanary: vi.fn(),
    qualify: vi.fn(),
  };
  const events: string[] = [];
  const runtime = {
    start: vi.fn(async (_request: NodiaAiAdapterRequest) => {
      events.push('start');
    }),
    reserveExchange: vi.fn(async (_request: NodiaAiAdapterRequest) => {
      events.push('reserve');
    }),
    finish: vi.fn(async (req: NodiaAiAdapterRequest, outcome: string) => {
      events.push('finish:' + outcome);
      return {
        engine: 'api_key',
        attemptId: req.attemptId,
        operationRef: req.attemptId,
        resourceKey: config.resourceKey,
        sessionGeneration: config.sessionGeneration,
        adapterIdentity: {
          providerKey: 'openai',
          contractVersion: 'nodia-ai-api-chat/1',
          connectionId: '4',
        },
        localTransportClosed: true,
        remoteOutcome: outcome === 'completed' ? 'completed' : 'unknown',
        outcome: outcome === 'completed' ? 'completed' : 'abandoned_unknown',
        terminalProofId: '1d73e810-dfe3-4f9f-8557-5f2363bbd6fd',
        observedAt: new Date(),
      };
    }),
  };
  const adapter = new ApiNodiaAiAdapterUseCase(
    { configuration, secret } as unknown as ApiNodiaAiCredentialsService,
    runtime as unknown as ApiNodiaAiRuntimeService,
    acceptance as unknown as ApiNodiaAiAcceptanceService,
    policy,
  );
  const request: NodiaAiAdapterRequest = {
    selection: {
      connection_id: '4',
      mode: 'api_key',
      model_id: 'fixture-catalog-model',
      effort_id: null,
    },
    attemptId: 'a87b3197-5968-473f-8e5e-c6b4935b6771',
    canonicalPrompt: 'Synthetic prompt',
    deadlineAt: new Date(Date.now() + 10000),
    resourceKey: config.resourceKey,
    sessionGeneration: config.sessionGeneration,
    configurationGeneration: config.configurationGeneration,
    onLeaseCheck: vi.fn().mockResolvedValue(undefined),
    onProtocolProgress: vi.fn().mockResolvedValue(undefined),
  };
  return {
    adapter,
    request,
    config,
    configuration,
    secret,
    runtime,
    acceptance,
    events,
  };
}
afterEach(() => vi.unstubAllGlobals());
describe('API adapter lifecycle and configuration readiness', () => {
  it('does not overwrite a possibly committed completed proof after losing the terminal SQL response', async () => {
    const f = setup();
    f.runtime.finish.mockRejectedValueOnce(Error('private SQL response lost'));
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'completed',
              output: [
                {
                  type: 'message',
                  role: 'assistant',
                  content: [{ type: 'output_text', text: 'success' }],
                },
              ],
            }),
          ),
      ),
    );
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({
      code: 'api_result_unknown',
      outcome: 'unknown',
    });
    expect(f.runtime.finish).toHaveBeenCalledOnce();
    expect(f.runtime.finish.mock.calls[0][1]).toBe('completed');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('never certifies local closure while a callback is still unsettled after cancellation', async () => {
    const f = setup();
    const controller = new AbortController();
    let resolveCallback!: (value: { status: string }) => void;
    let callbackStarted!: () => void;
    const entered = new Promise<void>((resolve) => {
      callbackStarted = resolve;
    });
    f.request.tools = [
      {
        name: 'read_fixture',
        description: 'Synthetic read',
        inputSchema: { type: 'object', additionalProperties: false },
      },
    ];
    f.request.onToolCall = vi.fn(() => {
      callbackStarted();
      return new Promise<{ status: string }>((resolve) => {
        resolveCallback = resolve;
      });
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: 'completed',
              output: [
                {
                  type: 'function_call',
                  call_id: 'read_one',
                  name: 'read_fixture',
                  arguments: '{}',
                },
              ],
            }),
          ),
      ),
    );
    const pending = f.adapter.execute(f.request, controller.signal);
    await entered;
    controller.abort();
    await Promise.resolve();
    expect(f.runtime.finish).not.toHaveBeenCalled();
    resolveCallback({ status: 'closed' });
    await expect(pending).rejects.toMatchObject({ outcome: 'unknown' });
    expect(f.runtime.finish).toHaveBeenCalledOnce();
    expect(f.runtime.finish.mock.calls[0][1]).toBe('unknown');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('observes only configuration/catalogue without decrypting keys, generating or declaring MCP/native media', async () => {
    const f = setup();
    vi.stubGlobal('fetch', vi.fn());
    const observed = await f.adapter.observe(f.request.selection);
    expect(observed).toMatchObject({
      source: 'api_configuration_and_catalog',
      available: true,
      supportsMcp: false,
      supportsTools: true,
      verifiedAttachmentMediaTypes: [],
      verifiedModalities: [],
      adapterIdentity: {
        providerKey: 'openai',
        connectionId: '4',
        contractVersion: 'nodia-ai-api-chat/1',
      },
    });
    expect(f.secret).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(f.runtime.start).not.toHaveBeenCalled();
  });
  it('reserves the exact durable attempt before the first POST, then proves local closure without fabricating process closure', async () => {
    const f = setup();
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        f.events.push('post');
        fetchSignal = init.signal as AbortSignal;
        return new Response(
          JSON.stringify({
            status: 'completed',
            output: [
              {
                type: 'message',
                role: 'assistant',
                content: [{ type: 'output_text', text: 'success' }],
              },
            ],
          }),
        );
      }),
    );
    const reply = await f.adapter.execute(f.request);
    expect(f.events).toEqual(['start', 'reserve', 'post', 'finish:completed']);
    expect(reply).toMatchObject({
      kind: 'answer',
      text: 'success',
      terminalProof: {
        engine: 'api_key',
        localTransportClosed: true,
        remoteOutcome: 'completed',
      },
    });
    expect(reply.terminalProof.processClosed).toBeUndefined();
    expect(fetchSignal?.aborted).toBe(true);
    expect(f.runtime.start.mock.calls[0]?.[0]).toBe(
      f.runtime.reserveExchange.mock.calls[0]?.[0],
    );
  });
  it('closes the local transport and records unknown exactly once after an ambiguous network failure, without fallback/replay', async () => {
    const f = setup();
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        fetchSignal = init.signal as AbortSignal;
        throw Error('synthetic-secret sensitive network error');
      }),
    );
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({
      code: 'api_result_unknown',
      outcome: 'unknown',
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(f.runtime.finish).toHaveBeenCalledOnce();
    expect(f.runtime.finish.mock.calls[0][1]).toBe('unknown');
    expect(fetchSignal?.aborted).toBe(true);
  });
  it('rejects a changed epoch before acquiring credentials or starting a transport', async () => {
    const f = setup();
    f.request.configurationGeneration = 'd'.repeat(64);
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({
      code: 'adapter_configuration_changed',
      outcome: 'not_dispatched',
    });
    expect(f.secret).not.toHaveBeenCalled();
    expect(f.runtime.start).not.toHaveBeenCalled();
  });
  it('rejects unqualified explicit image generation before key decryption/dispatch', async () => {
    const f = setup();
    f.request.imageGeneration = { prompt: 'Explicit image' };
    await expect(f.adapter.execute(f.request)).rejects.toMatchObject({
      code: 'adapter_attachments_unverified',
    });
    expect(f.secret).not.toHaveBeenCalled();
    expect(f.runtime.start).not.toHaveBeenCalled();
  });
  it('does not finish or dispatch after a pre-start lease rejection', async () => {
    const f = setup();
    f.request.onLeaseCheck = vi.fn().mockRejectedValue(Error('lease_lost'));
    vi.stubGlobal('fetch', vi.fn());
    await expect(f.adapter.execute(f.request)).rejects.toThrow('lease_lost');
    expect(fetch).not.toHaveBeenCalled();
    expect(f.runtime.start).not.toHaveBeenCalled();
    expect(f.runtime.finish).not.toHaveBeenCalled();
  });
  it('measures the actual initial REST prompt/catalogue without model-token or hidden-window claims', async () => {
    const f = setup();
    const result = await f.adapter.measureContext({
      selection: f.request.selection,
      canonicalPrompt: 'quoted "prompt"',
    });
    expect(result).toMatchObject({
      measurementScope: 'initial_api_prompt',
      measurementKind: 'exact',
      modelContextTokens: null,
      maxUtf8Bytes: policy.results.assembled_context_utf8_bytes,
    });
    expect(result.totalUtf8Bytes).toBe(
      result.canonicalUtf8Bytes +
        result.catalogUtf8Bytes +
        result.overheadUtf8Bytes,
    );
    expect(f.secret).not.toHaveBeenCalled();
  });
});
