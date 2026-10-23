import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  CodexChatToolChannelUseCase,
  type CodexChatToolChannelOptions,
} from './codex-chat-tool-channel.use-case.js';
import type { CodexChatToolChannel } from '../../common/ai/codex/codex-chat-tool-channel.js';
import { CodexRpc } from '../../common/ai/codex/codex-rpc.js';
import { CODEX_SETTINGS } from '../../common/ai/codex/codex-contract.js';

const native = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({
  spawn: native.spawn,
  execFile: vi.fn(),
}));

const opened: CodexChatToolChannel[] = [];
afterEach(() => {
  for (const channel of opened.splice(0)) channel.close();
  vi.useRealTimers();
  vi.clearAllMocks();
});
function fixture(patch: Partial<CodexChatToolChannelOptions> = {}) {
  const controller = new AbortController();
  const assertLease = vi.fn(async (_signal: AbortSignal) => undefined);
  const beforeRequest = vi.fn(
    async (_count: number, _signal: AbortSignal) => undefined,
  );
  const onToolCall = vi.fn(
    async (_call: unknown, _signal: AbortSignal): Promise<unknown> => ({
      total: 0,
      unknown: null,
    }),
  );
  const options: CodexChatToolChannelOptions = {
    threadId: 'synthetic-thread',
    turnId: 'synthetic-turn',
    toolNames: ['nodia_synthetic_read'],
    deadlineAt: new Date(Date.now() + 10000),
    signal: controller.signal,
    limits: {
      requests: 10,
      toolCalls: 4,
      argumentUtf8Bytes: 512,
      resultUtf8Bytes: 512,
      jsonDepth: 8,
      collectionItems: 50,
    },
    assertLease,
    beforeRequest,
    onToolCall,
    ...patch,
  };
  const channel = new CodexChatToolChannelUseCase().execute(options);
  opened.push(channel);
  const request = (changes: Record<string, unknown> = {}) => ({
    threadId: 'synthetic-thread',
    turnId: 'synthetic-turn',
    callId: 'synthetic-call',
    namespace: null,
    tool: 'nodia_synthetic_read',
    arguments: { inactive: false },
    ...changes,
  });
  return {
    controller,
    assertLease,
    beforeRequest,
    onToolCall,
    options,
    channel,
    request,
  };
}
const dispatch = (
  f: ReturnType<typeof fixture>,
  changes: Record<string, unknown> = {},
  method = 'item/tool/call',
) => f.channel.handle(method, f.request(changes), 'synthetic-rpc');

