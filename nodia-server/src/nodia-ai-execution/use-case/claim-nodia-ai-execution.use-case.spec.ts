import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { confirmationFixture } from '../../nodia-ai-confirmation/use-case/confirmation.fixture.js';
import type { NodiaAiExecutionService } from '../nodia-ai-execution.service.js';
import { ClaimNodiaAiExecutionUseCase } from './claim-nodia-ai-execution.use-case.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => undefined),
}));

function fixture() {
  const f = confirmationFixture();
  const job = {
    id: randomUUID(),
    state: 'ready',
    stage_key: 'execution_step',
    stage_seq: 1,
    attempt_count: 0,
    fence: '0',
    lease_owner: null as string | null,
    lease_until: null as Date | null,
    deadline_at: new Date(f.now.getTime() + 600000),
    recovery_descriptor: null,
  };
  const step = {
    id: randomUUID(),
    state: 'ready',
    minimal_receipt: null as object | null,
    dispatched_at: null,
    completed_at: null,
    lease_fence: '0',
    recovery_descriptor: null,
    error_code: null,
  };
  const chat = {
    ...f.chat,
    active_job_id: job.id,
    retention_epoch: '1',
    expires_at: new Date(f.now.getTime() + 900000),
  };
  const grant = {
    actor_id: f.actor.actorId,
    session_public_id: f.actor.sessionId,
    revoked_at: null,
    expires_at: job.deadline_at,
    allowed_modules: ['/finance'],
  };
  const persistence = {
    save: vi.fn(async (value: unknown) => value),
    insert: vi.fn(async () => undefined),
  };
  vi.mocked(f.manager.getRepository).mockReturnValue(persistence as never);
  const store = {
    transaction: async <T>(work: (m: EntityManager) => Promise<T>) =>
      work(f.manager),
    candidate: async () => ({
      id: job.id,
      execution_id: f.execution.id,
      conversation_id: chat.id,
    }),
    chat: async () => chat,
    jobs: async () => [job],
    execution: async () => f.execution,
    steps: async () => [step],
    grants: async () => [grant],
    now: async () => f.now,
  };
  const uc = new ClaimNodiaAiExecutionUseCase(
    store as unknown as NodiaAiExecutionService,
    f.policy,
  );
  return { ...f, chat, job, step, grant, uc, persistence, store };
}
describe('ClaimNodiaAiExecutionUseCase', () => {
  it('creates one fenced SQL attempt while preserving the approved execution and step identities', async () => {
    const f = fixture(),
      workerId = randomUUID();
    const claim = await f.uc.execute(workerId);
    expect(claim).toMatchObject({
      executionId: f.execution.id,
      jobId: f.job.id,
      identity: f.identity,
      workerId,
      fence: '1',
    });
    expect(f.execution).toMatchObject({ state: 'running', revision: 2 });
    expect(f.step).toMatchObject({
      state: 'running',
      lease_fence: '1',
      minimal_receipt: null,
      dispatched_at: null,
    });
    expect(f.job).toMatchObject({
      state: 'leased',
      lease_owner: workerId,
      attempt_count: 1,
    });
    expect(f.persistence.insert.mock.calls[0][0]).toMatchObject({
      job_id: f.job.id,
      fence: '1',
      worker_id: workerId,
      phase: 'claimed',
      runtime_resource_key: null,
      external_operation_ref: null,
      selection_snapshot: null,
    });
  });
  it('claims only the next pending step after a completed prefix without changing its receipt or fence', async () => {
    const f = fixture();
    const completed = {
      ...f.step,
      id: randomUUID(),
      state: 'completed',
      minimal_receipt: { resource_id: '41' },
      dispatched_at: f.now,
      completed_at: f.now,
      lease_fence: '7',
    };
    const frozen = structuredClone(completed);
    f.store.steps = async () => [completed, f.step] as never;
    f.job.stage_seq = 2;
    const claim = await f.uc.execute(randomUUID());
    expect(claim).not.toBeNull();
    expect(completed).toEqual(frozen);
    expect(f.step.state).toBe('running');
    expect(f.persistence.insert.mock.calls[0][0]).toMatchObject({
      stage_seq: 2,
    });
    expect(
      f.persistence.save.mock.calls.some(([saved]) => saved === completed),
    ).toBe(false);
  });
  it('rejects a non-prefix completed step before allocating a new attempt', async () => {
    const f = fixture();
    const completed = { ...f.step, id: randomUUID(), state: 'completed' };
    f.store.steps = async () => [f.step, completed] as never;
    expect(await f.uc.execute(randomUUID())).toBeNull();
    expect(f.persistence.insert).not.toHaveBeenCalled();
  });
  it.each([
    'already_running',
    'receipt',
    'wrong_owner',
    'expired_grant',
    'epoch',
  ] as const)(
    'rejects incompatible queued state %s without creating another delivery',
    async (reason) => {
      const f = fixture();
      if (reason === 'already_running') f.execution.state = 'running';
      if (reason === 'receipt') f.step.minimal_receipt = { resource_id: '1' };
      if (reason === 'wrong_owner') f.execution.actor_id = '2';
      if (reason === 'expired_grant') f.grant.expires_at = f.now;
      if (reason === 'epoch') f.chat.retention_epoch = '2';
      expect(await f.uc.execute(randomUUID())).toBeNull();
      expect(f.persistence.insert).not.toHaveBeenCalled();
    },
  );
  it('rejects malformed worker identity before opening a transaction', async () => {
    const f = fixture();
    await expect(f.uc.execute('not-a-worker')).rejects.toThrow(
      'nodia_ai_invalid_worker_identity',
    );
    expect(f.persistence.insert).not.toHaveBeenCalled();
  });
});
