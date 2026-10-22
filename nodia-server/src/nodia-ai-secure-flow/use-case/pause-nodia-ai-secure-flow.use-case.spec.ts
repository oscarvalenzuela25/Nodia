import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { secureFlowFixture } from '../../../test/fixtures/nodia-ai-secure-flow.fixture.js';
import { PauseNodiaAiSecureFlowUseCase } from './pause-nodia-ai-secure-flow.use-case.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => {}),
}));
function setup() {
  const f = secureFlowFixture('connection_login');
  f.execution.state = 'running';
  f.step.state = 'running';
  f.step.recovery_descriptor = null;
  f.step.bound_command_hash = null;
  f.job.state = 'leased';
  f.job.lease_owner = f.claim.workerId;
  f.job.lease_until = new Date(f.now.getTime() + 30000);
  f.job.recovery_descriptor = null;
  const store = {
    ...f.store,
    sessionExpiry: vi.fn(async () => new Date(f.now.getTime() + 60000)),
  };
  return {
    ...f,
    store,
    uc: new PauseNodiaAiSecureFlowUseCase(
      store as never,
      f.status as never,
      f.validate,
      f.proposals as never,
      f.policy,
    ),
  };
}
describe('PauseNodiaAiSecureFlowUseCase', () => {
  it('durably releases worker lease and attempt without invoking a provider', async () => {
    const f = setup();
    expect(await f.uc.execute(f.claim)).toBe(true);
    expect(f.execution.state).toBe('waiting_for_user');
    expect(f.step.state).toBe('waiting_for_user');
    expect(f.job.state).toBe('waiting');
    expect(f.job.lease_owner).toBeNull();
    expect(f.job.lease_until).toBeNull();
    expect(f.repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'claimed' }),
      expect.objectContaining({ phase: 'completed' }),
    );
    expect(f.native.start).not.toHaveBeenCalled();
    expect(f.step.recovery_descriptor?.native_reference).toBeNull();
  });
  it('bounds the opaque flow by the current real session expiry', async () => {
    const f = setup();
    await f.uc.execute(f.claim);
    expect(f.step.recovery_descriptor?.expires_at).toBe(
      new Date(f.now.getTime() + 60000).toISOString(),
    );
  });
  it.each(['lease', 'fence', 'grant', 'scope', 'confirmation', 'session'])(
    'rejects a changed %s before creating a human flow',
    async (variant) => {
      const f = setup();
      if (variant === 'lease') f.job.lease_owner = randomUUID();
      if (variant === 'fence') f.step.lease_fence = '8';
      if (variant === 'grant') f.grant.allowed_operations = ['invented'];
      if (variant === 'scope') f.grant.allowed_scope = { invented: true };
      if (variant === 'confirmation')
        f.store.confirmedBySession.mockResolvedValue(false);
      if (variant === 'session') f.store.sessionExpiry.mockResolvedValue(f.now);
      await expect(f.uc.execute(f.claim)).rejects.toThrow();
      expect(f.step.recovery_descriptor).toBeNull();
      expect(f.native.start).not.toHaveBeenCalled();
    },
  );
  it('ignores a trusted local-operation hint without opening another transaction', async () => {
    const f = setup();
    expect(
      await f.uc.execute({
        ...f.claim,
        toolName: 'nodia_finance_movements_prepare_create',
      }),
    ).toBe(false);
    expect(f.store.transaction).not.toHaveBeenCalled();
  });
  it('rechecks the original confirmation after an authenticated pre-pause resume', async () => {
    const f = setup();
    f.job.recovery_descriptor = {
      schema_version: 1,
      kind: 'human_execution_resume',
      actor_id: f.identity.userId,
      session_public_id: f.identity.sessionId,
      proposal_hash: f.execution.proposal_hash,
      execution_revision: 2,
      expected_execution_revision: 1,
    };
    f.execution.revision = 3;
    await f.uc.execute(f.claim);
    expect(f.store.confirmedBySession).toHaveBeenCalledWith(
      f.manager,
      f.execution,
      null,
    );
  });
});
