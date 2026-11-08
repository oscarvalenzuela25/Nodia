import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { eventJournalFixture } from '../../nodia-ai-run/event-journal.fixture.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import type { NodiaAiRuntimeService } from '../../nodia-ai-runtime/nodia-ai-runtime.service.js';
import { CheckpointNodiaAiJobUseCase } from '../../nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.js';
import { RecoverNodiaAiJobsUseCase } from '../../nodia-ai-runtime/use-case/recover-nodia-ai-jobs.use-case.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { CancelNodiaAiRunUseCase } from './cancel-nodia-ai-run.use-case.js';
import {
  conversationFixture,
  testChatId,
  testIdentity,
  testNow,
} from './conversation-admission.fixture.js';

const runId = '2e0b1ec7-5bcb-4872-bbdc-c57a15d56afa';
const request = { client_request_id: '46cb7b82-67d6-4b73-8645-e10f97bf93a2' };
function setup() {
  const f = conversationFixture();
  const run = Object.assign(new NodiaAiRun(), {
    id: runId,
    conversation_id: testChatId,
    actor_id: '1',
    user_message_id: request.client_request_id,
    assistant_message_id: null,
    revision: 4,
    state: 'queued',
    phase: 'context',
    retention_epoch: '1',
    selection_snapshot: f.selection,
    catalog_version: 'synthetic-release',
    created_at: testNow,
    deadline_at: new Date(testNow.getTime() + 120000),
    completed_at: null,
    error_code: null,
    routing_snapshot: {
      schema_version: 1,
      enabled: false,
      revision: 1,
      target: null,
    },
    budget_snapshot: {
      schema_version: 1,
      tool_calls: 12,
      mcp_rpc_messages: 128,
      provider_dispatches: 3,
      compactions: 1,
      delegations: 1,
    },
    tool_calls_used: 0,
    mcp_rpc_messages_used: 0,
    provider_dispatches_used: 0,
    compactions_used: 0,
    delegations_used: 0,
  });
  const job = Object.assign(new NodiaAiJob(), {
    id: request.client_request_id,
    kind: 'turn',
    conversation_id: testChatId,
    run_id: runId,
    state: 'ready',
    fence: '7',
    recovery_descriptor: null,
  });
  f.chat.active_job_id = job.id;
  const journal = eventJournalFixture(run);
  let casMatches = true;
  const query = vi.fn(async (sql: string, args?: unknown[]) => {
    if (sql.includes("UPDATE nodia_ai_runs SET state='cancel_requested'")) {
      const rows = casMatches ? [{ id: runId }] : [];
      // PostgresQueryRunner returns [rows, affected] for command UPDATE;
      // a CTE ending in SELECT returns rows. Do not hide that driver boundary.
      return sql.trimStart().startsWith('UPDATE') ? [rows, rows.length] : rows;
    }
    return journal.query(sql, args) ?? [];
  });
  const findRun = vi.fn(async () => run as NodiaAiRun | null);
  const findJob = vi.fn(async () => job as NodiaAiJob | null);
  const manager = {
    query,
    getRepository: vi.fn((entity: unknown) => {
      if (entity === NodiaAiRun) return { findOne: findRun };
      if (entity === NodiaAiJob) return { findOne: findJob };
      throw Error('Unexpected repository');
    }),
  } as unknown as EntityManager;
  f.conversations.transaction.mockImplementation(async (work) => work(manager));
  return {
    ...f,
    run,
    job,
    query,
    findRun,
    findJob,
    manager,
    journal,
    failCas: () => {
      casMatches = false;
    },
    subject: new CancelNodiaAiRunUseCase(f.service, f.access, f.runs, f.policy),
  };
}

