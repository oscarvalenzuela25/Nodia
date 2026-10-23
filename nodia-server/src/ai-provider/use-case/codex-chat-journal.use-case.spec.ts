import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import {
  CodexChatJournal,
  type CodexChatRecord,
} from '../../common/ai/codex/codex-chat-journal.js';
import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import { ReconcileCodexNodiaAiRuntimeUseCase } from '../../nodia-ai-adapter/use-case/reconcile-codex-nodia-ai-runtime.use-case.js';

vi.mock('../../common/ai/codex/codex-process-ownership.js', () => ({
  sameCodexProcess: vi.fn(async () => false),
  stopCodexGroup: vi.fn(async () => undefined),
}));
function record(): CodexChatRecord {
  const attempt = '11111111-1111-4111-8111-111111111111';
  const certificate = {
    pid: 222,
    group: 222,
    birth: '1234',
    boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  };
  return {
    version: 1,
    identity: {
      engine: 'agentic',
      attemptId: attempt,
      operationRef: attempt,
      resourceKey: `codex-profile:${'a'.repeat(64)}`,
      sessionGeneration: 'b'.repeat(32),
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId: '4',
      },
    },
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    owner: certificate,
    native: certificate,
    state: 'completed',
    payloadSha256: 'c'.repeat(64),
    rpcCount: 2,
    frames: 5,
    bytes: 100,
    unforwardedRequests: 1,
    cancelRequested: false,
    terminalProofId: '22222222-2222-4222-8222-222222222222',
    observedAt: new Date(Date.now() - 1000).toISOString(),
    acknowledged: false,
  };
}
function fixture(patch: Record<string, unknown> = {}) {
  const original = record();
  let raw = JSON.stringify({ ...original, ...patch });
  const journal = new CodexChatJournal();
  // Only disk transport is synthetic. The persisted JSON parser, journal schema,
  // runtime identity binding and public reconciliation use case remain real.
  vi.spyOn(journal, 'read').mockImplementation(async () =>
    journal.decode(JSON.parse(raw)),
  );
  vi.spyOn(journal, 'locked').mockImplementation(async (_id, work) => work());
  vi.spyOn(journal, 'write').mockImplementation(async (value) => {
    journal.decode(value);
    raw = JSON.stringify(value);
  });
  const native = {
    recoverClosedChat: vi.fn(),
  } as unknown as CodexRuntimeService;
  const source = { manager: { query: vi.fn() } } as unknown as DataSource;
  const useCase = new ReconcileCodexNodiaAiRuntimeUseCase(
    new CodexChatRuntime(native, journal),
    source,
  );
  return {
    original,
    journal,
    native,
    source,
    reconcile: () =>
      useCase.reconcile(original.identity, new AbortController().signal),
  };
}
describe('Codex reconciliation use case with the real persisted-journal contract', () => {
  it('returns an exact closed proof from a minimal identity-bound persisted record without provider or SQL work', async () => {
    const f = fixture();
    expect(await f.reconcile()).toEqual({
      ...f.original.identity,
      terminalProofId: f.original.terminalProofId,
      outcome: 'completed',
      processClosed: true,
      observedAt: new Date(f.original.observedAt!),
    });
    expect(f.native.recoverClosedChat).not.toHaveBeenCalled();
    expect(f.source.manager.query).not.toHaveBeenCalled();
  });
  it.each(['prompt', 'catalog', 'arguments', 'auth', 'result', 'actorToken'])(
    'rejects extra persisted content-bearing key %s before any closure claim',
    async (key) => {
      const f = fixture({ [key]: 'synthetic-private-content' });
      await expect(f.reconcile()).rejects.toBeDefined();
      expect(f.native.recoverClosedChat).not.toHaveBeenCalled();
    },
  );
  it.each([
    { expiresAt: 2026 },
    { observedAt: 2026 },
    {
      owner: {
        pid: 222,
        group: 222,
        birth: 1234,
        boot: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      },
    },
    { owner: { pid: 222, group: 222, birth: '1234', boot: 'a'.repeat(36) } },
  ])(
    'rejects persisted scalar coercion or a malformed process certificate %#',
    async (patch) => {
      const f = fixture(patch);
      await expect(f.reconcile()).rejects.toBeDefined();
      expect(f.native.recoverClosedChat).not.toHaveBeenCalled();
    },
  );
  it.each([
    { rpcCount: 6 },
    { unforwardedRequests: 3 },
    { rpcCount: -1 },
    { frames: 10002 },
    { bytes: -1 },
    {
      acknowledged: true,
      state: 'submitted',
      terminalProofId: null,
      observedAt: null,
    },
  ])(
    'keeps inconsistent persisted counters and premature ACKs in quarantine %#',
    async (patch) => {
      const f = fixture(patch);
      await expect(f.reconcile()).rejects.toBeDefined();
      expect(f.native.recoverClosedChat).not.toHaveBeenCalled();
    },
  );
  it('does not infer closure from a dead supervisor whose reserved attempt has no native certificate', async () => {
    const f = fixture({
      state: 'reserved',
      native: null,
      terminalProofId: null,
      observedAt: null,
    });
    await expect(f.reconcile()).rejects.toMatchObject({
      code: 'codex_login_unknown',
    });
    expect(f.native.recoverClosedChat).not.toHaveBeenCalled();
  });
  it('accepts the persisted supervisor rollback receipt without inventing a native process', async () => {
    const f = fixture({ state: 'abandoned_unknown', native: null });
    expect(await f.reconcile()).toMatchObject({
      outcome: 'abandoned_unknown',
      processClosed: true,
    });
    expect(f.native.recoverClosedChat).not.toHaveBeenCalled();
  });
  it('recovers the closed attempt with its truthful over-limit byte counter while rejecting an unsafe numeric counter', async () => {
    const f = fixture({ bytes: 18 * 1024 * 1024 + 65536 });
    expect(await f.reconcile()).toMatchObject({ processClosed: true });
    expect(
      await vi.mocked(f.journal.read).mock.results[0]!.value,
    ).toMatchObject({ bytes: 18 * 1024 * 1024 + 65536 });
    await expect(
      fixture({ bytes: Number.MAX_SAFE_INTEGER + 1 }).reconcile(),
    ).rejects.toBeDefined();
  });
});