describe('Codex chat tool channel use case', () => {
  it('accepts a complete 31-fragment knowledge index whose collections fit even when total nodes exceed 128', async () => {
    // Same schema/cardinality as the published index seen by super_admin.
    // No stored account, database, runtime asset or provider inference is used.
    const result = {
      release_id: 'f'.repeat(64),
      items: Array.from({ length: 31 }, (_, index) => ({
        id: `fixture-product-${index}:summary`,
        purpose: 'product_summary',
        sections: ['Resumen del producto'],
        sha256: 'a'.repeat(64),
        document_revision: 1,
        byte_length: 1234,
      })),
    };
    let nodes = 0;
    const count = (value: unknown) => {
      nodes++;
      if (value && typeof value === 'object')
        Object.values(value).forEach(count);
    };
    count(result);
    expect(nodes).toBe(251);
    const f = fixture({
      limits: {
        requests: 10,
        toolCalls: 4,
        argumentUtf8Bytes: 65536,
        resultUtf8Bytes: 65536,
        jsonDepth: 16,
        collectionItems: 128,
      },
    });
    f.onToolCall.mockResolvedValueOnce(result);
    expect(await dispatch(f)).toEqual({
      result: {
        success: true,
        contentItems: [{ type: 'inputText', text: JSON.stringify(result) }],
      },
    });
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
  });
  it('accepts independent full-sized argument collections without pooling their members', async () => {
    const f = fixture({
      limits: {
        requests: 10,
        toolCalls: 4,
        argumentUtf8Bytes: 65536,
        resultUtf8Bytes: 65536,
        jsonDepth: 16,
        collectionItems: 128,
      },
    });
    const argumentsValue = {
      first: Array.from({ length: 128 }, () => 0),
      second: Array.from({ length: 128 }, () => null),
    };
    expect(await dispatch(f, { arguments: argumentsValue })).toHaveProperty(
      'result.success',
      true,
    );
    expect(f.onToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ arguments: argumentsValue }),
      expect.any(AbortSignal),
    );
  });
  it.each(['array', 'object'] as const)(
    'rejects an output %s with 129 members while preserving the committed gateway result',
    async (kind) => {
      const f = fixture({
        limits: {
          requests: 10,
          toolCalls: 4,
          argumentUtf8Bytes: 65536,
          resultUtf8Bytes: 65536,
          jsonDepth: 16,
          collectionItems: 128,
        },
      });
      const collection =
        kind === 'array'
          ? Array.from({ length: 129 }, () => 0)
          : Object.fromEntries(
              Array.from({ length: 129 }, (_, index) => [`item_${index}`, 0]),
            );
      f.onToolCall.mockResolvedValueOnce({ collection });
      expect(await dispatch(f)).toHaveProperty('error.code', -32603);
      expect(f.onToolCall).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['array', 'object'] as const)(
    'rejects an input %s with 129 members before calling the gateway',
    async (kind) => {
      const f = fixture({
        limits: {
          requests: 10,
          toolCalls: 4,
          argumentUtf8Bytes: 65536,
          resultUtf8Bytes: 65536,
          jsonDepth: 16,
          collectionItems: 128,
        },
      });
      const collection =
        kind === 'array'
          ? Array.from({ length: 129 }, () => 0)
          : Object.fromEntries(
              Array.from({ length: 129 }, (_, index) => [`item_${index}`, 0]),
            );
      expect(await dispatch(f, { arguments: { collection } })).toHaveProperty(
        'error.code',
        -32600,
      );
      expect(f.onToolCall).not.toHaveBeenCalled();
      expect(f.beforeRequest).toHaveBeenCalledTimes(1);
    },
  );
  it('retains the exact UTF-8 ceiling across nested valid collections', async () => {
    const accepted = fixture();
    accepted.onToolCall.mockResolvedValueOnce({ text: 'ñ'.repeat(250) });
    expect(await dispatch(accepted)).toHaveProperty('result.success', true);
    const rejected = fixture();
    rejected.onToolCall.mockResolvedValueOnce({ text: 'ñ'.repeat(251) });
    expect(await dispatch(rejected)).toHaveProperty('error.code', -32603);
  });
  it.each([
    'getter',
    'array getter',
    'prototype',
    'non-finite',
    'depth',
  ] as const)(
    'withholds unsafe output %s without invoking accessors',
    async (kind) => {
      const f = fixture();
      const getter = vi.fn(() => 'private value');
      let value: unknown;
      if (kind === 'getter')
        value = Object.defineProperty({}, 'content', {
          enumerable: true,
          get: getter,
        });
      if (kind === 'array getter')
        value = {
          items: Object.defineProperty([0], '0', {
            enumerable: true,
            get: getter,
          }),
        };
      if (kind === 'prototype') value = { when: new Date(0) };
      if (kind === 'non-finite') value = { count: Infinity };
      if (kind === 'depth')
        value = { a: { b: { c: { d: { e: { f: { g: { h: null } } } } } } } };
      f.onToolCall.mockResolvedValueOnce(value);
      expect(await dispatch(f)).toHaveProperty('error.code', -32603);
      expect(getter).not.toHaveBeenCalled();
    },
  );
  it('returns the exact native text response without converting zero/null or executing a second call', async () => {
    const f = fixture();
    expect(await dispatch(f)).toEqual({
      result: {
        contentItems: [
          { type: 'inputText', text: '{"total":0,"unknown":null}' },
        ],
        success: true,
      },
    });
    expect(f.assertLease).toHaveBeenCalledTimes(3);
    expect(f.beforeRequest).toHaveBeenCalledWith(1, expect.any(AbortSignal));
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['other thread', { threadId: 'another-thread' }],
    ['other turn', { turnId: 'another-turn' }],
    ['unknown tool', { tool: 'shell' }],
    ['namespace', { namespace: 'apps' }],
    ['call id', { callId: '' }],
    ['extra key', { data: 'unexpected' }],
    ['string arguments', { arguments: '{}' }],
    ['array arguments', { arguments: [] }],
    ['missing arguments', { arguments: undefined }],
    ['oversized arguments', { arguments: { text: 'x'.repeat(513) } }],
    [
      'deep arguments',
      { arguments: { a: { b: { c: { d: { e: { f: { g: { h: {} } } } } } } } } },
    ],
    ['non-JSON arguments', { arguments: { n: Number.NaN } }],
  ])(
    'rejects %s before dispatch, while consuming the request budget',
    async (_name, changes) => {
      const f = fixture();
      expect(await dispatch(f, changes)).toHaveProperty('error.code', -32600);
      expect(f.onToolCall).not.toHaveBeenCalled();
      expect(f.beforeRequest).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects permissions/commands even with the chat channel enabled', async () => {
    const f = fixture();
    expect(
      await dispatch(f, {}, 'item/commandExecution/requestApproval'),
    ).toHaveProperty('error.code', -32600);
    expect(f.onToolCall).not.toHaveBeenCalled();
    expect(f.beforeRequest).toHaveBeenCalledTimes(1);
  });
  it('rejects a replay with a new RPC identity and never repeats the gateway', async () => {
    const f = fixture();
    await dispatch(f);
    expect(
      await f.channel.handle('item/tool/call', f.request(), 'different-rpc'),
    ).toHaveProperty('error.code', -32600);
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
    expect(f.beforeRequest).toHaveBeenCalledTimes(2);
  });
  it('serializes accepted calls and claims replay IDs before asynchronous work starts', async () => {
    const f = fixture();
    let finish: ((value: unknown) => void) | undefined;
    f.onToolCall.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = dispatch(f);
    const second = dispatch(f, { callId: 'second-call' });
    const replay = dispatch(f);
    await vi.waitFor(() => expect(f.onToolCall).toHaveBeenCalledTimes(1));
    finish?.({ first: true });
    expect(await first).toHaveProperty('result.success', true);
    expect(await second).toHaveProperty('result.success', true);
    expect(await replay).toHaveProperty('error.code', -32600);
    expect(f.onToolCall).toHaveBeenCalledTimes(2);
  });
  it('freezes arguments and catalog before an external mutation', async () => {
    const names = ['nodia_synthetic_read'];
    const f = fixture({ toolNames: names });
    const params = f.request();
    const pending = f.channel.handle('item/tool/call', params, 1);
    names.push('shell');
    (params.arguments as { inactive: boolean }).inactive = true;
    await pending;
    expect(f.onToolCall.mock.calls[0]?.[0]).toMatchObject({
      arguments: { inactive: false },
    });
    expect(await dispatch(f, { callId: 'new', tool: 'shell' })).toHaveProperty(
      'error.code',
      -32600,
    );
  });
  it('blocks dispatch after lease loss and keeps later calls closed', async () => {
    const f = fixture();
    f.assertLease.mockRejectedValueOnce(Error('private fence mismatch'));
    expect(await dispatch(f)).toEqual({
      error: { code: -32603, message: 'NodiaAI tool request failed' },
    });
    expect(await dispatch(f, { callId: 'second' })).toHaveProperty(
      'error.code',
      -32600,
    );
    expect(f.onToolCall).not.toHaveBeenCalled();
  });
  it('never dispatches after the durable budget hook rejects', async () => {
    const f = fixture();
    f.beforeRequest.mockRejectedValueOnce(Error('private SQL budget detail'));
    expect(await dispatch(f)).toHaveProperty('error.code', -32603);
    expect(f.onToolCall).not.toHaveBeenCalled();
  });
  it('withholds a result if the lease is lost during a callback', async () => {
    const f = fixture();
    f.assertLease
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Error('lost'));
    expect(await dispatch(f)).toHaveProperty('error.code', -32603);
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
  });
  it('aborts an in-flight callback and queued requests without replay or a false success', async () => {
    const f = fixture();
    f.onToolCall.mockImplementationOnce(() => new Promise(() => undefined));
    const first = dispatch(f);
    const second = dispatch(f, { callId: 'second' });
    await vi.waitFor(() => expect(f.onToolCall).toHaveBeenCalledTimes(1));
    f.controller.abort();
    expect(await first).toHaveProperty('error.code', -32603);
    expect(await second).toHaveProperty('error.code', -32603);
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
    expect(f.onToolCall.mock.calls[0]?.[1].aborted).toBe(true);
  });
  it('expires a stalled callback at the original immutable deadline', async () => {
    vi.useFakeTimers();
    const deadlineAt = new Date(Date.now() + 1000);
    const f = fixture({ deadlineAt });
    deadlineAt.setTime(Date.now() + 100000);
    f.onToolCall.mockImplementationOnce(() => new Promise(() => undefined));
    const pending = dispatch(f);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await pending).toHaveProperty('error.code', -32603);
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
  });
  it('blocks all dispatch for an already aborted owner', async () => {
    const controller = new AbortController();
    controller.abort();
    const f = fixture({ signal: controller.signal });
    expect(await dispatch(f)).toHaveProperty('error.code', -32600);
    expect(f.assertLease).not.toHaveBeenCalled();
  });
  it.each([
    ['oversized', { text: 'x'.repeat(513) }],
    ['not an object', []],
    ['non-JSON', { secret: undefined }],
    ['too many items', { list: Array.from({ length: 51 }, () => 1) }],
  ])('withholds %s output', async (_name, result) => {
    const f = fixture();
    f.onToolCall.mockResolvedValueOnce(result);
    expect(await dispatch(f)).toHaveProperty('error');
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
  });
  it('does not expose thrown gateway content or repeat failed callbacks', async () => {
    const f = fixture();
    f.onToolCall.mockRejectedValueOnce(
      Error('synthetic private document/token'),
    );
    expect(JSON.stringify(await dispatch(f))).not.toContain('private');
    expect(await dispatch(f)).toHaveProperty('error');
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
  });
  it('enforces the local request/call envelope in addition to the durable hook', async () => {
    const limits = {
      requests: 3,
      toolCalls: 1,
      argumentUtf8Bytes: 512,
      resultUtf8Bytes: 512,
      jsonDepth: 8,
      collectionItems: 50,
    };
    const f = fixture({ limits });
    expect(await dispatch(f)).toHaveProperty('result');
    expect(await dispatch(f, { callId: 'second' })).toHaveProperty('error');
    expect(await dispatch(f, { callId: 'third' })).toHaveProperty('error');
    expect(await dispatch(f, { callId: 'fourth' })).toHaveProperty('error');
    expect(f.beforeRequest).toHaveBeenCalledTimes(3);
    expect(f.onToolCall).toHaveBeenCalledTimes(1);
  });
  it('rejects duplicate catalogs and impossible resource policies before installing a channel', () => {
    expect(() =>
      fixture({ toolNames: ['nodia_read', 'nodia_read'] }),
    ).toThrow();
    expect(() => fixture({ deadlineAt: new Date(0) })).toThrow();
    expect(() =>
      fixture({
        limits: {
          requests: 0,
          toolCalls: 1,
          argumentUtf8Bytes: 512,
          resultUtf8Bytes: 512,
          jsonDepth: 8,
          collectionItems: 50,
        },
      }),
    ).toThrow();
  });
  it.each([
    {},
    {
      toolCalls: 1,
      argumentUtf8Bytes: 512,
      resultUtf8Bytes: 512,
      jsonDepth: 8,
      collectionItems: 50,
    },
    {
      requests: 10,
      toolCalls: 1,
      argumentUtf8Bytes: 512,
      resultUtf8Bytes: 512,
      collectionItems: 50,
    },
    {
      requests: 10,
      toolCalls: 1,
      argumentUtf8Bytes: 512,
      resultUtf8Bytes: 512,
      jsonDepth: 8,
      collectionItems: 50,
      extra: 1,
    },
  ])(
    'rejects a missing or extra resource-limit field at the runtime boundary',
    (limits) => {
      expect(() =>
        fixture({
          limits: limits as unknown as CodexChatToolChannelOptions['limits'],
        }),
      ).toThrow();
    },
  );
});

