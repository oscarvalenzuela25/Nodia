import { afterEach, describe, expect, it, vi } from 'vitest';
import asset from '../nodia-ai-runtime/config/runtime-policy.json' with { type: 'json' };
import type { NodiaAiRuntimePolicy } from '../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiAdapterRequest } from './types/nodia-ai-adapter.types.js';
import {
  executeApiChat,
  executeApiImage,
  apiJsonBounded,
  validateApiPayload,
  apiChatBody,
} from './api-nodia-ai-chat-transport.js';

const policy = asset.policy as unknown as NodiaAiRuntimePolicy;
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4a8AAAAASUVORK5CYII=';
function request(): NodiaAiAdapterRequest {
  return {
    selection: {
      connection_id: '9007199254740993',
      mode: 'api_key',
      model_id: 'fixture-discovered-model',
      effort_id: 'low',
    },
    attemptId: 'a87b3197-5968-473f-8e5e-c6b4935b6771',
    deadlineAt: new Date(Date.now() + 10000),
    canonicalPrompt: 'Synthetic request',
    resourceKey: 'api-connection:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
    configurationGeneration: 'c'.repeat(64),
    tools: [
      {
        name: 'read_fixture',
        description: 'Synthetic read',
        inputSchema: {
          type: 'object',
          properties: { x: { type: ['number', 'null'] } },
          additionalProperties: false,
        },
      },
    ],
    onLeaseCheck: vi.fn().mockResolvedValue(undefined),
    onProtocolProgress: vi.fn().mockResolvedValue(undefined),
    onToolCall: vi.fn().mockResolvedValue({ zero: 0, unknown: null }),
  };
}
function openAiAnswer(text = 'success') {
  return {
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text }],
      },
    ],
  };
}
const json = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
function run(
  provider: 'openai' | 'gemini',
  req = request(),
  overrides: Partial<Parameters<typeof executeApiChat>[0]> = {},
) {
  const beforeExchange = vi.fn().mockResolvedValue(undefined);
  return {
    beforeExchange,
    result: executeApiChat({
      provider,
      request: req,
      secret: 'synthetic-secret',
      policy,
      signal: new AbortController().signal,
      beforeExchange,
      ...overrides,
    }),
  };
}
afterEach(() => vi.unstubAllGlobals());

