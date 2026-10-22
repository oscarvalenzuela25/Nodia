import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { secureFlowFixture } from '../../../test/fixtures/nodia-ai-secure-flow.fixture.js';
import { RecoverNodiaAiSecureFlowsUseCase } from './recover-nodia-ai-secure-flows.use-case.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => {}),
}));
function setup() {
  const f = secureFlowFixture('connection_login');
  f.manager.query = vi.fn(async (sql: string) =>
    sql.includes('AS execution_id FROM nodia_ai_jobs')
      ? [{ execution_id: f.execution.id }]
      : [],
  ) as never;
  const authority = { execute: vi.fn(async () => f.actor) };
  return {
    ...f,
    authority,
    uc: new RecoverNodiaAiSecureFlowsUseCase(
      f.store as never,
      authority as never,
      f.native as never,
      f.policy,
    ),
  };
}
function invoked(f: ReturnType<typeof setup>) {
  f.descriptor.status = 'pending';
  f.descriptor.request_id = randomUUID();
  f.descriptor.request_revision = 3;
  f.descriptor.request_action = 'start';
  f.descriptor.native_reference = {
    provider_id: '31',
    provider_key: 'gemini',
    mode: 'token_plan_agentic',
    job_id: 'a'.repeat(32),
  };
}
describe('RecoverNodiaAiSecureFlowsUseCase', () => {
  it('does not observe or cancel a login using a restored native witness', async () => {
    const f = setup();
    invoked(f);
    f.job.recovery_descriptor = { restore_quarantined: true };
    expect(await f.uc.execute()).toBe(0);
    expect(f.native.status).not.toHaveBeenCalled();
    expect(f.native.observeRequest).not.toHaveBeenCalled();
    expect(f.native.cancel).not.toHaveBeenCalled();
    expect(f.native.acknowledgeRequest).not.toHaveBeenCalled();
  });
  it('cleans a detached login witness before deleting its job and execution', async () => {
    const f = setup();
    invoked(f);
    f.execution.conversation_id = null;
    f.execution.proposal_id = null;
    f.execution.state = 'unknown';
    f.descriptor.status = 'unknown';
    f.job.state = 'unknown';
    f.job.execution_id = null;
    f.store.jobs.mockResolvedValue([]);
    Object.assign(f.repo, { findOne: vi.fn(async () => f.job) });
    f.manager.query = vi.fn(async (sql: string) =>
      sql.includes('AS execution_id FROM nodia_ai_jobs')
        ? [{ execution_id: f.execution.id }]
        : sql.includes('SELECT id FROM nodia_ai_jobs')
          ? [{ id: f.job.id }]
          : [],
    ) as never;
    expect(await f.uc.execute()).toBe(1);
    expect(f.native.cleanup).toHaveBeenCalledTimes(1);
    const sql = f.manager.query.mock.calls.map(([value]) => value as string),
      jobDelete = sql.findIndex(
        (value) => value === 'DELETE FROM nodia_ai_jobs WHERE id=$1',
      ),
      executionDelete = sql.findIndex(
        (value) => value === 'DELETE FROM nodia_ai_executions WHERE id=$1',
      );
    expect(jobDelete).toBeGreaterThanOrEqual(0);
    expect(executionDelete).toBeGreaterThan(jobDelete);
    expect(f.job.state).toBe('unknown');
    expect(f.step.minimal_receipt).toBeNull();
  });
  it('performs at most one native cleanup per maintenance pass', async () => {
    const f = setup();
    const unprocessed = randomUUID();
    invoked(f);
    f.descriptor.expires_at = f.now.toISOString();
    f.manager.query = vi.fn(async (sql: string) =>
      sql.includes('AS execution_id FROM nodia_ai_jobs')
        ? [{ execution_id: f.execution.id }, { execution_id: unprocessed }]
        : [],
    ) as never;
    f.native.cleanup.mockResolvedValue({
      reference: {
        provider_id: '31',
        provider_key: 'gemini',
        mode: 'token_plan_agentic',
        job_id: 'a'.repeat(32),
      },
      state: 'pending',
      human: { kind: 'gemini_agentic', data: {} },
    } as never);
    await f.uc.execute();
    expect(f.native.cleanup).toHaveBeenCalledTimes(1);
    expect(f.store.execution).not.toHaveBeenCalledWith(
      f.manager,
      unprocessed,
      true,
    );
  });
  it('does not touch a valid human pause or reserve a native profile', async () => {
    const f = setup();
    expect(await f.uc.execute()).toBe(0);
    expect(f.execution.state).toBe('waiting_for_user');
    expect(f.native.cleanup).not.toHaveBeenCalled();
  });
  it('expires an untouched flow without a native command or synthetic receipt', async () => {
    const f = setup();
    f.descriptor.expires_at = f.now.toISOString();
    expect(await f.uc.execute()).toBe(1);
    expect(f.execution.state).toBe('failed');
    expect(f.job.state).toBe('failed');
    expect(f.step.minimal_receipt).toBeNull();
    expect(f.native.cleanup).not.toHaveBeenCalled();
  });
  it('cancels its known native job outside SQL after authority was revoked', async () => {
    const f = setup();
    invoked(f);
    f.authority.execute.mockRejectedValue(new ForbiddenException());
    f.native.cleanup.mockImplementation(async () => {
      expect(f.isActive()).toBe(false);
      return {
        reference: {
          provider_id: '31',
          provider_key: 'gemini',
          mode: 'token_plan_agentic',
          job_id: 'a'.repeat(32),
        },
        state: 'cancelled',
        human: { kind: 'gemini_agentic', data: {} },
      };
    });
    expect(await f.uc.execute()).toBe(1);
    expect(f.native.cleanup).toHaveBeenCalledTimes(1);
    expect(f.step.minimal_receipt).toBeNull();
    expect(f.job.state).toBe('failed');
  });
  it('records an already completed login even after session expiry without starting a new action', async () => {
    const f = setup();
    invoked(f);
    f.descriptor.expires_at = f.now.toISOString();
    f.native.cleanup.mockResolvedValue({
      reference: {
        provider_id: '31',
        provider_key: 'gemini',
        mode: 'token_plan_agentic',
        job_id: 'a'.repeat(32),
      },
      state: 'completed',
      human: { kind: 'gemini_agentic', data: {} },
    });
    expect(await f.uc.execute()).toBe(1);
    expect(f.step.minimal_receipt).toEqual({
      schema_version: 1,
      resource_key: 'secure_flows',
      id: f.flowId,
      operation: 'connection_login',
    });
    expect(f.native.start).not.toHaveBeenCalled();
    expect(f.native.logout).not.toHaveBeenCalled();
  });
  it('keeps a lost start without native identity quarantined rather than claiming cancellation', async () => {
    const f = setup();
    invoked(f);
    f.descriptor.status = 'unknown';
    f.descriptor.native_reference = null;
    f.descriptor.expires_at = f.now.toISOString();
    expect(await f.uc.execute()).toBe(0);
    expect(f.execution.state).toBe('unknown');
    expect(f.job.state).toBe('unknown');
    expect(f.step.minimal_receipt).toBeNull();
    expect(f.native.cleanup).not.toHaveBeenCalled();
  });
  it('does not turn a native cleanup timeout into a false completed/cancelled state', async () => {
    const f = setup();
    invoked(f);
    f.descriptor.expires_at = f.now.toISOString();
    f.native.cleanup.mockRejectedValue(
      new ForbiddenException('synthetic upstream absence'),
    );
    expect(await f.uc.execute()).toBe(0);
    expect(f.execution.state).toBe('unknown');
    expect(f.step.minimal_receipt).toBeNull();
  });
});
