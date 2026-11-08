import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiEvent } from '../../nodia-ai-run/entities/nodia-ai-event.entity.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  conversationFixture,
  testChatId,
  testIdentity,
  testNow,
} from '../../nodia-ai-conversation/use-case/conversation-admission.fixture.js';
import { encodeCursor } from '../../nodia-ai-conversation/use-case/nodia-ai-pagination.js';
import { NodiaAiObservationService } from '../nodia-ai-observation.service.js';
import { GetNodiaAiToolResultUseCase } from './get-nodia-ai-tool-result.use-case.js';
import { ObserveNodiaAiRunUseCase } from './observe-nodia-ai-run.use-case.js';
import type { NodiaAiToolRegistryUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { ObserveNodiaAiProposalsUseCase } from './observe-nodia-ai-proposals.use-case.js';
import {
  NodiaAiReportToolsUseCase,
  NODIA_AI_REPORT_TOOL_NAMES,
} from '../../nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import {
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';

const runId = '39ca12f6-bcd3-4e0c-913b-250357c5576c';
const toolId = 'ea7b8e17-a203-466f-933b-1818aed1d7f2';
const hash = 'a'.repeat(64);
function fixture() {
  const f = conversationFixture();
  f.chat.next_event_seq = '9007199254740995';
  const run = Object.assign(new NodiaAiRun(), {
    id: runId,
    conversation_id: testChatId,
  });
  const rows: NodiaAiEvent[] = [];
  const data = {
    transaction: vi.fn(
      async (work: Parameters<typeof f.service.transaction>[0]) =>
        work(f.manager),
    ),
    run: vi.fn(async () => run as NodiaAiRun | null),
    events: vi.fn(
      async (_manager: unknown, _id: string, after: string, limit: number) =>
        rows
          .filter((row) => BigInt(row.seq) > BigInt(after))
          .slice(0, limit + 1),
    ),
    toolRefs: vi.fn(
      async () =>
        [] as { id: string; tool_name: string; contract_hash: string }[],
    ),
    proposalEvents: vi.fn(async () => [] as NodiaAiEvent[]),
  };
  const results = {
    observe: vi.fn(async () => ({
      result_ref: {
        tool_call_id: toolId,
        tool_name: 'nodia_businesses_list',
        contract_hash: hash,
      },
    })),
  };
  const registry = {
    get: vi.fn((name: string) =>
      NODIA_AI_REPORT_TOOL_NAMES.includes(
        name as (typeof NODIA_AI_REPORT_TOOL_NAMES)[number],
      )
        ? undefined
        : { requiredModuleRoutes: [], actionKeys: [] },
    ),
  };
  const reportCall = Object.assign(new NodiaAiToolCall(), {
    id: toolId,
    tool_name: 'nodia_reports_run',
    contract_hash: hash,
    run_id: runId,
    conversation_id: testChatId,
    state: 'completed',
    completed_at: testNow,
    arguments: {
      catalog_version: 'synthetic-report-catalog',
      sources: [{ source_key: 'synthetic-source', alias: 'own' }],
    },
    public_result: { synthetic: true },
    scope_manifest: { schema_version: 1, module_routes: ['/nodia-ai'] },
  });
  reportCall.arguments_hash = knowledgeHash(
    canonicalKnowledge(reportCall.arguments),
  );
  const reportRepository = {
    findOneBy: vi.fn(async () => reportCall as NodiaAiToolCall | null),
  };
  const baseRepository = f.manager.getRepository.bind(f.manager);
  vi.spyOn(f.manager, 'getRepository').mockImplementation((entity) =>
    entity === NodiaAiToolCall
      ? (reportRepository as unknown as ReturnType<
          typeof f.manager.getRepository
        >)
      : baseRepository(entity),
  );
  const baseQuery = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (sql, args) =>
    sql === 'SHOW transaction_isolation'
      ? [{ transaction_isolation: 'read committed' }]
      : baseQuery(sql, args),
  );
  const reports = {
    handles: vi.fn((name: string) =>
      (NODIA_AI_REPORT_TOOL_NAMES as readonly string[]).includes(name),
    ),
    contractHash: vi.fn(() => hash),
    validateInput: vi.fn((_name: string, value: NodiaAiJsonObject) => value),
    assertGranted: vi.fn(
      (input: NodiaAiJsonObject, routes: readonly string[]) =>
        NodiaAiReportToolsUseCase.prototype.assertGranted.call(
          {
            registry: {
              get: () => ({ requiredModuleRoutes: ['/nodia-ai'] }),
            },
          } as unknown as NodiaAiReportToolsUseCase,
          input,
          routes,
        ),
    ),
    verifyResult: vi.fn(async () => undefined),
  };
  const authorize = {
    execute: f.authorize.execute,
    filterAuthorized: vi.fn(
      async (_identity: unknown, requirements: unknown[]) => ({
        actor: f.actor,
        allowed: requirements.map(() => true),
      }),
    ),
  };
  const subject = new ObserveNodiaAiRunUseCase(
    data as unknown as NodiaAiObservationService,
    f.access,
    f.runs,
    results as unknown as GetNodiaAiToolResultUseCase,
    f.policy,
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    registry as unknown as NodiaAiToolRegistryUseCase,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    {
      execute: vi.fn(async () => new Set<string>()),
    } as unknown as ObserveNodiaAiProposalsUseCase,
    reports as unknown as NodiaAiReportToolsUseCase,
  );
  const event = (
    seq: string,
    kind = 'run_changed',
    payload: NodiaAiJsonObject = { revision: 2, state: 'running', error: null },
    routes: string[] = [],
  ) =>
    Object.assign(new NodiaAiEvent(), {
      id: toolId,
      conversation_id: testChatId,
      run_id: runId,
      seq,
      event_key: seq,
      public_payload: { kind, payload },
      scope_manifest: { schema_version: 1, module_routes: routes },
      created_at: testNow,
    });
  return {
    ...f,
    run,
    rows,
    data,
    results,
    subject,
    event,
    currentAuthority: authorize,
    reports,
    reportCall,
    reportRepository,
    registry,
  };
}
describe('ObserveNodiaAiRunUseCase', () => {
  function reportFixture(name = 'nodia_reports_run') {
    const f = fixture();
    f.reportCall.tool_name = name;
    f.data.toolRefs.mockResolvedValue([
      { id: toolId, tool_name: name, contract_hash: hash },
    ]);
    f.results.observe.mockResolvedValue({
      result_ref: {
        tool_call_id: toolId,
        tool_name: name,
        contract_hash: hash,
      },
    });
    f.rows.push(
      f.event(
        '1',
        'tool_completed',
        {
          result_ref: {
            tool_call_id: toolId,
            tool_name: name,
            contract_hash: hash,
          },
          state: 'completed',
          error: null,
        },
        ['/nodia-ai'],
      ),
    );
    return f;
  }
  it.each(NODIA_AI_REPORT_TOOL_NAMES)(
    'retains the exact %s event after final current report authority without publishing or replaying it',
    async (name) => {
      const f = reportFixture(name);
      const page = await f.subject.events(testIdentity, runId, {});
      expect(page.items).toHaveLength(1);
      expect(f.registry.get).toHaveReturnedWith(undefined);
      expect(f.reports.verifyResult).toHaveBeenCalledWith(
        testIdentity,
        name,
        f.reportCall.arguments,
        f.reportCall.public_result,
        f.manager,
        ['/nodia-ai'],
        '1',
      );
      expect(
        f.reports.verifyResult.mock.invocationCallOrder[0],
      ).toBeGreaterThan(f.conversations.find.mock.invocationCallOrder[1]);
      expect(f.data.transaction).toHaveBeenCalledTimes(2);
      expect(f.results.observe).toHaveBeenCalledTimes(1);
      expect(
        f.query.mock.calls.some(([sql]) => /UPDATE|INSERT|DELETE/.test(sql)),
      ).toBe(false);
    },
  );
  it('hides a report when the contract changes after its first observation', async () => {
    const f = reportFixture();
    f.results.observe.mockImplementationOnce(async () => {
      f.reports.contractHash.mockReturnValue('b'.repeat(64));
      return {
        result_ref: {
          tool_call_id: toolId,
          tool_name: 'nodia_reports_run',
          contract_hash: hash,
        },
      };
    });
    expect((await f.subject.events(testIdentity, runId, {})).items).toEqual([]);
    expect(f.reports.verifyResult).not.toHaveBeenCalled();
  });
  it('intersects the frozen report routes with current authority and rejects a module revoked between phases', async () => {
    const f = reportFixture();
    f.results.observe.mockImplementationOnce(async () => {
      f.actor.modules = [];
      return {
        result_ref: {
          tool_call_id: toolId,
          tool_name: 'nodia_reports_run',
          contract_hash: hash,
        },
      };
    });
    expect((await f.subject.events(testIdentity, runId, {})).items).toEqual([]);
    expect(f.reports.assertGranted).toHaveBeenCalledWith(
      f.reportCall.arguments,
      [],
    );
    expect(f.reports.verifyResult).not.toHaveBeenCalled();
  });
  it('uses only intersected routes and the immutable chat owner for super_admin report inspection', async () => {
    const f = reportFixture();
    f.actor.isSuperAdmin = true;
    f.chat.owner_id = '2';
    f.reportCall.scope_manifest.module_routes = [
      '/nodia-ai',
      '/synthetic-revoked',
    ];
    expect(
      (await f.subject.events(testIdentity, runId, {})).items,
    ).toHaveLength(1);
    expect(f.reports.verifyResult).toHaveBeenCalledWith(
      testIdentity,
      'nodia_reports_run',
      f.reportCall.arguments,
      f.reportCall.public_result,
      f.manager,
      ['/nodia-ai'],
      '2',
    );
  });
  it('hides a report after final native domain revocation and resets its previous visible cursor', async () => {
    const f = reportFixture();
    const first = await f.subject.events(testIdentity, runId, {});
    expect(first.items).toHaveLength(1);
    f.reports.verifyResult.mockRejectedValueOnce(
      new ForbiddenException('provider:not_authorized'),
    );
    const page = await f.subject.events(testIdentity, runId, {
      cursor: first.next_cursor,
    });
    expect(page).toMatchObject({
      items: [],
      next_cursor: null,
      cursor_state: 'reset_required',
    });
  });
  it.each([
    'run',
    'chat',
    'name',
    'hash',
    'state',
    'completed_at',
    'result',
    'missing',
  ])(
    'does not retain a report whose persisted %s binding changed',
    async (change) => {
      const f = reportFixture();
      if (change === 'run') f.reportCall.run_id = testChatId;
      if (change === 'chat') f.reportCall.conversation_id = runId;
      if (change === 'name') f.reportCall.tool_name = 'nodia_reports_describe';
      if (change === 'hash') f.reportCall.contract_hash = 'b'.repeat(64);
      if (change === 'state') f.reportCall.state = 'failed';
      if (change === 'completed_at') f.reportCall.completed_at = null;
      if (change === 'result') f.reportCall.public_result = null;
      if (change === 'missing')
        f.reportRepository.findOneBy.mockResolvedValue(null);
      expect((await f.subject.events(testIdentity, runId, {})).items).toEqual(
        [],
      );
      expect(f.reports.verifyResult).not.toHaveBeenCalled();
    },
  );
  it.each([
    'arguments_hash',
    'scope',
    'argument_bytes',
    'result_bytes',
    'isolation',
  ])(
    'rejects malformed report %s instead of returning a fabricated empty success',
    async (change) => {
      const f = reportFixture();
      if (change === 'arguments_hash')
        f.reportCall.arguments_hash = 'b'.repeat(64);
      if (change === 'scope') f.reportCall.scope_manifest.module_routes = [1];
      if (change === 'argument_bytes')
        f.reportCall.arguments = {
          text: 'x'.repeat(f.policy.results.tool_arguments_utf8_bytes + 1),
        };
      if (change === 'result_bytes')
        f.reportCall.public_result = {
          text: 'x'.repeat(f.policy.results.tool_result_utf8_bytes + 1),
        };
      if (change === 'isolation') {
        const original = f.query.getMockImplementation()!;
        f.query.mockImplementation(async (sql, args) =>
          sql === 'SHOW transaction_isolation'
            ? [{ transaction_isolation: 'repeatable read' }]
            : original(sql, args),
        );
      }
      await expect(f.subject.events(testIdentity, runId, {})).rejects.toThrow(
        'nodia_ai:invalid_persisted_state',
      );
      expect(f.reports.verifyResult).not.toHaveBeenCalled();
    },
  );
  it('propagates an operational failure during final report verification rather than hiding or zeroing it', async () => {
    const f = reportFixture();
    const error = new InternalServerErrorException('Synthetic SQL unavailable');
    f.reports.verifyResult.mockRejectedValueOnce(error);
    await expect(f.subject.events(testIdentity, runId, {})).rejects.toBe(error);
    expect(f.data.events).not.toHaveBeenCalled();
  });
  it('paginates durable bigint sequences without replay, preserves a stable tail checkpoint and independent observers', async () => {
    const f = fixture();
    f.rows.push(
      f.event('9007199254740993'),
      f.event('9007199254740994'),
      f.event('9007199254740995'),
    );
    const first = await f.subject.events(testIdentity, runId, {
      page_limit: 2,
    });
    expect(
      (first.items as NodiaAiJsonObject[]).map((item) => item.seq),
    ).toEqual(['9007199254740993', '9007199254740994']);
    expect(first.has_more).toBe(true);
    const next = await f.subject.events(testIdentity, runId, {
      cursor: first.next_cursor,
      page_limit: 2,
    });
    expect(next.has_more).toBe(false);
    expect((next.items as NodiaAiJsonObject[]).map((item) => item.seq)).toEqual(
      ['9007199254740995'],
    );
    const tail = await f.subject.events(testIdentity, runId, {
      cursor: next.next_cursor,
    });
    expect(tail.items).toEqual([]);
    expect(tail.next_cursor).toBe(next.next_cursor);
    const otherDevice = await f.subject.events(testIdentity, runId, {
      page_limit: 2,
    });
    expect(otherDevice).toEqual(first);
    expect(f.results.observe).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) => /UPDATE|INSERT|DELETE/.test(sql)),
    ).toBe(false);
  });
  it('advances the checkpoint over filtered scopes and exposes no inaccessible refs', async () => {
    const f = fixture();
    f.rows.push(
      f.event(
        '1',
        'tool_completed',
        {
          result_ref: {
            tool_call_id: toolId,
            tool_name: 'nodia_businesses_list',
            contract_hash: hash,
          },
          state: 'completed',
          error: null,
        },
        ['/business'],
      ),
    );
    const page = await f.subject.events(testIdentity, runId, {});
    expect(page.items).toEqual([]);
    expect(page.next_cursor).toBeTypeOf('string');
    await f.subject.events(testIdentity, runId, { cursor: page.next_cursor });
    expect(f.data.events.mock.calls.at(-1)?.[2]).toBe('1');
  });
  it('revalidates source resources on every observation including the tail, resetting a revoked projection', async () => {
    const f = fixture();
    f.data.toolRefs.mockResolvedValue([
      { id: toolId, tool_name: 'nodia_businesses_list', contract_hash: hash },
    ]);
    f.rows.push(
      f.event('1', 'tool_completed', {
        result_ref: {
          tool_call_id: toolId,
          tool_name: 'nodia_businesses_list',
          contract_hash: hash,
        },
        state: 'completed',
        error: null,
      }),
    );
    const page = await f.subject.events(testIdentity, runId, {});
    expect(page.items as unknown[]).toHaveLength(1);
    f.results.observe.mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    const reset = await f.subject.events(testIdentity, runId, {
      cursor: page.next_cursor,
    });
    expect(reset).toMatchObject({
      cursor_state: 'reset_required',
      items: [],
      next_cursor: null,
      has_more: false,
    });
    expect(f.results.observe).toHaveBeenCalledTimes(2);
  });
  it('does not turn an operational result failure into hidden/empty success', async () => {
    const f = fixture();
    f.data.toolRefs.mockResolvedValue([
      { id: toolId, tool_name: 'nodia_businesses_list', contract_hash: hash },
    ]);
    f.results.observe.mockRejectedValueOnce(new InternalServerErrorException());
    await expect(f.subject.events(testIdentity, runId, {})).rejects.toThrow(
      InternalServerErrorException,
    );
  });
  it('applies action revocation at the final authority barrier and validates exact receipt refs', async () => {
    const f = fixture();
    f.data.toolRefs.mockResolvedValue([
      { id: toolId, tool_name: 'nodia_businesses_list', contract_hash: hash },
    ]);
    f.rows.push(
      f.event('1', 'tool_completed', {
        result_ref: {
          tool_call_id: toolId,
          tool_name: 'nodia_businesses_get',
          contract_hash: hash,
        },
        state: 'completed',
        error: null,
      }),
    );
    await expect(f.subject.events(testIdentity, runId, {})).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    f.currentAuthority.filterAuthorized.mockResolvedValueOnce({
      actor: f.actor,
      allowed: [false],
    });
    const hidden = await f.subject.events(testIdentity, runId, {});
    expect(hidden.items).toEqual([]);
  });
  it('rejects malformed, cross-session/run, future cursors and unknown query fields', async () => {
    const f = fixture();
    f.rows.push(f.event('1'));
    const first = await f.subject.events(testIdentity, runId, {});
    await expect(
      f.subject.events(testIdentity, runId, { cursor: 'invalid' }),
    ).rejects.toThrow('nodia_ai:invalid_cursor');
    const value = JSON.parse(
      Buffer.from(first.next_cursor as string, 'base64url').toString(),
    );
    const future = encodeCursor(value.scope, [
      '9223372036854775807',
      value.position[1],
    ]);
    await expect(
      f.subject.events(testIdentity, runId, { cursor: future }),
    ).rejects.toThrow('nodia_ai:invalid_cursor');
    f.actor.sessionId = '869afda0-9998-49b1-9c97-d78004615a5a';
    await expect(
      f.subject.events(testIdentity, runId, { cursor: first.next_cursor }),
    ).rejects.toThrow('nodia_ai:invalid_cursor');
    await expect(
      f.subject.events(testIdentity, runId, { sql: 'no' }),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f.subject.events(testIdentity, runId, { page_limit: 101 }),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('preserves owner/expiry protection and audits super_admin read-only inspection', async () => {
    const f = fixture();
    f.chat.owner_id = '2';
    await expect(f.subject.events(testIdentity, runId, {})).rejects.toThrow(
      NotFoundException,
    );
    f.actor.isSuperAdmin = true;
    await f.subject.events(testIdentity, runId, {});
    expect(f.conversations.auditInspection).toHaveBeenCalledWith(
      f.manager,
      '1',
      testIdentity.sessionId,
      testChatId,
      'events',
    );
    f.chat.owner_id = '1';
    f.chat.expires_at = new Date(testNow.getTime() - 1);
    await expect(f.subject.events(testIdentity, runId, {})).rejects.toThrow(
      'nodia_ai:conversation_expired',
    );
  });
  it('rejects malformed persisted public payloads and bounds the complete response without losing a checkpoint', async () => {
    const f = fixture();
    f.rows.push(
      f.event('1', 'run_changed', {
        revision: 2,
        state: 'invented',
        error: null,
      }),
    );
    await expect(f.subject.events(testIdentity, runId, {})).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    f.rows.splice(0, 1, f.event('1'), f.event('2'));
    const policy = f.policy.results as { tool_result_utf8_bytes: number };
    policy.tool_result_utf8_bytes = 2700;
    const page = await f.subject.events(testIdentity, runId, {});
    expect(page.has_more).toBe(true);
    expect(page.items as unknown[]).toHaveLength(1);
  });
  it('missing run is explicit and old runs without events have an empty, stable snapshot checkpoint', async () => {
    const f = fixture();
    f.data.run.mockResolvedValueOnce(null);
    await expect(f.subject.summary(testIdentity, runId)).rejects.toThrow(
      'nodia_ai:run_not_found',
    );
    const page = await f.subject.events(testIdentity, runId, {});
    expect(page).toMatchObject({
      items: [],
      cursor_state: 'current',
      has_more: false,
    });
    expect(page.next_cursor).toBeTypeOf('string');
  });
});