describe('API chat transport: exact stateless function calling', () => {
  it.each([undefined, []])(
    'omits only explicit empty Gemini parameters on the wire, preserving the original strict Server descriptor (required=%j)',
    (required) => {
      const req = request();
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {},
        ...(required === undefined ? {} : { required }),
      };
      req.tools = [
        {
          name: 'zero_fixture',
          description: 'Synthetic zero argument read',
          inputSchema: schema,
        },
      ];
      const original = JSON.stringify(req.tools);
      const gemini = apiChatBody('gemini', req, []) as {
        tools: { functionDeclarations: unknown[] }[];
      };
      expect(gemini.tools[0].functionDeclarations).toEqual([
        { name: 'zero_fixture', description: 'Synthetic zero argument read' },
      ]);
      expect(JSON.stringify(req.tools)).toBe(original);
      const openai = apiChatBody('openai', req, []) as {
        tools: { parameters: unknown }[];
      };
      expect(openai.tools[0].parameters).toEqual(schema);
    },
  );
  it('preserves nonempty/composed Gemini JSON schemas exactly instead of guessing them parameterless', () => {
    const req = request();
    const nonempty = req.tools![0].inputSchema;
    const composed = {
      type: 'object',
      properties: {},
      additionalProperties: false,
      allOf: [{ required: ['fixture'] }],
    };
    req.tools = [
      ...req.tools!,
      {
        name: 'composed_fixture',
        description: 'Synthetic constrained schema',
        inputSchema: composed,
      },
    ];
    const wire = apiChatBody('gemini', req, []) as {
      tools: { functionDeclarations: { parametersJsonSchema: unknown }[] }[];
    };
    expect(
      wire.tools[0].functionDeclarations.map(
        (item) => item.parametersJsonSchema,
      ),
    ).toEqual([nonempty, composed]);
  });
  it('normalizes an absent Gemini args Struct only for the exact zero-argument descriptor and retains the signed model Content', async () => {
    const req = request();
    req.tools = [
      {
        name: 'zero_fixture',
        description: 'Synthetic zero argument read',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    ];
    const content = {
      role: 'model',
      parts: [
        {
          functionCall: { name: 'zero_fixture', id: 'zero_one' },
          thoughtSignature: 'opaque-signature',
        },
      ],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({ candidates: [{ finishReason: 'STOP', content }] }),
      )
      .mockResolvedValueOnce(
        json({
          candidates: [
            {
              finishReason: 'STOP',
              content: { role: 'model', parts: [{ text: 'success' }] },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await run('gemini', req).result).toBe('success');
    expect(req.onToolCall).toHaveBeenCalledWith(
      { callId: 'zero_one', name: 'zero_fixture', arguments: {} },
      expect.any(AbortSignal),
    );
    const continuation = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(continuation.contents[1]).toEqual(content);
    expect(
      continuation.tools[0].functionDeclarations[0].parametersJsonSchema,
    ).toBeUndefined();
  });
  it.each([
    'null',
    'array',
    'unknown_field',
    'required_absent',
    'required_empty',
  ] as const)(
    'does not forward invalid Gemini args to the gateway: %s',
    async (invalid) => {
      const req = request();
      const requires = invalid.startsWith('required');
      req.tools = [
        {
          name: 'read_fixture',
          description: 'Synthetic closed read',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: requires ? { required_field: { type: 'string' } } : {},
            ...(requires ? { required: ['required_field'] } : {}),
          },
        },
      ];
      const fn = {
        name: 'read_fixture',
        ...(invalid === 'required_absent'
          ? {}
          : {
              args:
                invalid === 'null'
                  ? null
                  : invalid === 'array'
                    ? []
                    : invalid === 'unknown_field'
                      ? { injected: true }
                      : {},
            }),
      };
      const fetcher = vi.fn().mockResolvedValue(
        json({
          candidates: [
            {
              finishReason: 'STOP',
              content: { role: 'model', parts: [{ functionCall: fn }] },
            },
          ],
        }),
      );
      vi.stubGlobal('fetch', fetcher);
      await expect(run('gemini', req).result).rejects.toMatchObject({
        code: 'mcp_call_invalid',
      });
      expect(req.onToolCall).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it('preserves every OpenAI output item including encrypted reasoning and sends exact callback output without storage or remote tools', async () => {
    const output = [
      {
        type: 'reasoning',
        id: 'rs_fixture',
        encrypted_content: 'opaque-test-cipher',
        summary: [],
      },
      {
        type: 'function_call',
        call_id: 'call_fixture',
        name: 'read_fixture',
        arguments: '{"x":0}',
        id: 'fc_fixture',
      },
    ];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ status: 'completed', output }))
      .mockResolvedValueOnce(json(openAiAnswer()));
    vi.stubGlobal('fetch', fetcher);
    const req = request();
    const execution = run('openai', req);
    expect(await execution.result).toBe('success');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(execution.beforeExchange).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    const body = JSON.parse(init.body);
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.redirect).toBe('error');
    expect(body).toMatchObject({
      model: 'fixture-discovered-model',
      store: false,
      include: ['reasoning.encrypted_content'],
      reasoning: { effort: 'low' },
      parallel_tool_calls: false,
    });
    expect(body.previous_response_id).toBeUndefined();
    expect(body.tools.map((tool: { type: string }) => tool.type)).toEqual([
      'function',
    ]);
    expect(body.input.slice(1, 3)).toEqual(output);
    expect(body.input[3]).toEqual({
      type: 'function_call_output',
      call_id: 'call_fixture',
      output: '{"zero":0,"unknown":null}',
    });
    expect(req.onToolCall).toHaveBeenCalledWith(
      { callId: 'call_fixture', name: 'read_fixture', arguments: { x: 0 } },
      expect.any(AbortSignal),
    );
  });

  it('returns Gemini full model Content intact, keeping signatures on their original parts and matching parallel IDs in order', async () => {
    const content = {
      role: 'model',
      parts: [
        {
          functionCall: { id: 'id_1', name: 'read_fixture', args: { x: null } },
          thoughtSignature: 'opaque-signature',
        },
        { functionCall: { id: 'id_2', name: 'read_fixture', args: { x: 0 } } },
      ],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({ candidates: [{ finishReason: 'STOP', content }] }),
      )
      .mockResolvedValueOnce(
        json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                role: 'model',
                parts: [
                  { thought: true, text: 'private thought' },
                  { text: 'success' },
                ],
              },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await run('gemini').result).toBe('success');
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.contents[1]).toEqual(content);
    expect(body.contents[2]).toEqual({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'read_fixture',
            id: 'id_1',
            response: { zero: 0, unknown: null },
          },
        },
        {
          functionResponse: {
            name: 'read_fixture',
            id: 'id_2',
            response: { zero: 0, unknown: null },
          },
        },
      ],
    });
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('LOW');
    expect(
      body.tools[0].functionDeclarations[0].parametersJsonSchema
        .additionalProperties,
    ).toBe(false);
  });

  it.each([400, 401, 403, 429, 500, 503])(
    'never retries/falls back or leaks the upstream body on HTTP %i',
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          new Response('synthetic-secret echoed confidential', { status }),
        );
      vi.stubGlobal('fetch', fetcher);
      await expect(run('openai').result).rejects.toMatchObject({
        outcome: 'unknown',
      });
      expect(fetcher).toHaveBeenCalledOnce();
      await expect(run('openai').result).rejects.not.toThrow(
        'synthetic-secret',
      );
    },
  );

  it('rejects all calls before the first callback if any name or ID is invalid', async () => {
    const req = request();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          status: 'completed',
          output: [
            {
              type: 'function_call',
              name: 'read_fixture',
              call_id: 'same',
              arguments: '{}',
            },
            {
              type: 'function_call',
              name: 'shell',
              call_id: 'bad',
              arguments: '{}',
            },
          ],
        }),
      ),
    );
    await expect(run('openai', req).result).rejects.toMatchObject({
      code: 'mcp_call_invalid',
    });
    expect(req.onToolCall).not.toHaveBeenCalled();
  });

  it('enforces durable exchange reservation before POST and performs no network call when it refuses', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      run('openai', request(), {
        beforeExchange: async () => {
          throw Error('budget');
        },
      }).result,
    ).rejects.toThrow('budget');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not continue after a tool gateway rejection', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        status: 'completed',
        output: [
          {
            type: 'function_call',
            call_id: 'call_one',
            name: 'read_fixture',
            arguments: '{}',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const req = request();
    req.onToolCall = vi.fn().mockRejectedValue(Error('gateway_refused'));
    await expect(run('openai', req).result).rejects.toThrow('gateway_refused');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('stops on explicit capability selection ACK without an unnecessary paid continuation', async () => {
    const req = request();
    req.tools = [
      {
        name: 'nodia_capabilities_select',
        description: 'Selection fixture',
        inputSchema: { type: 'object', additionalProperties: false },
      },
    ];
    req.onToolCall = vi.fn().mockResolvedValue({
      status: 'selection_requested',
      next_action: 'finish_current_generation',
      business_effects: false,
      selected_capability_ids: ['read_fixture'],
    });
    const fetcher = vi.fn().mockResolvedValue(
      json({
        status: 'completed',
        output: [
          {
            type: 'function_call',
            call_id: 'selection',
            name: 'nodia_capabilities_select',
            arguments:
              '{"catalog_version":"fixture","capability_ids":["read_fixture"]}',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    expect(await run('openai', req).result).toBe('');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  const ocrInput = {
    action: 'request',
    analysis_id: 'b87b3197-5968-473f-8e5e-c6b4935b6771',
    provider_id: '7',
  };
  const ocrResult = () => ({
    status: 'requested',
    analysis_id: ocrInput.analysis_id,
    request_id: 'c87b3197-5968-473f-8e5e-c6b4935b6771',
    business_id: 'd87b3197-5968-473f-8e5e-c6b4935b6771',
    attachment_id: 'e87b3197-5968-473f-8e5e-c6b4935b6771',
    provider_id: '7',
    review_required: true,
    compare_prices: true,
    comparison_observed_at: null,
    selection: request().selection,
    source: {
      attachment_id: 'e87b3197-5968-473f-8e5e-c6b4935b6771',
      kind: 'pdf',
      media_type: 'application/pdf',
      byte_count: 43102,
    },
  });
  const ocrCall = () => ({
    type: 'function_call',
    call_id: 'ocr_request',
    name: 'nodia_invoices_ocr',
    arguments: JSON.stringify(ocrInput),
  });
  const ocrRequest = () => {
    const req = request();
    req.tools = [
      {
        name: 'nodia_invoices_ocr',
        description: 'OCR fixture',
        inputSchema: { type: 'object', additionalProperties: false },
      },
    ];
    return req;
  };

  it.each(['openai', 'gemini'] as const)(
    'hands a closed exact OCR request to the worker without a discarded narrative POST (%s)',
    async (provider) => {
      const req = ocrRequest();
      req.onToolCall = vi.fn().mockResolvedValue(ocrResult());
      const body =
        provider === 'openai'
          ? { status: 'completed', output: [ocrCall()] }
          : {
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    role: 'model',
                    parts: [
                      {
                        functionCall: {
                          name: 'nodia_invoices_ocr',
                          args: ocrInput,
                        },
                      },
                    ],
                  },
                },
              ],
            };
      const fetcher = vi.fn().mockResolvedValue(json(body));
      vi.stubGlobal('fetch', fetcher);
      const result = run(provider, req);
      expect(await result.result).toBe('');
      expect(fetcher).toHaveBeenCalledOnce();
      expect(result.beforeExchange).toHaveBeenCalledOnce();
      expect(req.onToolCall).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ['analysis', { analysis_id: 'f87b3197-5968-473f-8e5e-c6b4935b6771' }],
    ['provider', { provider_id: '8' }],
    ['review', { review_required: false }],
    [
      'selection',
      { selection: { ...request().selection, model_id: 'another-model' } },
    ],
    ['extra', { business_effects: false }],
    ['status', { status: 'analyzed' }],
    ['missing_request', { request_id: null }],
  ])(
    'does not short-circuit a nonmatching or forged OCR receipt (%s)',
    async (_label, patch) => {
      const req = ocrRequest();
      req.onToolCall = vi.fn().mockResolvedValue({ ...ocrResult(), ...patch });
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          json({ status: 'completed', output: [ocrCall()] }),
        )
        .mockResolvedValueOnce(json(openAiAnswer()));
      vi.stubGlobal('fetch', fetcher);
      expect(await run('openai', req).result).toBe('success');
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it('processes every callback in an OCR batch and continues rather than dropping pending work', async () => {
    const req = ocrRequest();
    req.tools = [...req.tools!, ...request().tools!];
    req.onToolCall = vi
      .fn()
      .mockResolvedValueOnce(ocrResult())
      .mockResolvedValueOnce({ zero: 0 });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          status: 'completed',
          output: [
            ocrCall(),
            {
              type: 'function_call',
              call_id: 'read_other',
              name: 'read_fixture',
              arguments: '{}',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json(openAiAnswer()));
    vi.stubGlobal('fetch', fetcher);
    expect(await run('openai', req).result).toBe('success');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(req.onToolCall).toHaveBeenCalledTimes(2);
  });

  it('does not hand off an OCR callback whose gateway failed or whose HTTP response is incomplete', async () => {
    const req = ocrRequest();
    req.onToolCall = vi.fn().mockRejectedValue(Error('gateway_rejected'));
    const fetcher = vi
      .fn()
      .mockResolvedValue(json({ status: 'completed', output: [ocrCall()] }));
    vi.stubGlobal('fetch', fetcher);
    await expect(run('openai', req).result).rejects.toThrow('gateway_rejected');
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockResolvedValue(
      json({ status: 'incomplete', output: [ocrCall()] }),
    );
    await expect(run('openai', req).result).rejects.toBeDefined();
    expect(req.onToolCall).toHaveBeenCalledOnce();
  });

  it('bounds streamed response bytes before JSON parsing and cancels its reader', async () => {
    let cancelled = false;
    const body = new ReadableStream({
      pull(c) {
        c.enqueue(new Uint8Array(policy.results.provider_stream_bytes + 1));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(run('openai').result).rejects.toMatchObject({
      code: 'api_response_limit',
    });
    expect(cancelled).toBe(true);
  });
  it.each([
    openAiAnswer(''),
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ type: 'web_search_call' }] },
  ])('rejects incomplete/empty/hosted-tool output', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(response)));
    await expect(run('openai').result).rejects.toBeDefined();
  });
  it('enforces argument JSON depth and preserves real zero/null', () => {
    expect(apiJsonBounded({ a: 0, b: null }, 100, policy)).toBe(
      '{"a":0,"b":null}',
    );
    let nested: unknown = 0;
    for (let i = 0; i < policy.results.json_depth + 2; i++)
      nested = { next: nested };
    expect(() => apiJsonBounded(nested, 10000, policy)).toThrow(
      'api_json_limit',
    );
  });
  it('cannot request image generation together with tools or originals', () => {
    expect(() =>
      validateApiPayload(
        { ...request(), imageGeneration: { prompt: 'fixture' } },
        policy,
      ),
    ).toThrow('adapter_invalid_request');
  });
  it.each(['openai', 'gemini'] as const)(
    'has a separate explicit image lane with exact model and one reserved POST (%s)',
    async (provider) => {
      const fetcher = vi.fn().mockResolvedValue(
        json(
          provider === 'openai'
            ? { data: [{ b64_json: png }] }
            : {
                candidates: [
                  {
                    finishReason: 'STOP',
                    content: {
                      role: 'model',
                      parts: [
                        { inlineData: { mimeType: 'image/png', data: png } },
                      ],
                    },
                  },
                ],
              },
        ),
      );
      vi.stubGlobal('fetch', fetcher);
      const req = request();
      req.tools = [];
      req.imageGeneration = { prompt: 'Explicit synthetic image' };
      req.selection.effort_id = null;
      const reserve = vi.fn();
      const result = await executeApiImage({
        provider,
        request: req,
        secret: 'synthetic-secret',
        policy,
        signal: new AbortController().signal,
        beforeExchange: reserve,
      });
      expect(result.generatedImage.mediaType).toBe('image/png');
      expect(result.generatedImage.contentBase64).toBe(png);
      expect(reserve).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0][0]).toBe(
        provider === 'openai'
          ? 'https://api.openai.com/v1/images/generations'
          : 'https://generativelanguage.googleapis.com/v1beta/models/fixture-discovered-model:generateContent',
      );
      const body = JSON.parse(fetcher.mock.calls[0][1].body);
      expect(body.tools).toBeUndefined();
      if (provider === 'openai')
        expect(body.model).toBe('fixture-discovered-model');
    },
  );
});
