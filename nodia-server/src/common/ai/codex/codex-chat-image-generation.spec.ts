import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodexChatRuntime } from './codex-chat-runtime.js';
import { CodexChatJournal, type CodexChatRecord } from './codex-chat-journal.js';
import type { CodexRuntimeService } from './codex-runtime.service.js';
import type { CodexChatRequest } from './codex-chat-contract.js';

vi.mock('./codex-process-ownership.js', () => ({
  codexProcessIdentity: vi.fn(async () => ({ pid: 222, group: 222, birth: '123', boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })),
}));
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=';
const image = () => ({ type: 'imageGeneration', id: 'one', status: 'completed', result: png });
function fixture(items: Record<string, unknown>[] = [image()]) {
  let stored: CodexChatRecord | null = null;
  const journal = new CodexChatJournal();
  const input: CodexChatRequest = {
    identity: { engine: 'agentic', attemptId: '11111111-1111-4111-8111-111111111111', operationRef: '11111111-1111-4111-8111-111111111111',
      resourceKey: 'codex-profile:' + 'a'.repeat(64), sessionGeneration: 'b'.repeat(32),
      adapterIdentity: { providerKey: 'openai', connectionId: '42', contractVersion: 'nodia-ai-codex-chat/1' } },
    modelId: 'fixture-discovered-model', effort: 'fixture-effort', prompt: 'Synthetic illustration',
    imageGeneration: { prompt: 'Synthetic illustration' }, tools: [],
    deadlineAt: new Date(Date.now() + 10000), signal: new AbortController().signal,
    limits: { requests: 30, toolCalls: 5, argumentUtf8Bytes: 1000, resultUtf8Bytes: 1000, jsonDepth: 10, collectionItems: 100 },
  };
  vi.spyOn(journal, 'identity').mockResolvedValue({ resourceKey: input.identity.resourceKey, runtimeSessionId: input.identity.sessionGeneration });
  vi.spyOn(journal, 'read').mockImplementation(async () => stored ? structuredClone(stored) : null);
  vi.spyOn(journal, 'locked').mockImplementation(async (_id, work) => work());
  vi.spyOn(journal, 'reserve').mockImplementation(async (value) => { journal.decode(value); stored = structuredClone(value); });
  vi.spyOn(journal, 'write').mockImplementation(async (value) => { journal.decode(value); stored = structuredClone(value); });
  const rpc = Object.assign(new EventEmitter(), {
    alive: true, allowImageGenerationOutput: vi.fn(),
    observeProtocol: vi.fn(() => async () => undefined),
    openChatToolChannel: vi.fn(() => () => undefined),
    request: vi.fn(async (method: string, _params: unknown) => {
      if (method === 'thread/start') return { thread: { id: 'thread' } };
      if (method === 'turn/start') {
        expect(stored?.state).toBe('submitted');
        for (const item of items) rpc.emit('notification', 'item/completed', { threadId: 'thread', turnId: 'turn', item });
        rpc.emit('notification', 'turn/completed', { threadId: 'thread', turn: { id: 'turn', status: 'completed' } });
        return { turn: { id: 'turn' } };
      }
      return {};
    }),
  });
  const release = vi.fn(() => expect(stored?.terminalProofId).not.toBeNull());
  const runtime = {
    acquireChat: vi.fn(async (_id: string, _signal: AbortSignal,
      beforeStart: (identity: object, rpc: unknown) => Promise<void>) => {
      await beforeStart({ pid: 333, group: 333, birth: '456', boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, rpc);
      return { profile: { rpc, lastInferenceAt: null }, release };
    }),
    observe: vi.fn(async () => ({ available: true, authenticated: true, usageAllowed: null })),
    listModels: vi.fn(async () => [{ id: input.modelId, supportedReasoningEfforts: [input.effort] }]),
    stop: vi.fn(async () => undefined),
  };
  const callbacks = { onPrepared: vi.fn(async () => undefined), assertLease: vi.fn(async () => undefined),
    onProtocolProgress: vi.fn(async () => undefined), onToolCall: vi.fn(async () => { throw Error('forbidden'); }) };
  return { input, rpc, callbacks, runtime, release, stored: () => stored,
    chat: new CodexChatRuntime(runtime as unknown as CodexRuntimeService, journal) };
}
afterEach(() => vi.restoreAllMocks());
describe('opt-in native image generation ownership', () => {
  it('preserves exact model/effort and terminal journal before release, without MCP', async () => {
    const f = fixture();
    const reply = await f.chat.execute(f.input, f.callbacks);
    expect(reply.generatedImage).toMatchObject({ contentBase64: png, mediaType: 'image/png' });
    expect(reply.text).toBe('');
    expect(reply.terminalProof).toMatchObject({ outcome: 'completed', processClosed: true });
    expect(f.rpc.request.mock.calls.find(([method]) => method === 'thread/start')?.[1])
      .toMatchObject({ model: f.input.modelId, dynamicTools: [], config: { 'features.image_generation': true } });
    expect(f.rpc.request.mock.calls.find(([method]) => method === 'turn/start')?.[1])
      .toMatchObject({ model: f.input.modelId, effort: f.input.effort, sandboxPolicy: { type: 'readOnly', networkAccess: false } });
    expect(f.rpc.allowImageGenerationOutput).toHaveBeenCalledOnce();
    expect(f.callbacks.onToolCall).not.toHaveBeenCalled();
    expect(f.runtime.stop).toHaveBeenCalledOnce(); expect(f.release).toHaveBeenCalledOnce();
    expect(f.stored()?.acknowledged).toBe(false);
  });
  it.each([[image(), { ...image(), id: 'second' }], [image(), image()],
    [{ type: 'dynamicToolCall', id: 'forbidden' }], [], [{ ...image(), result: 'https://fixture.invalid/image' }]].map((items) => [items] as const))
    ('closes/quarantines failed image lane without a second turn', async (items) => {
      const f = fixture(items);
      await expect(f.chat.execute(f.input, f.callbacks)).rejects.toMatchObject({ outcome: 'unknown' });
      expect(f.rpc.request.mock.calls.filter(([method]) => method === 'turn/start')).toHaveLength(1);
      expect(f.stored()?.state).toBe('abandoned_unknown');
      expect(f.runtime.stop).toHaveBeenCalledOnce(); expect(f.release).toHaveBeenCalledOnce();
    });
  it('rejects imageGeneration outside opt-in without widening normal RPC', async () => {
    const f = fixture(); delete (f.input as { imageGeneration?: unknown }).imageGeneration;
    await expect(f.chat.execute(f.input, f.callbacks)).rejects.toMatchObject({ outcome: 'unknown' });
    expect(f.rpc.allowImageGenerationOutput).not.toHaveBeenCalled();
    expect(f.rpc.request.mock.calls[0][1]).toHaveProperty('config', { 'features.image_generation': false });
  });
  it('rejects tools or source attachments before reserving a generation', async () => {
    const f = fixture();
    Object.assign(f.input, { tools: [{ name: 'forbidden', description: 'fixture', inputSchema: { type: 'object', additionalProperties: false } }] });
    await expect(f.chat.execute(f.input, f.callbacks)).rejects.toMatchObject({ outcome: 'not_dispatched' });
    expect(f.stored()).toBeNull(); expect(f.runtime.acquireChat).not.toHaveBeenCalled();
  });
});
