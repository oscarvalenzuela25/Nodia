import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { confirmationFixture } from '../../nodia-ai-confirmation/use-case/confirmation.fixture.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import type { NodiaAiExecutionService } from '../nodia-ai-execution.service.js';
import { RecoverNodiaAiExecutionsUseCase } from './recover-nodia-ai-executions.use-case.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => undefined),
}));

function fixture() {
  const f = confirmationFixture();
  f.execution.state = 'running';
  Object.assign(f.chat, {
    lifecycle: 'active',
    expires_at: new Date(f.now.getTime() + 900000),
  });
  const job = {
    id: randomUUID(),
    state: 'leased',
    fence: '3',
    lease_owner: randomUUID(),
    available_at: f.now,
    deadline_at: new Date(f.now.getTime() + 600000),
  };
  const step = {
    id: randomUUID(),
    state: 'running',
    tool_name: 'nodia_finance_movements_prepare_create',
    minimal_receipt: null as object | null,
    dispatched_at: null,
    completed_at: null,
    recovery_descriptor: null,
  };
  const grant = { allowed_modules: ['/finance'] };
  vi.mocked(f.manager.query).mockImplementation(async (sql: string) =>
    sql.includes('SELECT j.execution_id,j.conversation_id')
      ? [{ execution_id: f.execution.id, conversation_id: f.chat.id }]
      : [],
  );
  const store = {
    transaction: async <T>(work: (manager: EntityManager) => Promise<T>) =>
      work(f.manager),
    chat: async () => f.chat,
    jobs: async () => [job],
    execution: async () => f.execution,
    steps: async () => [step],
    grants: async () => [grant],
    now: async () => f.now,
  };
  const uc = new RecoverNodiaAiExecutionsUseCase(
    store as unknown as NodiaAiExecutionService,
    f.policy,
  );
  return { ...f, job, step, uc, store };
}
describe('RecoverNodiaAiExecutionsUseCase local witness', () => {
  it.each(['create', 'update', 'complete', 'cancel', 'discard'])(
    'closes a retired queued sales %s without replay and releases the conversation',
    async (operation) => {
      const f = fixture();
      f.step.tool_name = `nodia_sales_prepare_${operation}`;
      expect(await f.uc.execute(undefined, 'nodia_ai:catalog_changed')).toBe(1);
      const calls = vi.mocked(f.manager.query).mock.calls;
      expect(
        calls.find(([sql]) =>
          sql.startsWith('UPDATE nodia_ai_execution_steps'),
        )?.[1],
      ).toEqual([
        f.step.id,
        'failed',
        'nodia_ai:catalog_changed',
        JSON.stringify({
          schema_version: 1,
          kind: 'local_transaction_rolled_back',
        }),
      ]);
      expect(
        calls.some(([sql]) =>
          sql.startsWith('UPDATE nodia_ai_execution_grants SET revoked_at='),
        ),
      ).toBe(true);
      expect(
        calls.some(([sql]) =>
          sql.startsWith(
            'UPDATE nodia_ai_conversations SET active_job_id=NULL',
          ),
        ),
      ).toBe(true);
      expect(
        calls.some(([sql]) =>
          /^(INSERT INTO|UPDATE|DELETE FROM) (sales|sale_items)\b/.test(sql),
        ),
      ).toBe(false);
    },
  );
  it('does not infer a SQL rollback from a restored copy even when its dispatch fields are empty', async () => {
    const f = fixture();
    Object.assign(f.job, {
      recovery_descriptor: { restore_quarantined: true },
    });
    expect(await f.uc.execute()).toBe(0);
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.some(([sql]) => sql.startsWith('UPDATE nodia_ai_')),
    ).toBe(false);
  });
  it('records known rollback only after reacquiring the SQL identity and fences the abandoned delivery', async () => {
    const f = fixture();
    expect(await f.uc.execute()).toBe(1);
    const updates = vi.mocked(f.manager.query).mock.calls;
    expect(
      updates.find(([sql]) =>
        sql.startsWith('UPDATE nodia_ai_execution_steps'),
      )?.[1],
    ).toEqual([
      f.step.id,
      'failed',
      'nodia_ai:lease_lost',
      JSON.stringify({
        schema_version: 1,
        kind: 'local_transaction_rolled_back',
      }),
    ]);
    expect(
      updates.find(([sql]) => sql.startsWith('UPDATE nodia_ai_jobs'))?.[0],
    ).toContain('fence=fence+1');
    expect(
      updates.find(([sql]) =>
        sql.startsWith('UPDATE nodia_ai_conversations'),
      )?.[0],
    ).toContain('active_job_id=NULL');
  });
  it('records partial failure only on the pending step and preserves its completed predecessor', async () => {
    const f = fixture();
    const completed = {
      ...f.step,
      id: randomUUID(),
      state: 'completed',
      minimal_receipt: { resource_key: 'finance_movements', resource_id: '41' },
      dispatched_at: f.now,
      completed_at: f.now,
    };
    const frozen = structuredClone(completed);
    f.store.steps = async () => [completed, f.step] as never;
    expect(await f.uc.execute()).toBe(1);
    const writes = vi.mocked(f.manager.query).mock.calls;
    expect(
      writes
        .find(([sql]) => sql.startsWith('UPDATE nodia_ai_execution_steps'))?.[1]
        ?.slice(0, 2),
    ).toEqual([f.step.id, 'failed']);
    expect(
      writes.find(([sql]) => sql.startsWith('UPDATE nodia_ai_executions'))?.[1],
    ).toEqual([f.execution.id, 'partially_completed', null]);
    expect(completed).toEqual(frozen);
    expect(writes.some(([sql]) => sql.includes('bound_command='))).toBe(false);
  });
  it('cancels only the remaining suffix after earlier effects committed', async () => {
    const f = fixture();
    f.execution.state = 'cancel_requested';
    const completed = {
      ...f.step,
      id: randomUUID(),
      state: 'completed',
      minimal_receipt: { resource_id: '41' },
      dispatched_at: f.now,
      completed_at: f.now,
    };
    f.store.steps = async () => [completed, f.step] as never;
    await f.uc.execute();
    const writes = vi.mocked(f.manager.query).mock.calls;
    expect(
      writes.find(([sql]) => sql.startsWith('UPDATE nodia_ai_executions'))?.[1],
    ).toEqual([f.execution.id, 'partially_completed', f.now]);
    expect(
      writes.find(([sql]) => sql.includes("state<>'completed'"))?.[1],
    ).toEqual([f.execution.id, f.step.id]);
  });
  it('ignores a stale claim whose intermediate commit already released the delivery', async () => {
    const f = fixture();
    f.job.state = 'ready';
    f.job.lease_owner = null as never;
    const claim = {
      executionId: f.execution.id,
      identity: f.identity,
      jobId: f.job.id,
      attemptId: randomUUID(),
      workerId: randomUUID(),
      fence: f.job.fence,
    };
    expect(await f.uc.execute(claim)).toBe(0);
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.some(([sql]) => sql.startsWith('UPDATE ')),
    ).toBe(false);
  });
  it('preserves cancelled intent rather than making cancelled work resumable', async () => {
    const f = fixture();
    f.execution.state = 'cancel_requested';
    await f.uc.execute();
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.find(([sql]) =>
          sql.startsWith('UPDATE nodia_ai_execution_steps'),
        )?.[1]?.[1],
    ).toBe('cancelled');
  });
  it('keeps an inconsistent receipt uncertain and does not manufacture a rollback witness', async () => {
    const f = fixture();
    f.step.minimal_receipt = { invalid: true };
    await f.uc.execute();
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.find(([sql]) =>
          sql.startsWith('UPDATE nodia_ai_execution_steps'),
        )?.[1]?.[1],
    ).toBe('unknown');
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.some(([sql]) =>
          sql.startsWith('UPDATE nodia_ai_conversations'),
        ),
    ).toBe(false);
  });
  it('does not append repeated uncertain revisions on every maintenance heartbeat', async () => {
    const f = fixture();
    f.execution.state = 'unknown';
    f.step.state = 'unknown';
    f.job.state = 'unknown';
    f.step.minimal_receipt = { invalid: true };
    expect(await f.uc.execute()).toBe(0);
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.some(([sql]) => sql.startsWith('UPDATE')),
    ).toBe(false);
  });
  it('cannot let a stale failed claimant terminate a replacement holder', async () => {
    const f = fixture();
    expect(
      await f.uc.execute({
        executionId: f.execution.id,
        identity: f.identity,
        jobId: f.job.id,
        attemptId: randomUUID(),
        workerId: randomUUID(),
        fence: '2',
      }),
    ).toBe(0);
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.some(([sql]) => sql.startsWith('UPDATE')),
    ).toBe(false);
  });
  it('observes a completed identity without another transition or native write', async () => {
    const f = fixture();
    f.execution.state = 'completed';
    f.step.state = 'completed';
    expect(await f.uc.execute()).toBe(0);
    expect(
      vi
        .mocked(f.manager.query)
        .mock.calls.some(([sql]) => sql.startsWith('UPDATE')),
    ).toBe(false);
    expect(appendNodiaAiExecutionEvent).toBeDefined();
  });
});
