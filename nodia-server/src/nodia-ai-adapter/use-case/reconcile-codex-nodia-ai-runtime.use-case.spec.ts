import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import { CodexChatReceiptAbsentError } from '../../common/ai/codex/codex-chat-contract.js';
import type { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import type {
  CodexChatJournal,
  CodexChatRecord,
} from '../../common/ai/codex/codex-chat-journal.js';
import { codexError } from '../../common/ai/codex/codex-contract.js';
import { ReconcileCodexNodiaAiRuntimeUseCase } from './reconcile-codex-nodia-ai-runtime.use-case.js';
import { terminalRuntimeProofDescriptor } from '../../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';
import type {
  NodiaAiCodexRuntimeProofRequest,
  NodiaAiRuntimeTerminalProof,
} from '../../nodia-ai-runtime/types/reconciliation.types.js';

function fixture() {
  const attemptId = randomUUID();
  const identity: NodiaAiCodexRuntimeProofRequest = {
    engine: 'agentic',
    attemptId,
    operationRef: attemptId,
    resourceKey: 'codex-profile:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
    adapterIdentity: {
      providerKey: 'openai',
      contractVersion: 'nodia-ai-codex-chat/1',
      connectionId: '9007199254740993',
    },
  };
  const proof: NodiaAiRuntimeTerminalProof = {
    ...identity,
    terminalProofId: randomUUID(),
    processClosed: true,
    outcome: 'completed',
    observedAt: new Date(),
  };
  const row = {
    id: randomUUID(),
    kind: 'reconcile',
    stage_key: 'reconcile_ack',
    state: 'leased',
    lease_owner: randomUUID(),
    lease_live: true,
    recovery_descriptor: terminalRuntimeProofDescriptor(proof),
  };
  const query = vi.fn().mockResolvedValue([row]);
  let stored: CodexChatRecord | null = {
    version: 1,
    identity,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    owner: { pid: 123, group: 123, birth: '123', boot: 'a'.repeat(36) },
    native: { pid: 124, group: 124, birth: '124', boot: 'a'.repeat(36) },
    state: 'completed',
    payloadSha256: 'c'.repeat(64),
    rpcCount: 1,
    frames: 2,
    bytes: 200,
    unforwardedRequests: 0,
    cancelRequested: false,
    terminalProofId: proof.terminalProofId,
    observedAt: proof.observedAt.toISOString(),
    acknowledged: false,
  };
  const journal = {
    admission: vi.fn(async <T>(work: () => Promise<T>) => work()),
    locked: vi.fn(async <T>(_attemptId: string, work: () => Promise<T>) =>
      work(),
    ),
    read: vi.fn(async () => stored),
    write: vi.fn(async (value: CodexChatRecord) => {
      stored = value;
    }),
    proof: vi.fn(() => proof),
  };
  const runtime = new CodexChatRuntime(
    {} as CodexRuntimeService,
    journal as unknown as CodexChatJournal,
  );
  const useCase = new ReconcileCodexNodiaAiRuntimeUseCase(runtime, {
    manager: { query },
  } as unknown as DataSource);
  const prune = () => {
    if (!stored?.acknowledged || Date.parse(stored.expiresAt) > Date.now())
      throw Error('Only acknowledged expired fixture receipts can be pruned');
    stored = null;
  };
  return {
    proof,
    row,
    query,
    journal,
    runtime,
    useCase,
    prune,
    stored: () => stored,
  };
}

describe('Codex native ACK recovery with a persisted SQL cleanup proof', () => {
  it('recovers lost native ACK response/SQL commit after receipt pruning using only the exact live cleanup proof', async () => {
    const f = fixture();
    await f.useCase.acknowledge(f.proof, new AbortController().signal);
    expect(f.stored()?.acknowledged).toBe(true);
    expect(f.query).not.toHaveBeenCalled();
    f.prune();
    await f.useCase.acknowledge(f.proof, new AbortController().signal);
    expect(f.query).toHaveBeenCalledOnce();
    expect(f.query.mock.calls[0][1]).toEqual([
      f.proof.attemptId,
      f.proof.terminalProofId,
    ]);
    expect(f.query.mock.calls[0][0]).toContain("stage_key='reconcile_ack'");
    expect(f.query.mock.calls[0][0]).toContain('lease_until>clock_timestamp()');
    expect(f.query.mock.calls[0][0]).not.toMatch(/UPDATE|DELETE|runtime_slots/);
    expect(f.journal.write).toHaveBeenCalledOnce();
  });
  it('keeps native receipt absence itself as an error without an authenticated SQL cleanup proof', async () => {
    const f = fixture();
    await f.runtime.acknowledge(f.proof, new AbortController().signal);
    f.prune();
    await expect(
      f.runtime.acknowledge(f.proof, new AbortController().signal),
    ).rejects.toBeInstanceOf(CodexChatReceiptAbsentError);
    f.query.mockResolvedValue([]);
    await expect(
      f.useCase.acknowledge(f.proof, new AbortController().signal),
    ).rejects.toThrow('cleanup_pending');
  });
  it.each([
    'lease_expired',
    'lease_owner_missing',
    'wrong_kind',
    'wrong_stage',
    'wrong_state',
    'duplicate_jobs',
  ])(
    'rejects absent native receipts when SQL cleanup metadata is %s',
    async (change) => {
      const f = fixture();
      await f.runtime.acknowledge(f.proof, new AbortController().signal);
      f.prune();
      if (change === 'lease_expired') f.row.lease_live = false;
      if (change === 'lease_owner_missing') f.row.lease_owner = '';
      if (change === 'wrong_kind') f.row.kind = 'turn';
      if (change === 'wrong_stage') f.row.stage_key = 'inference';
      if (change === 'wrong_state') f.row.state = 'waiting';
      if (change === 'duplicate_jobs')
        f.query.mockResolvedValue([f.row, { ...f.row, id: randomUUID() }]);
      await expect(
        f.useCase.acknowledge(f.proof, new AbortController().signal),
      ).rejects.toThrow('cleanup_pending');
    },
  );
  it.each([
    'other_attempt',
    'other_connection',
    'other_provider',
    'other_resource',
    'other_session',
    'other_proof',
    'other_outcome',
    'other_timestamp',
  ])('rejects SQL proof mismatch %s after native pruning', async (change) => {
    const f = fixture();
    await f.runtime.acknowledge(f.proof, new AbortController().signal);
    f.prune();
    const changed: NodiaAiRuntimeTerminalProof = {
      ...f.proof,
      adapterIdentity: { ...f.proof.adapterIdentity! },
    };
    if (change === 'other_attempt') {
      changed.attemptId = randomUUID();
      changed.operationRef = changed.attemptId;
    }
    if (change === 'other_connection')
      changed.adapterIdentity!.connectionId = '4';
    if (change === 'other_provider') {
      changed.adapterIdentity = undefined;
      changed.resourceKey = 'gemini-profile:' + 'a'.repeat(64);
    }
    if (change === 'other_resource')
      changed.resourceKey = 'codex-profile:' + 'd'.repeat(64);
    if (change === 'other_session') changed.sessionGeneration = 'd'.repeat(32);
    if (change === 'other_proof') changed.terminalProofId = randomUUID();
    if (change === 'other_outcome') changed.outcome = 'abandoned_unknown';
    if (change === 'other_timestamp')
      changed.observedAt = new Date(changed.observedAt.getTime() - 1000);
    f.row.recovery_descriptor = terminalRuntimeProofDescriptor(changed);
    await expect(
      f.useCase.acknowledge(f.proof, new AbortController().signal),
    ).rejects.toThrow();
  });
  it('does not suppress native corruption or a mismatched present receipt even when SQL proof is valid', async () => {
    const f = fixture();
    f.journal.read.mockRejectedValueOnce(
      codexError('codex_login_unknown', 409),
    );
    await expect(
      f.useCase.acknowledge(f.proof, new AbortController().signal),
    ).rejects.toThrow();
    expect(f.query).not.toHaveBeenCalled();
    f.stored()!.identity = {
      ...f.stored()!.identity,
      resourceKey: 'codex-profile:' + 'd'.repeat(64),
    };
    await expect(
      f.useCase.acknowledge(f.proof, new AbortController().signal),
    ).rejects.toThrow();
    expect(f.query).not.toHaveBeenCalled();
  });
  it('does not use SQL absence recovery for cancellation or generic native errors', async () => {
    const f = fixture();
    await expect(
      f.useCase.acknowledge(f.proof, AbortSignal.abort()),
    ).rejects.toThrow();
    expect(f.query).not.toHaveBeenCalled();
    vi.spyOn(f.runtime, 'acknowledge').mockRejectedValueOnce(
      new Error('fixture private transport'),
    );
    await expect(
      f.useCase.acknowledge(f.proof, new AbortController().signal),
    ).rejects.toThrow('fixture private transport');
    expect(f.query).not.toHaveBeenCalled();
  });
});