describe('CancelNodiaAiRunUseCase', () => {
  it.each(['queued', 'running'])(
    'requests %s cancellation with one CAS/revision/event and preserves native ownership',
    async (state) => {
      const f = setup();
      f.run.state = state;
      f.job.state = state === 'running' ? 'leased' : 'ready';
      f.job.recovery_descriptor = {
        schema_version: 1,
        synthetic_armed_request: true,
      };
      const jobBefore = structuredClone(f.job);
      const chatBefore = structuredClone(f.chat);
      const result = await f.subject.execute(testIdentity, runId, request);
      expect(result).toMatchObject({
        status: 'accepted',
        run: { state: 'cancel_requested', revision: 5, run_id: runId },
      });
      expect(f.job).toEqual(jobBefore);
      expect(f.chat).toEqual(chatBefore);
      expect(f.journal.events).toHaveLength(1);
      expect(f.journal.events[0].public_payload).toEqual({
        kind: 'run_changed',
        payload: { revision: 5, state: 'cancel_requested', error: null },
      });
      const mutation = f.query.mock.calls.find(([sql]) =>
        sql.includes("UPDATE nodia_ai_runs SET state='cancel_requested'"),
      );
      expect(mutation?.[1]).toEqual([runId, testChatId, '1', 4, state, '1']);
      expect(f.findJob).toHaveBeenCalledWith({
        where: { id: f.job.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(f.findRun).toHaveBeenLastCalledWith({
        where: { id: runId },
        lock: { mode: 'pessimistic_write' },
      });
      expect(f.conversations.find).toHaveBeenCalledWith(
        f.manager,
        testChatId,
        'pessimistic_write',
      );
      expect(
        f.query.mock.calls.some(([sql]) =>
          /UPDATE nodia_ai_(jobs|runtime_slots|execution_grants)/.test(sql),
        ),
      ).toBe(false);
    },
  );

  it('deduplicates repeated intent even with another request UUID and retains cancel_requested', async () => {
    const f = setup();
    await f.subject.execute(testIdentity, runId, request);
    const again = await f.subject.execute(testIdentity, runId, request);
    const other = await f.subject.execute(testIdentity, runId, {
      client_request_id: testChatId,
    });
    expect(again).toEqual(other);
    expect(again.status).toBe('accepted');
    expect(again.run.revision).toBe(5);
    expect(f.journal.events).toHaveLength(1);
    expect(
      f.query.mock.calls.filter(([sql]) =>
        sql.includes("UPDATE nodia_ai_runs SET state='cancel_requested'"),
      ),
    ).toHaveLength(1);
  });

  it.each(['completed', 'failed', 'cancelled', 'unknown', 'waiting_for_user'])(
    'returns %s unchanged without mutating another current job',
    async (state) => {
      const f = setup();
      f.run.state = state;
      if (state === 'unknown') f.run.error_code = 'nodia_ai:outcome_unknown';
      f.job.run_id = testChatId;
      const before = structuredClone(f.run);
      const result = await f.subject.execute(testIdentity, runId, request);
      expect(result.status).toBe('already_terminal');
      expect(result.run.state).toBe(state);
      expect(result.run.error?.retry_action ?? null).toBe(
        state === 'unknown' ? 'recover_status' : null,
      );
      expect(f.run).toEqual(before);
      expect(f.journal.events).toEqual([]);
      expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(
        false,
      );
    },
  );

  it.each([
    null,
    [],
    {},
    { client_request_id: 1 },
    { client_request_id: 'bad' },
    { ...request, expected_run_revision: 4 },
    { ...request, actor_id: '2' },
  ])('rejects invalid or extended input %j before SQL', async (input) => {
    const f = setup();
    await expect(f.subject.execute(testIdentity, runId, input)).rejects.toThrow(
      'nodia_ai:invalid_input',
    );
    expect(f.conversations.transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed run identity before SQL', async () => {
    const f = setup();
    await expect(
      f.subject.execute(testIdentity, 'bad', request),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.conversations.transaction).not.toHaveBeenCalled();
  });

  it('returns missing run without creating a cancellation', async () => {
    const f = setup();
    f.findRun.mockResolvedValueOnce(null);
    await expect(
      f.subject.execute(testIdentity, runId, request),
    ).rejects.toThrow('nodia_ai:run_not_found');
    expect(f.journal.events).toEqual([]);
  });

  it.each(['foreign', 'foreign_super_admin', 'expired', 'permission_revoked'])(
    'rechecks real conversation authority for %s',
    async (kind) => {
      const f = setup();
      if (kind.startsWith('foreign')) f.chat.owner_id = '2';
      if (kind === 'foreign_super_admin') f.actor.isSuperAdmin = true;
      if (kind === 'expired') f.chat.expires_at = testNow;
      if (kind === 'permission_revoked')
        f.authorize.execute.mockRejectedValueOnce(
          new ForbiddenException('nodia_ai:capability_denied'),
        );
      await expect(
        f.subject.execute(testIdentity, runId, request),
      ).rejects.toThrow(
        kind === 'foreign'
          ? 'nodia_ai:conversation_not_found'
          : kind === 'expired'
            ? 'nodia_ai:conversation_expired'
            : 'nodia_ai:capability_denied',
      );
      expect(f.run.state).toBe('queued');
      expect(f.journal.events).toEqual([]);
    },
  );

  it.each([
    'active_job_missing',
    'job_missing',
    'execution_job',
    'different_run',
    'different_chat',
    'job_done',
    'epoch_changed',
    'actor_changed',
    'invalid_state',
  ])(
    'rejects inconsistent ownership %s without changing anything',
    async (kind) => {
      const f = setup();
      if (kind === 'active_job_missing') f.chat.active_job_id = null;
      if (kind === 'job_missing') f.findJob.mockResolvedValue(null);
      if (kind === 'execution_job') f.job.kind = 'execution';
      if (kind === 'different_run') f.job.run_id = testChatId;
      if (kind === 'different_chat') f.job.conversation_id = runId;
      if (kind === 'job_done') f.job.state = 'done';
      if (kind === 'epoch_changed') f.run.retention_epoch = '2';
      if (kind === 'actor_changed') f.run.actor_id = '2';
      if (kind === 'invalid_state') f.run.state = 'not_a_state';
      await expect(
        f.subject.execute(testIdentity, runId, request),
      ).rejects.toThrow('nodia_ai:invalid_persisted_state');
      expect(f.journal.events).toEqual([]);
      expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(
        false,
      );
    },
  );

  it('does not publish or claim accepted when conditional update loses', async () => {
    const f = setup();
    f.failCas();
    await expect(
      f.subject.execute(testIdentity, runId, request),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.run.state).toBe('queued');
    expect(f.journal.events).toEqual([]);
  });

  it.each(['claimed', 'dispatch_armed'])(
    'blocks a current %s worker heartbeat/late commit immediately after the durable intent',
    async (phase) => {
      const f = setup(),
        worker = runtimeFixture();
      const claim = worker.leased();
      f.run.state = 'running';
      f.job.state = 'leased';
      f.job.fence = claim.job.fence;
      f.job.lease_owner = claim.attempt.worker_id;
      f.job.lease_until = worker.future;
      f.job.deadline_at = worker.future;
      f.run.deadline_at = worker.future;
      claim.job = { ...f.job };
      claim.run = { ...f.run };
      claim.identity = testIdentity;
      claim.attempt.phase = phase;
      const runtime = {
        transaction: f.conversations.transaction,
        lockConversation: async () => f.chat,
        lockJob: async () => f.job,
        now: async () => testNow,
        findRun: async () => f.run,
      } as unknown as NodiaAiRuntimeService;
      await f.subject.execute(testIdentity, runId, request);
      const checkpoint = new CheckpointNodiaAiJobUseCase(
        runtime,
        f.authorization,
        f.policy,
      );
      const persist = vi.fn(async () => undefined);
      await expect(checkpoint.heartbeat(claim)).rejects.toThrow(
        'nodia_ai:lease_lost',
      );
      await expect(
        checkpoint.finish(claim, { status: 'completed', persist }),
      ).rejects.toThrow('nodia_ai:lease_lost');
      expect(persist).not.toHaveBeenCalled();
      expect(f.run.state).toBe('cancel_requested');
      expect(f.journal.events).toHaveLength(1);
    },
  );

  it.each([
    { phase: null, expected: 'cancelled' },
    { phase: 'dispatch_armed', expected: 'unknown' },
  ])(
    'hands $phase cancellation to real recovery as $expected without replay',
    async ({ phase, expected }) => {
      const f = setup();
      const original = f.query.getMockImplementation()!;
      f.query.mockImplementation(async (sql, args) => {
        if (sql.includes('SELECT c.id,j.id AS job_id'))
          return [{ id: f.chat.id, job_id: f.job.id }];
        if (sql.startsWith('SELECT id,phase FROM nodia_ai_job_attempts'))
          return phase ? [{ id: request.client_request_id, phase }] : [];
        if (sql.startsWith('UPDATE nodia_ai_runs SET state=$2')) {
          f.run.state = String(args?.[1]);
          f.run.error_code = String(args?.[2]);
        }
        return original(sql, args);
      });
      const runtime = {
        transaction: f.conversations.transaction,
        lockConversation: async () => f.chat,
        lockJob: async () => f.job,
        now: async () => testNow,
        findRun: async () => f.run,
      } as unknown as NodiaAiRuntimeService;
      await f.subject.execute(testIdentity, runId, request);
      await expect(
        new RecoverNodiaAiJobsUseCase(runtime, f.policy).execute(),
      ).resolves.toBe(1);
      expect(f.run.state).toBe(expected);
      expect(
        f.journal.events.map((event) => event.public_payload.payload),
      ).toEqual([
        { revision: 5, state: 'cancel_requested', error: null },
        expect.objectContaining({ revision: 6, state: expected }),
      ]);
      expect(
        f.query.mock.calls.some(([sql]) => sql.includes("state='ready'")),
      ).toBe(false);
      expect(
        f.query.mock.calls.some(([sql]) => sql.includes('active_job_id=NULL')),
      ).toBe(expected === 'cancelled');
      expect(
        f.query.mock.calls.some(([sql]) =>
          sql.includes("runtime_slots SET state='free'"),
        ),
      ).toBe(false);
    },
  );
});