function nativePeer() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdio: [],
    pid: undefined,
    kill: vi.fn(() => {
      child.emit('close', 0);
      return true;
    }),
  });
  const sent: Record<string, unknown>[] = [];
  let input = '';
  child.stdin.on('data', (chunk: Buffer) => {
    input += chunk.toString('utf8');
    while (input.includes('\n')) {
      const end = input.indexOf('\n');
      const frame = JSON.parse(input.slice(0, end)) as Record<string, unknown>;
      input = input.slice(end + 1);
      sent.push(frame);
      if (frame.method === 'initialize' || frame.method === 'config/read') {
        const result =
          frame.method === 'config/read' ? { config: CODEX_SETTINGS } : {};
        queueMicrotask(() =>
          child.stdout.write(JSON.stringify({ id: frame.id, result }) + '\n'),
        );
      }
    }
  });
  native.spawn.mockReturnValue(child);
  const rpc = new CodexRpc(
    '/synthetic/peer',
    '/synthetic/work',
    '/synthetic/profile',
    '/synthetic/home',
  );
  const emit = (frame: unknown) => {
    const bytes = Buffer.from(JSON.stringify(frame) + '\n');
    for (let offset = 0; offset < bytes.length; offset += 7)
      child.stdout.write(bytes.subarray(offset, offset + 7));
  };
  return { child, sent, rpc, emit };
}
describe('Codex channel through the actual JSONL receiver with a synthetic process', () => {
  it('keeps default OCR rejection and initialize free of experimental capability', async () => {
    const peer = nativePeer();
    try {
      await peer.rpc.initialize();
      expect(peer.sent[0]?.params).not.toHaveProperty('capabilities');
      const f = fixture();
      expect(() => peer.rpc.openChatToolChannel(f.channel)).toThrow();
      peer.emit({ id: 's1', method: 'item/tool/call', params: f.request() });
      await vi.waitFor(() =>
        expect(peer.sent).toContainEqual({
          id: 's1',
          error: {
            code: -32601,
            message: 'Tools disabled for invoice extraction',
          },
        }),
      );
      expect(f.onToolCall).not.toHaveBeenCalled();
    } finally {
      await peer.rpc.close();
    }
  });
  it('requires explicit channel installation after experimental initialization and revokes it on dispose', async () => {
    const peer = nativePeer();
    try {
      await peer.rpc.initialize({ experimentalChatApi: true });
      expect(peer.sent[0]?.params).toHaveProperty(
        'capabilities.experimentalApi',
        true,
      );
      const f = fixture();
      peer.emit({
        id: 'before',
        method: 'item/tool/call',
        params: f.request(),
      });
      await vi.waitFor(() =>
        expect(peer.sent.some((m) => m.id === 'before')).toBe(true),
      );
      expect(f.onToolCall).not.toHaveBeenCalled();
      const dispose = peer.rpc.openChatToolChannel(f.channel);
      expect(() => peer.rpc.openChatToolChannel(f.channel)).toThrow();
      peer.emit({
        id: 'during',
        method: 'item/tool/call',
        params: f.request(),
      });
      await vi.waitFor(() =>
        expect(peer.sent.find((m) => m.id === 'during')).toHaveProperty(
          'result.success',
          true,
        ),
      );
      dispose();
      peer.emit({
        id: 'after',
        method: 'item/tool/call',
        params: f.request({ callId: 'second' }),
      });
      await vi.waitFor(() =>
        expect(peer.sent.find((m) => m.id === 'after')).toHaveProperty(
          'error.code',
          -32601,
        ),
      );
      expect(f.onToolCall).toHaveBeenCalledTimes(1);
    } finally {
      await peer.rpc.close();
    }
  });
  it('closes on duplicate in-flight RPC IDs and aborts the outstanding callback', async () => {
    const peer = nativePeer();
    try {
      await peer.rpc.initialize({ experimentalChatApi: true });
      const f = fixture();
      f.onToolCall.mockImplementationOnce(() => new Promise(() => undefined));
      peer.rpc.openChatToolChannel(f.channel);
      peer.emit({ id: 'same', method: 'item/tool/call', params: f.request() });
      await vi.waitFor(() => expect(f.onToolCall).toHaveBeenCalledTimes(1));
      peer.emit({
        id: 'same',
        method: 'item/tool/call',
        params: f.request({ callId: 'second' }),
      });
      await vi.waitFor(() => expect(peer.rpc.alive).toBe(false));
      expect(f.onToolCall).toHaveBeenCalledTimes(1);
      expect(f.onToolCall.mock.calls[0]?.[1].aborted).toBe(true);
      expect(peer.sent.some((m) => m.id === 'same')).toBe(false);
    } finally {
      await peer.rpc.close();
    }
  });
});
