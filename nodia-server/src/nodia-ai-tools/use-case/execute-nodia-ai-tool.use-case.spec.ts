import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { toolFixture } from '../../../test/fixtures/nodia-ai-tools.fixture.js';
import type { NodiaAiToolHandlerContext } from '../types/tool-registry.types.js';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';

describe('frozen staged capability selection', () => {
  it('refuses a current phase/profile that diverges from the armed generation snapshot', async () => {
    const f = toolFixture();
    f.run.context_manifest.tool_selection = {
      schema_version: 1,
      phase: 'execution',
      catalog_hash: f.selectionFlow.catalogHash(),
    };
    const current = Object.assign(new NodiaAiRun(), f.run, {
      context_manifest: structuredClone(f.run.context_manifest),
    });
    current.context_manifest.tool_selection = {
      schema_version: 1,
      phase: 'ack_pending',
      catalog_hash: f.selectionFlow.catalogHash(),
    };
    vi.mocked(f.manager.getRepository).mockReturnValueOnce({
      findOneByOrFail: async () => current,
    } as unknown as ReturnType<EntityManager['getRepository']>);
    await expect(f.subject.descriptors(f.claim, f.context)).rejects.toThrow(
      'catalog_changed',
    );
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('allows only the same-attempt discovery selection receipt while the old whitelist remains frozen', async () => {
    const f = toolFixture();
    f.claim.attempt.id = randomUUID();
    const catalogHash = f.selectionFlow.catalogHash();
    f.run.context_manifest.tool_selection = {
      schema_version: 1,
      phase: 'discovery',
      catalog_hash: catalogHash,
    };
    const frozenContracts = f.run.context_manifest.tool_contracts as Record<
      string,
      string
    >;
    delete frozenContracts[f.call.name];
    for (const tool of f.registry.list(['/tools/fixture', '/tools/nodia-ai']))
      delete frozenContracts[tool.toolName];
    const current = Object.assign(new NodiaAiRun(), f.run, {
      context_manifest: structuredClone(f.run.context_manifest),
    });
    const technical = [
      'nodia_capabilities_search',
      'nodia_capabilities_describe',
      'nodia_entities_search',
      'nodia_knowledge_index',
      'nodia_knowledge_get',
      'nodia_reports_describe',
      'nodia_reports_run',
    ];
    current.context_manifest.tool_selection = {
      schema_version: 1,
      phase: 'selection_requested',
      catalog_hash: catalogHash,
      request: {
        attempt_id: f.claim.attempt.id,
        tool_call_id: randomUUID(),
        capability_ids: [f.call.name],
        profile: {
          schema_version: 1,
          profile_id: 'selected_capabilities',
          revision: 1,
          sha256: 'a'.repeat(64),
        },
        tool_contracts: Object.fromEntries(
          [...technical, f.call.name].map((name) => [name, 'b'.repeat(64)]),
        ),
      },
    };
    vi.mocked(f.manager.getRepository).mockReturnValueOnce({
      findOneByOrFail: async () => current,
    } as unknown as ReturnType<EntityManager['getRepository']>);
    const descriptors = await f.subject.descriptors(f.claim, f.context);
    expect(descriptors.some((item) => item.name === f.call.name)).toBe(false);
    expect(f.run.context_manifest.tool_contracts).toEqual(frozenContracts);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('MCP proposal preparation boundary', () => {
  it.each([
    'prepare_change',
    'prepare_secure_flow',
    'prepare_workflow',
    'prepare_preference_change',
  ] as const)(
    'binds %s to a backend tool-call before invoking its port and replays only its receipt',
    async (kind) => {
      const verifyResult = vi.fn(async () => {});
      const f = toolFixture({ kind, resultAuthority: verifyResult });
      f.handler.mockImplementationOnce(async () => {
        const reservation = f.receipts.get(f.call.callId);
        expect(reservation).toMatchObject({
          conversation_id: f.run.conversation_id,
          run_id: f.run.id,
          state: 'validated',
          public_result: null,
        });
        expect(reservation?.id).toMatch(/^[a-f0-9-]{36}$/);
        return { total: '12.50' };
      });
      expect(
        (await f.subject.descriptors(f.claim, f.context)).some(
          (descriptor) => descriptor.name === f.call.name,
        ),
      ).toBe(true);
      await f.subject.execute(f.claim, f.context, f.call);
      const receipt = f.receipts.get(f.call.callId)!;
      expect(f.handler).toHaveBeenCalledExactlyOnceWith(
        { id: '1' },
        expect.objectContaining({
          manager: f.manager,
          actor: f.actor,
          conversationId: f.run.conversation_id,
          runId: f.run.id,
          toolCallId: receipt.id,
        }),
      );
      expect(receipt.state).toBe('completed');
      await f.subject.execute(f.claim, f.context, f.call);
      expect(f.handler).toHaveBeenCalledOnce();
      expect(f.toolRepo.save).toHaveBeenCalledTimes(2);
      expect(verifyResult).toHaveBeenLastCalledWith(
        { id: '1' },
        { total: '12.50' },
        expect.objectContaining({ toolCallId: receipt.id }),
      );
      expect(f.spent()).toBe(2);
      expect(f.journal.events).toHaveLength(1);
    },
  );

  it('rejects secret payloads before a secure preparer or receipt can retain them', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const f = toolFixture({ kind: 'prepare_secure_flow' });
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...f.call,
        arguments: { id: '1', payload: { secret: 'synthetic-private-marker' } },
      }),
    ).rejects.toThrow('invalid_tool_input');
    expect(f.handler).not.toHaveBeenCalled();
    expect(f.receipts.size).toBe(0);
    expect(f.journal.events).toHaveLength(0);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(
      'synthetic-private-marker',
    );
    expect(f.spent()).toBe(1);
  });

  it.each(['analyze_attachment'] as const)(
    'keeps %s unavailable even when a synthetic manifest includes it',
    async (kind) => {
      const f = toolFixture({ kind });
      expect(
        (await f.subject.descriptors(f.claim, f.context)).some(
          (descriptor) => descriptor.name === f.call.name,
        ),
      ).toBe(false);
      await expect(
        f.subject.execute(f.claim, f.context, f.call),
      ).rejects.toThrow('capability_denied');
      expect(f.handler).not.toHaveBeenCalled();
      expect(f.receipts.size).toBe(0);
      expect(f.spent()).toBe(1);
    },
  );

  it.each([
    'prepare_change',
    'prepare_secure_flow',
    'prepare_workflow',
    'prepare_preference_change',
  ] as const)(
    'cannot expose or invoke unpublished %s despite its frozen grant',
    async (kind) => {
      const f = toolFixture({ kind });
      f.manifest.capability_contracts.length = 0;
      expect(
        (await f.subject.descriptors(f.claim, f.context)).some(
          (descriptor) => descriptor.name === f.call.name,
        ),
      ).toBe(false);
      await expect(
        f.subject.execute(f.claim, f.context, f.call),
      ).rejects.toThrow('capability_denied');
      expect(f.handler).not.toHaveBeenCalled();
      expect(f.receipts.size).toBe(0);
    },
  );
});

describe('NodiaAI durable tool observation', () => {
  it('binds a read to the backend conversation, run and armed attempt', async () => {
    const f = toolFixture();
    await f.subject.execute(f.claim, f.context, f.call);
    expect(f.handler).toHaveBeenCalledWith(
      { id: '1' },
      expect.objectContaining({
        conversationId: f.run.conversation_id,
        runId: f.run.id,
        attemptId: f.claim.attempt.id,
      }),
    );
  });

  it('publishes only a typed receipt reference after the authorized result and never republishes replay', async () => {
    const f = toolFixture();
    await f.subject.execute(f.claim, f.context, f.call);
    const receipt = f.receipts.get(f.call.callId)!;
    expect(f.journal.events).toHaveLength(1);
    expect(f.journal.events[0]).toMatchObject({
      conversation_id: f.claim.run.conversation_id,
      run_id: f.claim.run.id,
      seq: '1',
      event_key: `tool:${receipt.id}:completed`,
      public_payload: {
        kind: 'tool_completed',
        payload: {
          result_ref: {
            tool_call_id: receipt.id,
            tool_name: f.call.name,
            contract_hash: receipt.contract_hash,
          },
          state: 'completed',
          error: null,
        },
      },
    });
    expect(JSON.stringify(f.journal.events)).not.toContain('12.50');
    expect(f.journal.events[0].public_payload.payload).not.toHaveProperty(
      'arguments',
    );
    await f.subject.execute(f.claim, f.context, f.call);
    expect(f.handler).toHaveBeenCalledOnce();
    expect(f.journal.events).toHaveLength(1);
  });
  it('cannot announce a result rejected by its resource-authority check', async () => {
    const f = toolFixture({
      resultAuthority: async () => {
        throw Error('synthetic:revoked');
      },
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'synthetic:revoked',
    );
    expect(f.receipts.size).toBe(0);
    expect(f.journal.events).toHaveLength(0);
  });
  it('reserves the last four activity slots for terminal and reconciliation events', async () => {
    const f = toolFixture();
    for (let i = 0; i < f.policy.results.outbox_events_per_activity - 4; i++) {
      f.journal.events.push({
        id: `event-${i}`,
        conversation_id: f.claim.run.conversation_id,
        run_id: f.claim.run.id,
        seq: String(i + 1),
        event_key: `existing:${i}`,
        public_payload: {},
        scope_manifest: {},
      });
    }
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'nodia_ai:execution_limit',
    );
    expect(f.journal.events).toHaveLength(252);
    // SQL transaction atomicity/rollback is covered by the PostgreSQL harness,
    // not manufactured by this in-memory dependency.
  });
});
describe('NodiaAI callback failure diagnostics', () => {
  it('identifies input validation before a native read without logging arguments or changing its error', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const f = toolFixture();
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...f.call,
        arguments: { private_argument: 'synthetic_secret' },
      }),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    expect(warn.mock.calls[0]?.[0]).toMatch(/^nodia_ai_tool_execution_failed /);
    expect(
      JSON.parse(
        String(warn.mock.calls[0]?.[0]).split(
          'nodia_ai_tool_execution_failed ',
        )[1],
      ),
    ).toEqual({
      phase: 'validate_input',
      error_type: 'Error',
      error_code: 'nodia_ai:invalid_tool_input',
      sql_state: null,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic_secret');
    expect(f.spent()).toBe(1);
    expect(f.receipts.size).toBe(0);
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('retains the exact callback error even when supplemental logging fails', async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      throw Error('synthetic_secret_logging');
    });
    const f = toolFixture();
    const failure = new Error('synthetic_secret_original');
    f.handler.mockRejectedValueOnce(failure);
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toBe(
      failure,
    );
    expect(f.spent()).toBe(1);
    expect(f.handler).toHaveBeenCalledOnce();
    expect(f.receipts.size).toBe(0);
  });
});

