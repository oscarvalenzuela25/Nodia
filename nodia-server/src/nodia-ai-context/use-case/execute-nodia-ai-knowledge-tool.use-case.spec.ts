import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ExecuteNodiaAiKnowledgeToolUseCase } from './execute-nodia-ai-knowledge-tool.use-case.js';
import {
  knowledgeHash,
  type LoadNodiaAiKnowledgeUseCase,
} from './load-nodia-ai-knowledge.use-case.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import type {
  NodiaAiClaim,
  NodiaAiStageContext,
} from '../../nodia-ai-runtime/types/worker.types.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { eventJournalFixture } from '../../nodia-ai-run/event-journal.fixture.js';
function fixture() {
  const policy = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as NodiaAiRuntimePolicy;
  const claim = {
    identity: { userId: '1', sessionId: 'synthetic-session' },
    attempt: { id: 'synthetic-attempt' },
    run: Object.assign(new NodiaAiRun(), {
      id: 'synthetic-run',
      conversation_id: 'synthetic-chat',
      context_manifest: {
        knowledge_release: 'release',
        module_routes: ['/finance'],
        fragments: [],
      },
    }),
  } as unknown as NodiaAiClaim;
  let stored: NodiaAiToolCall | null = null;
  const toolRepo = {
    findOneBy: vi.fn(async () => stored),
    save: vi.fn(async (row: NodiaAiToolCall) => {
      stored = row;
      return row;
    }),
  };
  const runRepo = {
    findOneByOrFail: vi.fn(async () => claim.run),
    save: vi.fn(async (row: NodiaAiRun) => row),
  };
  let reservedCalls = 0;
  const journal = eventJournalFixture();
  const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
    const eventResult = journal.query(sql, parameters);
    if (eventResult !== undefined) return eventResult;
    if (sql.includes('tool_calls_used=tool_calls_used+1')) {
      if (reservedCalls >= policy.budget.tool_calls_per_run) return [];
      reservedCalls++;
    }
    if (sql.includes('tool_calls_used=tool_calls_used+$3')) {
      const increment = parameters![2] as number;
      if (reservedCalls + increment > policy.budget.tool_calls_per_run)
        return [];
      reservedCalls += increment;
    }
    return [{ id: 'synthetic-run' }];
  });
  const manager = {
    query,
    getRepository: vi.fn((entity: unknown) =>
      entity === NodiaAiToolCall ? toolRepo : runRepo,
    ),
  } as unknown as EntityManager;
  const checkpoint = vi.fn(
    async (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
  );
  const context = {
    checkpoint,
    signal: new AbortController().signal,
    armDispatch: vi.fn(),
  } as unknown as NodiaAiStageContext;
  const authorize = {
    execute: vi.fn(async () => ({
      modules: [{ route: '/finance' }, { route: '/newly-assigned' }],
    })),
  };
  const knowledge = {
    manifest: { release_id: 'release' },
    index: vi.fn(() => [
      {
        id: 'finance:feature',
        sha256: knowledgeHash('Published synthetic knowledge'),
        document_revision: 3,
        purpose: 'feature_explanation',
        sections: ['Rules'],
        byte_length: 10,
      },
    ]),
    execute: vi.fn(() => ({
      fragments: [
        {
          id: 'finance:feature',
          sha256: knowledgeHash('Published synthetic knowledge'),
          text: 'Published synthetic knowledge',
        },
      ],
    })),
  };
  const subject = new ExecuteNodiaAiKnowledgeToolUseCase(
    knowledge as unknown as LoadNodiaAiKnowledgeUseCase,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    policy,
  );
  const call = {
    callId: 'synthetic-call-1',
    name: 'nodia_knowledge_get',
    arguments: { fragment_ids: ['finance:feature'] },
  };
  return {
    subject,
    claim,
    context,
    query,
    journal,
    checkpoint,
    manager,
    toolRepo,
    runRepo,
    authorize,
    knowledge,
    policy,
    call,
    reservedCalls: () => reservedCalls,
  };
}
describe('ExecuteNodiaAiKnowledgeToolUseCase', () => {
  it('revalidates scope within the fenced checkpoint, reads exact IDs and records source revisions without a prompt copy', async () => {
    const f = fixture();
    const result = await f.subject.execute(f.claim, f.context, f.call);
    expect(result.items).toEqual([
      {
        id: 'finance:feature',
        sha256: knowledgeHash('Published synthetic knowledge'),
        text: 'Published synthetic knowledge',
      },
    ]);
    expect(f.knowledge.execute).toHaveBeenCalledWith(
      ['/finance'],
      ['finance:feature'],
    );
    expect(f.knowledge.index).toHaveBeenCalledWith(['/finance']);
    expect(f.claim.run.context_manifest.fragments).toEqual([
      {
        id: 'finance:feature',
        sha256: knowledgeHash('Published synthetic knowledge'),
        document_revision: 3,
      },
    ]);
    expect(f.toolRepo.save.mock.calls[0][0].scope_manifest).toEqual({
      schema_version: 1,
      module_routes: ['/finance'],
    });
    expect(f.journal.events).toHaveLength(1);
    expect(f.journal.events[0].public_payload.kind).toBe('tool_completed');
    expect(JSON.stringify(f.journal.events)).not.toContain(
      'Published synthetic knowledge',
    );
  });
  it('charges each repeated call while recovering its result without reloading or storing the effect again', async () => {
    const f = fixture();
    const first = await f.subject.execute(f.claim, f.context, f.call),
      second = await f.subject.execute(f.claim, f.context, f.call);
    expect(second).toEqual(first);
    expect(f.knowledge.execute).toHaveBeenCalledOnce();
    expect(f.toolRepo.save).toHaveBeenCalledOnce();
    expect(f.reservedCalls()).toBe(2);
    expect(f.journal.events).toHaveLength(1);
  });
  it('rejects reusing the call identity with different arguments', async () => {
    const f = fixture();
    await f.subject.execute(f.claim, f.context, f.call);
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...f.call,
        arguments: { fragment_ids: ['other:feature'] },
      }),
    ).rejects.toThrow('nodia_ai:request_conflict');
  });
  it('does not replay knowledge from a module revoked after the first callback', async () => {
    const f = fixture();
    await f.subject.execute(f.claim, f.context, f.call);
    f.authorize.execute.mockResolvedValue({
      modules: [{ route: '/newly-assigned' }],
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'nodia_ai:request_conflict',
    );
    expect(f.reservedCalls()).toBe(2);
    expect(f.knowledge.execute).toHaveBeenCalledOnce();
  });
  it('rejects modified cached text and unexpected public fields before releasing knowledge again', async () => {
    const f = fixture();
    await f.subject.execute(f.claim, f.context, f.call);
    const cached = f.toolRepo.save.mock.calls[0][0].public_result!;
    cached.items = [
      {
        id: 'finance:feature',
        sha256: knowledgeHash('Published synthetic knowledge'),
        text: 'Injected text',
      },
    ];
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'invalid_tool_output',
    );
    cached.extra_secret = 'not public';
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'invalid_tool_output',
    );
    expect(f.knowledge.execute).toHaveBeenCalledOnce();
  });
  it('cannot expose arbitrary business tools, SQL, target modules or extra arguments', async () => {
    const f = fixture();
    for (const call of [
      { ...f.call, name: 'nodia_finance_movements_get' },
      {
        ...f.call,
        arguments: { fragment_ids: ['finance:feature'], sql: 'select *' },
      },
      {
        ...f.call,
        arguments: {
          fragment_ids: ['finance:feature'],
          module_routes: ['/admin'],
        },
      },
    ])
      await expect(f.subject.execute(f.claim, f.context, call)).rejects.toThrow(
        'nodia_ai:invalid_knowledge_request',
      );
    expect(f.reservedCalls()).toBe(3);
    expect(f.knowledge.execute).not.toHaveBeenCalled();
    expect(f.toolRepo.save).not.toHaveBeenCalled();
  });
  it('commits invalid argument costs before validation and preserves them when later work fails', async () => {
    const f = fixture();
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...f.call,
        arguments: { fragment_ids: [] },
      }),
    ).rejects.toThrow('nodia_ai:invalid_knowledge_request');
    expect(f.reservedCalls()).toBe(1);
    expect(f.checkpoint).toHaveBeenCalledTimes(1);
    f.knowledge.execute.mockImplementationOnce(() => {
      throw new Error('synthetic_read_failure');
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'synthetic_read_failure',
    );
    expect(f.reservedCalls()).toBe(2);
    expect(f.checkpoint).toHaveBeenCalledTimes(3);
    expect(f.toolRepo.save).not.toHaveBeenCalled();
  });
  it('enforces the common budget even when every request is invalid', async () => {
    const f = fixture();
    const invalid = { ...f.call, arguments: { forbidden: true } };
    for (let count = 0; count < f.policy.budget.tool_calls_per_run; count++)
      await expect(
        f.subject.execute(f.claim, f.context, invalid),
      ).rejects.toThrow('nodia_ai:invalid_knowledge_request');
    await expect(
      f.subject.execute(f.claim, f.context, invalid),
    ).rejects.toThrow('nodia_ai:execution_limit');
    expect(f.reservedCalls()).toBe(f.policy.budget.tool_calls_per_run);
    expect(f.knowledge.index).not.toHaveBeenCalled();
    expect(f.toolRepo.save).not.toHaveBeenCalled();
  });
  it('does not treat publication from another release as callable knowledge', async () => {
    const f = fixture();
    f.claim.run.context_manifest.knowledge_release = 'another-release';
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'nodia_ai:knowledge_release_changed',
    );
    expect(f.knowledge.execute).not.toHaveBeenCalled();
  });
  it('rejects exhausted tool budgets before reading files or publishing results', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([]);
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'nodia_ai:execution_limit',
    );
    expect(f.knowledge.execute).not.toHaveBeenCalled();
    expect(f.toolRepo.save).not.toHaveBeenCalled();
  });
  it('rejects an oversized tool result without a completed receipt or context sources', async () => {
    const f = fixture();
    f.knowledge.execute.mockReturnValueOnce({
      fragments: [
        {
          id: 'finance:feature',
          sha256: knowledgeHash('Published synthetic knowledge'),
          text: 'x'.repeat(f.policy.results.tool_result_utf8_bytes),
        },
      ],
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'nodia_ai:context_limit',
    );
    expect(f.toolRepo.save).not.toHaveBeenCalled();
    expect(f.claim.run.context_manifest.fragments).toEqual([]);
  });
  it('a lost checkpoint or revoked session cannot return even a cached tool result', async () => {
    const f = fixture();
    await f.subject.execute(f.claim, f.context, f.call);
    f.authorize.execute.mockRejectedValueOnce(new Error('revoked'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'revoked',
    );
    f.checkpoint.mockRejectedValueOnce(new Error('fence_lost'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'fence_lost',
    );
  });
  it('counts monotonic protocol deltas across attempts without resetting the common budget', async () => {
    const f = fixture();
    f.claim.run.context_manifest.mcp_rpc_progress = { 'synthetic-attempt': 4 };
    await f.subject.progress(f.claim, f.context, 7);
    expect(f.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('mcp_rpc_messages_used=mcp_rpc_messages_used+$2'),
      ['synthetic-run', 3, 0],
    );
    const saved = JSON.parse(f.query.mock.calls[1][1]![1] as string);
    expect(saved.mcp_rpc_progress).toEqual({ 'synthetic-attempt': 7 });
  });
  it('adds Native replay and rejection costs to callback costs in the same durable budget', async () => {
    const f = fixture();
    await f.subject.execute(f.claim, f.context, f.call);
    await f.subject.execute(f.claim, f.context, f.call);
    await f.subject.progress(f.claim, f.context, 7, 3);
    expect(f.reservedCalls()).toBe(5);
    const saved = JSON.parse(f.query.mock.calls.at(-1)![1]![1] as string);
    expect(saved.mcp_unforwarded_tool_progress).toEqual({
      'synthetic-attempt': 3,
    });
    f.claim.run.context_manifest = saved;
    await f.subject.progress(f.claim, f.context, 7, 3);
    expect(f.reservedCalls()).toBe(5);
    await expect(f.subject.progress(f.claim, f.context, 8, 2)).rejects.toThrow(
      'nodia_ai:invalid_provider_response',
    );
    await expect(f.subject.progress(f.claim, f.context, 8, 13)).rejects.toThrow(
      'nodia_ai:execution_limit',
    );
  });
  it('rejects Native hidden requests when callback costs already exhausted the shared allowance', async () => {
    const f = fixture();
    for (let count = 0; count < f.policy.budget.tool_calls_per_run; count++)
      await f.subject.execute(f.claim, f.context, f.call);
    await expect(f.subject.progress(f.claim, f.context, 15, 1)).rejects.toThrow(
      'nodia_ai:execution_limit',
    );
    expect(f.reservedCalls()).toBe(f.policy.budget.tool_calls_per_run);
    expect(f.toolRepo.save).toHaveBeenCalledOnce();
  });
  it('rejects decreasing or beyond-policy protocol counters before accepting progress', async () => {
    const f = fixture();
    f.claim.run.context_manifest.mcp_rpc_progress = { 'synthetic-attempt': 4 };
    await expect(f.subject.progress(f.claim, f.context, 3)).rejects.toThrow(
      'nodia_ai:invalid_provider_response',
    );
    await expect(f.subject.progress(f.claim, f.context, 129)).rejects.toThrow(
      'nodia_ai:execution_limit',
    );
    expect(f.query).not.toHaveBeenCalled();
  });
});