describe('External NodiaAI tool checkpoints', () => {
  function externalFixture(kind: 'read' | 'analyze_attachment' = 'read') {
    let fingerprint = 'a'.repeat(64);
    const execute = vi.fn(async (_signal: AbortSignal) => ({ total: '25.00' }));
    const verify = vi.fn(async (_context: NodiaAiToolHandlerContext) => {});
    const discard = vi.fn(async () => {});
    const prepare = vi.fn(async () => ({
      fingerprint,
      execute,
      verify,
      discard,
    }));
    const fixture = toolFixture({ kind, external: { prepare } });
    return {
      ...fixture,
      prepare,
      execute,
      verify,
      discard,
      changeSnapshot: () => {
        fingerprint = 'b'.repeat(64);
      },
    };
  }
  it('routes published attachment analysis through its pure external boundary with a backend attempt identity', async () => {
    const f = externalFixture('analyze_attachment');
    expect(
      (await f.subject.descriptors(f.claim, f.context)).some(
        (descriptor) => descriptor.name === f.call.name,
      ),
    ).toBe(true);
    await f.subject.execute(f.claim, f.context, f.call);
    expect(f.prepare).toHaveBeenCalledWith(
      { id: '1' },
      expect.objectContaining({
        conversationId: f.run.conversation_id,
        runId: f.run.id,
        attemptId: f.claim.attempt.id,
        toolCallId: f.receipts.get(f.call.callId)?.id,
      }),
    );
    await f.subject.execute(f.claim, f.context, f.call);
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.handler).not.toHaveBeenCalled();
    expect(f.spent()).toBe(2);
    expect(f.journal.events).toHaveLength(1);
  });
  it('commits admission before network and rechecks fresh authority before storing the result', async () => {
    const f = externalFixture();
    let inTransaction = false;
    vi.mocked(f.context.checkpoint).mockImplementation(
      async <T>(work: (manager: EntityManager) => Promise<T>) => {
        expect(inTransaction).toBe(false);
        inTransaction = true;
        try {
          return await work(f.manager);
        } finally {
          inTransaction = false;
        }
      },
    );
    f.execute.mockImplementation(async () => {
      expect(inTransaction).toBe(false);
      expect(f.receipts.get(f.call.callId)?.state).toBe('validated');
      expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
      expect(f.journal.events).toHaveLength(0);
      return { total: '25.00' };
    });
    f.verify.mockImplementation(async () => {
      expect(inTransaction).toBe(true);
    });
    expect(await f.subject.execute(f.claim, f.context, f.call)).toEqual({
      total: '25.00',
    });
    expect(f.handler).not.toHaveBeenCalled();
    expect(f.receipts.get(f.call.callId)?.state).toBe('completed');
    expect(f.journal.events).toHaveLength(1);
    expect(f.journal.events[0].public_payload.kind).toBe('tool_completed');
    expect(f.discard).toHaveBeenCalledOnce();
    expect(f.spent()).toBe(1);
  });
  it('replays only after current snapshot and resource authority without another external request', async () => {
    const f = externalFixture();
    await f.subject.execute(f.claim, f.context, f.call);
    await f.subject.execute(f.claim, f.context, f.call);
    expect(f.prepare).toHaveBeenCalledTimes(2);
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.verify).toHaveBeenCalledTimes(2);
    f.changeSnapshot();
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'request_conflict',
    );
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.discard).toHaveBeenCalledTimes(3);
  });
  it('does not redispatch an interrupted or failed external request with the same call ID', async () => {
    const f = externalFixture();
    f.execute.mockRejectedValueOnce(new Error('fixture:unavailable'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'fixture:unavailable',
    );
    expect(f.receipts.get(f.call.callId)?.state).toBe('validated');
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'request_conflict',
    );
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.discard).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed external data without publishing it or retrying', async () => {
    const f = externalFixture();
    f.execute.mockResolvedValueOnce({ unexpected: 'private' } as unknown as {
      total: string;
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'invalid_tool_output',
    );
    expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
    expect(f.verify).not.toHaveBeenCalled();
    expect(f.discard).toHaveBeenCalledOnce();
  });
  it('discards an in-flight response after action revocation', async () => {
    const f = externalFixture();
    f.execute.mockImplementationOnce(async () => {
      f.actions.clear();
      return { total: '25.00' };
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'capability_denied',
    );
    expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
    expect(f.discard).toHaveBeenCalledOnce();
  });
  it('rejects resource changes observed during external execution', async () => {
    const f = externalFixture();
    f.verify.mockRejectedValueOnce(new Error('nodia_ai:resource_changed'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'resource_changed',
    );
    expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
  });
  it('honors run deadline and aborts the external request without extending the run', async () => {
    const f = externalFixture();
    f.run.deadline_at = new Date(Date.now() + 25);
    let receivedSignal: AbortSignal | undefined;
    f.execute.mockImplementationOnce((signal) => {
      receivedSignal = signal;
      return new Promise(() => {});
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'external_timeout',
    );
    expect(receivedSignal?.aborted).toBe(true);
    expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
  });
  it('forwards cancellation and never stores a late result', async () => {
    const f = externalFixture();
    const controller = new AbortController();
    f.context.signal = controller.signal;
    f.execute.mockImplementationOnce(async () => {
      controller.abort();
      return { total: '25.00' };
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'cancelled',
    );
    expect(f.receipts.get(f.call.callId)?.public_result).toBeNull();
    expect(f.discard).toHaveBeenCalledOnce();
  });
  it('admits artifact descriptors and reserves the same callback budget', async () => {
    const prepared = {
      fingerprint: 'c'.repeat(64),
      execute: vi.fn(async () => ({ total: '0' })),
      verify: vi.fn(async () => {}),
    };
    const f = toolFixture({
      kind: 'read_artifact',
      external: { prepare: async () => prepared },
    });
    expect(
      (await f.subject.descriptors(f.claim, f.context)).some(
        (tool) => tool.name === f.call.name,
      ),
    ).toBe(true);
    expect(await f.subject.execute(f.claim, f.context, f.call)).toEqual({
      total: '0',
    });
    expect(f.spent()).toBe(1);
  });
});

describe('ExecuteNodiaAiToolUseCase', () => {
  it('preserves the native isolation contract instead of freezing every resource authority snapshot', async () => {
    const normal = toolFixture();
    await normal.subject.execute(normal.claim, normal.context, normal.call);
    expect(normal.context.checkpoint).toHaveBeenLastCalledWith(
      expect.any(Function),
      undefined,
    );
    const snapshot = toolFixture({ readIsolation: 'REPEATABLE READ' });
    await snapshot.subject.execute(
      snapshot.claim,
      snapshot.context,
      snapshot.call,
    );
    expect(snapshot.context.checkpoint).toHaveBeenLastCalledWith(
      expect.any(Function),
      'REPEATABLE READ',
    );
  });
  it('rejects corrupt stored projections before invoking domain result authorization', async () => {
    const resultAuthority = vi.fn(async () => {}),
      f = toolFixture({ resultAuthority });
    await f.subject.execute(f.claim, f.context, f.call);
    resultAuthority.mockClear();
    f.receipts.get(f.call.callId)!.public_result = {
      unexpected: 'synthetic-invalid',
    };
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'invalid_tool_output',
    );
    expect(resultAuthority).not.toHaveBeenCalled();
  });
  it('revalidates every resource in a stored list without repeating its read after membership is revoked', async () => {
    let membership = true;
    const verifyResultAuthority = vi.fn(async () => {
      if (!membership) throw new Error('nodia_ai:resource_denied');
    });
    const f = toolFixture({ resultAuthority: verifyResultAuthority });
    await f.subject.execute(f.claim, f.context, f.call);
    membership = false;
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'resource_denied',
    );
    expect(f.handler).toHaveBeenCalledTimes(1);
    expect(f.spent()).toBe(2);
  });
  it('does not persist a newly returned result that fails resource authority', async () => {
    const f = toolFixture({
      resultAuthority: async () => {
        throw new Error('nodia_ai:resource_denied');
      },
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'resource_denied',
    );
    expect(f.toolRepo.save).not.toHaveBeenCalled();
    expect(f.spent()).toBe(1);
  });
  it('validates common entity input even when the registered resolver is called directly', async () => {
    const f = toolFixture();
    const call = {
      ...f.call,
      name: 'nodia_fixture_resolve',
      arguments: {
        catalog_version: f.registry.catalogVersion,
        resource_key: 'fixture.records',
        term: 'one',
        scope: {},
      },
    };
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...call,
        arguments: { ...call.arguments, resource_key: 'another.resource' },
      }),
    ).rejects.toThrow('invalid_tool_input');
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...call,
        arguments: { ...call.arguments, catalog_version: 'obsolete' },
      }),
    ).rejects.toThrow('catalog_changed');
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...call,
        arguments: { ...call.arguments, term: 'x'.repeat(257) },
      }),
    ).rejects.toThrow('invalid_tool_input');
    expect(f.resolver).not.toHaveBeenCalled();
    expect(f.spent()).toBe(3);
    expect(await f.subject.execute(f.claim, f.context, call)).toMatchObject({
      status: 'unique',
      candidates: [{ resource_key: 'fixture.records', id: '1' }],
    });
  });
  it('applies resource, bigint, distinctness and page cardinality checks to direct resolver outputs', async () => {
    const invalidResults = [
      {
        status: 'unique',
        candidates: [{ resource_key: 'another.resource', id: '1' }],
        next_cursor: null,
      },
      {
        status: 'unique',
        candidates: [
          { resource_key: 'fixture.records', id: '9223372036854775808' },
        ],
        next_cursor: null,
      },
      {
        status: 'ambiguous',
        candidates: [
          { resource_key: 'fixture.records', id: '1' },
          { resource_key: 'fixture.records', id: '1' },
        ],
        next_cursor: null,
      },
      {
        status: 'ambiguous',
        candidates: Array.from({ length: 101 }, (_, index) => ({
          resource_key: 'fixture.records',
          id: String(index + 1),
        })),
        next_cursor: null,
      },
      {
        status: 'unique',
        candidates: [{ resource_key: 'fixture.records', id: '1' }],
        next_cursor: 'more',
      },
    ];
    for (const result of invalidResults) {
      const f = toolFixture();
      f.resolver.mockResolvedValueOnce(result);
      const call = {
        ...f.call,
        name: 'nodia_fixture_resolve',
        arguments: {
          catalog_version: f.registry.catalogVersion,
          resource_key: 'fixture.records',
          term: 'one',
          scope: {},
        },
      };
      await expect(f.subject.execute(f.claim, f.context, call)).rejects.toThrow(
        'invalid_tool_output',
      );
      expect(f.toolRepo.save).not.toHaveBeenCalled();
      expect(f.spent()).toBe(1);
    }
  });
  it('revalidates entity semantics on cached results for direct and common resolver calls', async () => {
    for (const name of ['nodia_fixture_resolve', 'nodia_entities_search']) {
      const f = toolFixture();
      const call = {
        ...f.call,
        name,
        arguments: {
          catalog_version: f.registry.catalogVersion,
          resource_key: 'fixture.records',
          term: 'one',
          scope: {},
        },
      };
      await f.subject.execute(f.claim, f.context, call);
      f.receipts.get(call.callId)!.public_result = {
        status: 'unique',
        candidates: [{ resource_key: 'another.resource', id: '1' }],
        next_cursor: null,
      };
      await expect(f.subject.execute(f.claim, f.context, call)).rejects.toThrow(
        'invalid_tool_output',
      );
      expect(f.resolver).toHaveBeenCalledOnce();
      expect(f.spent()).toBe(2);
    }
  });
  it('rejects Web, API and non-inference phases before exposing tools while charging attempted callbacks', async () => {
    for (const mode of ['token_plan_web', 'api_key'] as const) {
      const f = toolFixture();
      f.run.selection_snapshot.mode = mode;
      await expect(f.subject.descriptors(f.claim, f.context)).rejects.toThrow(
        'capability_denied',
      );
      await expect(
        f.subject.execute(f.claim, f.context, f.call),
      ).rejects.toThrow('capability_denied');
      expect(f.spent()).toBe(1);
      expect(f.handler).not.toHaveBeenCalled();
    }
    const f = toolFixture();
    f.claim.job.stage_key = 'context';
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'capability_denied',
    );
  });
  it('permits a frozen Web-to-Agentic phase only with opt-in and the same connection', async () => {
    const f = toolFixture();
    const target = {
      selection: {
        ...f.run.selection_snapshot,
        mode: 'token_plan_agentic' as const,
      },
      configuration_generation: 'a'.repeat(64),
      session_generation: 'b'.repeat(32),
    };
    f.run.selection_snapshot.mode = 'token_plan_web';
    f.claim.job.stage_key = 'delegated_inference';
    f.run.routing_snapshot = {
      schema_version: 1,
      enabled: true,
      revision: 1,
      target,
    };
    expect(await f.subject.execute(f.claim, f.context, f.call)).toEqual({
      total: '12.50',
    });
    f.run.routing_snapshot.enabled = false;
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'capability_denied',
    );
    f.run.routing_snapshot.enabled = true;
    target.selection.connection_id = '3';
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'capability_denied',
    );
    expect(f.handler).toHaveBeenCalledOnce();
  });
  it('accepts 74 descriptors without truncating registrations', async () => {
    const f = toolFixture();
    const registered = f.registry.get('nodia_fixture_get')!;
    const tools = Array.from({ length: 69 }, (_, index) => ({
      ...registered,
      toolName: `nodia_fixture_get_${index}`,
    }));
    vi.spyOn(f.discovery, 'visible').mockResolvedValue(tools);
    for (const tool of tools) {
      f.grant.allowed_operations.push(tool.toolName);
      (f.run.context_manifest.tool_contracts as NodiaAiJsonObject)[
        tool.toolName
      ] = tool.contractHash;
    }
    const descriptors = await f.subject.descriptors(f.claim, f.context);
    expect(descriptors).toHaveLength(74);
    expect(descriptors.slice(-69).map((tool) => tool.name)).toEqual(
      tools.map((tool) => tool.toolName),
    );
    expect(f.context.armDispatch).not.toHaveBeenCalled();
  });
  it('rejects 75 descriptors before arming any remote dispatch without dropping registrations', async () => {
    const f = toolFixture();
    const registered = f.registry.get('nodia_fixture_get')!;
    const tools = Array.from({ length: 70 }, (_, index) => ({
      ...registered,
      toolName: `nodia_fixture_get_${index}`,
    }));
    vi.spyOn(f.discovery, 'visible').mockResolvedValue(tools);
    for (const tool of tools) {
      f.grant.allowed_operations.push(tool.toolName);
      (f.run.context_manifest.tool_contracts as NodiaAiJsonObject)[
        tool.toolName
      ] = tool.contractHash;
    }
    await expect(
      f.subject.descriptors(f.claim, f.context),
    ).rejects.toBeInstanceOf(NodiaAiKnownPreDispatchError);
    expect(f.context.armDispatch).not.toHaveBeenCalled();
    expect(tools).toHaveLength(70);
  });
  it('rejects an oversized schema envelope before arming the adapter without dropping tools', async () => {
    const f = toolFixture();
    const registered = f.registry.get('nodia_fixture_get')!;
    vi.spyOn(f.discovery, 'visible').mockResolvedValue([
      {
        ...registered,
        inputSchema: {
          ...registered.inputSchema,
          description: 'x'.repeat(131072),
        },
      },
    ]);
    await expect(f.subject.descriptors(f.claim, f.context)).rejects.toThrow(
      'nodia_ai:tool_catalog_limit',
    );
    expect(f.context.armDispatch).not.toHaveBeenCalled();
  });
  it('dispatches a typed shared port in the checkpoint transaction and persists only its validated projection', async () => {
    const f = toolFixture();
    expect(await f.subject.execute(f.claim, f.context, f.call)).toEqual({
      total: '12.50',
    });
    expect(f.handler).toHaveBeenCalledWith(
      { id: '1' },
      expect.objectContaining({
        manager: f.manager,
        actor: f.actor,
        moduleRoutes: ['/tools/fixture', '/tools/nodia-ai'],
      }),
    );
    expect(f.verifyAuthority).toHaveBeenCalledOnce();
    expect(f.spent()).toBe(1);
    expect(f.toolRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: { id: '1' },
        public_result: { total: '12.50' },
        state: 'completed',
      }),
    );
  });
  it('charges duplicates while recovering one receipt and checking fresh resource authority', async () => {
    const f = toolFixture();
    await f.subject.execute(f.claim, f.context, f.call);
    expect(await f.subject.execute(f.claim, f.context, f.call)).toEqual({
      total: '12.50',
    });
    expect(f.handler).toHaveBeenCalledOnce();
    expect(f.verifyAuthority).toHaveBeenCalledTimes(2);
    expect(f.spent()).toBe(2);
    f.verifyAuthority.mockRejectedValueOnce(new Error('resource_revoked'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'resource_revoked',
    );
    expect(f.spent()).toBe(3);
  });
  it('charges rejected unknown calls and invalid input before any read work', async () => {
    const f = toolFixture();
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...f.call,
        name: 'nodia_execute_sql',
      }),
    ).rejects.toThrow('capability_denied');
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...f.call,
        arguments: { id: '1', sql: 'select *' },
      }),
    ).rejects.toThrow('invalid_tool_input');
    await expect(
      f.subject.execute(f.claim, f.context, { ...f.call, callId: '' }),
    ).rejects.toThrow('invalid_tool_input');
    expect(f.spent()).toBe(3);
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('cannot widen the frozen run modules, grant operations or contract hashes', async () => {
    for (const narrow of [
      (f: ReturnType<typeof toolFixture>) => {
        f.run.context_manifest.module_routes = ['/tools/nodia-ai'];
      },
      (f: ReturnType<typeof toolFixture>) => {
        f.grant.allowed_modules = ['/tools/nodia-ai'];
      },
      (f: ReturnType<typeof toolFixture>) => {
        f.grant.allowed_operations = ['chat:respond'];
      },
      (f: ReturnType<typeof toolFixture>) => {
        f.run.context_manifest.tool_contracts = {};
      },
    ]) {
      const f = toolFixture();
      narrow(f);
      await expect(
        f.subject.execute(f.claim, f.context, f.call),
      ).rejects.toThrow();
      expect(f.handler).not.toHaveBeenCalled();
      expect(f.spent()).toBe(1);
    }
  });
  it('rejects catalog/release changes and unpublished bindings before invoking a handler', async () => {
    for (const change of [
      (f: ReturnType<typeof toolFixture>) => {
        f.run.catalog_version = 'old-catalog';
      },
      (f: ReturnType<typeof toolFixture>) => {
        f.run.context_manifest.tool_catalog_version = 'other';
      },
      (f: ReturnType<typeof toolFixture>) => {
        f.manifest.capability_contracts.length = 0;
      },
    ]) {
      const f = toolFixture();
      change(f);
      await expect(
        f.subject.execute(f.claim, f.context, f.call),
      ).rejects.toThrow();
      expect(f.handler).not.toHaveBeenCalled();
    }
  });
  it('does not replay broad discovery results after action revocation', async () => {
    const f = toolFixture();
    const call = {
      ...f.call,
      name: 'nodia_capabilities_search',
      arguments: {},
    };
    expect(
      (await f.subject.execute(f.claim, f.context, call)).items,
    ).toHaveLength(2);
    f.actions.clear();
    await expect(f.subject.execute(f.claim, f.context, call)).rejects.toThrow(
      'request_conflict',
    );
    expect(f.spent()).toBe(2);
  });
  it('rejects reuse of call IDs with different input and rejects malformed cached projections', async () => {
    const f = toolFixture();
    await f.subject.execute(f.claim, f.context, f.call);
    await expect(
      f.subject.execute(f.claim, f.context, {
        ...f.call,
        arguments: { id: '2' },
      }),
    ).rejects.toThrow('request_conflict');
    f.receipts.get(f.call.callId)!.public_result = {
      total: '12.50',
      secret: 'must not leave server',
    };
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'invalid_tool_output',
    );
    expect(f.handler).toHaveBeenCalledOnce();
  });
  it('keeps the durable request cost when a domain port or output validation fails', async () => {
    const f = toolFixture();
    f.handler.mockRejectedValueOnce(new Error('synthetic_db_failure'));
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'synthetic_db_failure',
    );
    f.handler.mockResolvedValueOnce({
      total: '12.50',
      private_session: 'secret',
    });
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'invalid_tool_output',
    );
    expect(f.spent()).toBe(2);
    expect(f.toolRepo.save).not.toHaveBeenCalled();
  });
  it('enforces the common durable budget even for invalid requests', async () => {
    const f = toolFixture();
    const invalid = { ...f.call, arguments: { id: null } };
    for (let count = 0; count < f.policy.budget.tool_calls_per_run; count++)
      await expect(
        f.subject.execute(f.claim, f.context, invalid),
      ).rejects.toThrow('invalid_tool_input');
    await expect(
      f.subject.execute(f.claim, f.context, invalid),
    ).rejects.toThrow('execution_limit');
    expect(f.spent()).toBe(f.policy.budget.tool_calls_per_run);
  });
  it('charges technical calls exactly once and retains shared native progress accounting', async () => {
    const f = toolFixture();
    const call = { ...f.call, name: 'nodia_knowledge_index', arguments: {} };
    await f.subject.execute(f.claim, f.context, call);
    expect(f.knowledgeTools.execute).toHaveBeenCalledWith(
      f.claim,
      expect.objectContaining({ signal: f.context.signal }),
      call,
      true,
      ['/tools/fixture', '/tools/nodia-ai'],
    );
    expect(f.spent()).toBe(1);
    await f.subject.progress(f.claim, f.context, 8, 2);
    expect(f.knowledgeTools.progress).toHaveBeenCalledWith(
      f.claim,
      f.context,
      8,
      2,
    );
  });
  it('resolves entities only through a frozen and granted capability and rechecks resource authority before replay', async () => {
    const f = toolFixture();
    const call = {
      ...f.call,
      name: 'nodia_entities_search',
      arguments: {
        catalog_version: f.registry.catalogVersion,
        resource_key: 'fixture.records',
        term: 'one',
        scope: {},
      },
    };
    await f.subject.execute(f.claim, f.context, call);
    f.resolverAuthority.mockRejectedValueOnce(
      new Error('entity_scope_revoked'),
    );
    await expect(f.subject.execute(f.claim, f.context, call)).rejects.toThrow(
      'entity_scope_revoked',
    );
    expect(f.resolver).toHaveBeenCalledOnce();
    f.grant.allowed_operations = f.grant.allowed_operations.filter(
      (name) => name !== 'nodia_fixture_resolve',
    );
    await expect(
      f.subject.execute(f.claim, f.context, { ...call, callId: 'other' }),
    ).rejects.toThrow('capability_denied');
  });
  it('passes Agentic only the exact authorized descriptor set and no unregistered names', async () => {
    const f = toolFixture();
    expect(
      (await f.subject.descriptors(f.claim, f.context)).map(
        (tool) => tool.name,
      ),
    ).toEqual([
      'nodia_knowledge_index',
      'nodia_knowledge_get',
      'nodia_capabilities_search',
      'nodia_capabilities_describe',
      'nodia_entities_search',
      'nodia_fixture_get',
      'nodia_fixture_resolve',
    ]);
    f.actions.clear();
    expect(
      (await f.subject.descriptors(f.claim, f.context)).map(
        (tool) => tool.name,
      ),
    ).toHaveLength(5);
  });
  it('allows context to measure authorized Agentic descriptors without allowing callbacks or progress', async () => {
    const f = toolFixture();
    f.claim.job.stage_key = 'context';
    expect(
      (await f.subject.descriptors(f.claim, f.context)).some(
        (tool) => tool.name === f.call.name,
      ),
    ).toBe(true);
    expect(f.handler).not.toHaveBeenCalled();
    expect(f.receipts.size).toBe(0);
    await expect(f.subject.execute(f.claim, f.context, f.call)).rejects.toThrow(
      'capability_denied',
    );
    await expect(f.subject.progress(f.claim, f.context, 1)).rejects.toThrow(
      'capability_denied',
    );
    expect(f.handler).not.toHaveBeenCalled();
    expect(f.receipts.size).toBe(0);
  });
  it('does not allow Web or an unrelated stage to obtain descriptors through the measurement path', async () => {
    for (const stage of ['context', 'seal']) {
      const f = toolFixture();
      f.claim.job.stage_key = stage;
      if (stage === 'context') f.run.selection_snapshot.mode = 'token_plan_web';
      await expect(f.subject.descriptors(f.claim, f.context)).rejects.toThrow(
        'capability_denied',
      );
      expect(f.handler).not.toHaveBeenCalled();
      expect(f.receipts.size).toBe(0);
    }
  });
});
