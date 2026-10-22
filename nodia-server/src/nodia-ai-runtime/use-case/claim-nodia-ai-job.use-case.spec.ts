import { describe, expect, it } from 'vitest';
import { ClaimNodiaAiJobUseCase } from './claim-nodia-ai-job.use-case.js';
import { runtimeFixture } from './runtime.fixture.js';

describe('ClaimNodiaAiJobUseCase', () => {
  it('does not claim a quarantined restore even when an old candidate points at it', async () => {
    const f = runtimeFixture();
    f.job.recovery_descriptor = { restore_quarantined: true };
    expect(await new ClaimNodiaAiJobUseCase(f.runtimePort, f.authorization, f.policy).execute(f.workerId, ['fixture-release'])).toBeNull();
    expect(f.job.fence).toBe('0');
    expect(f.journal.events).toEqual([]);
  });
  it('claims a single stage with a new attempt and monotonic fence using current authority', async () => {
    const f = runtimeFixture();
    f.job.fence = '9007199254740993';
    const result = await new ClaimNodiaAiJobUseCase(
      f.runtimePort,
      f.authorization,
      f.policy,
    ).execute(f.workerId, ['fixture-release']);
    expect(result?.job.fence).toBe('9007199254740994');
    expect(result?.attempt.stage_key).toBe('context');
    expect(result?.attempt.phase).toBe('claimed');
    expect(result?.run.revision).toBe(2);
    expect(f.journal.events[0].public_payload).toEqual({
      kind: 'run_changed',
      payload: { revision: 2, state: 'running', error: null },
    });
    expect(result?.identity).toEqual({
      userId: '1',
      sessionId: f.grant.session_public_id,
    });
    expect(result?.job.lease_until?.getTime()).toBe(
      f.now.getTime() + f.policy.timing.lease_seconds * 1000,
    );
    expect(f.authorize.execute).toHaveBeenCalledWith(
      result?.identity,
      { moduleRoutes: [] },
      f.manager,
    );
    expect(f.repository.insert).toHaveBeenCalledTimes(1);
  });
  it.each(['bad', '', '123'])(
    'rejects malformed worker %s without DB work',
    async (worker) => {
      const f = runtimeFixture();
      await expect(
        new ClaimNodiaAiJobUseCase(
          f.runtimePort,
          f.authorization,
          f.policy,
        ).execute(worker, ['x']),
      ).rejects.toThrow('invalid_worker');
      expect(f.runtime.transaction).not.toHaveBeenCalled();
    },
  );
  it('does not claim unknown releases or broaden an empty supported list', async () => {
    const f = runtimeFixture();
    expect(
      await new ClaimNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).execute(f.workerId, []),
    ).toBeNull();
    expect(f.runtime.transaction).not.toHaveBeenCalled();
  });
  it.each([
    'revoked',
    'expired',
    'session_missing',
    'actor_changed',
    'epoch_changed',
    'policy_changed',
    'chat_expired',
    'deadline_expired',
    'chat_hidden',
    'operation_missing',
    'catalog_changed',
  ])('rejects %s without starting an attempt', async (kind) => {
    const f = runtimeFixture();
    if (kind === 'revoked') f.grant.revoked_at = f.now;
    if (kind === 'expired') f.grant.expires_at = f.now;
    if (kind === 'session_missing') f.grant.session_public_id = null;
    if (kind === 'actor_changed') f.grant.actor_id = '2';
    if (kind === 'epoch_changed') f.run.retention_epoch = '2';
    if (kind === 'policy_changed') f.run.policy_hash = 'b'.repeat(64);
    if (kind === 'chat_expired') f.conversation.expires_at = f.now;
    if (kind === 'deadline_expired') f.run.deadline_at = f.now;
    if (kind === 'chat_hidden') f.conversation.lifecycle = 'purging';
    if (kind === 'operation_missing') f.grant.allowed_operations = [];
    if (kind === 'catalog_changed') f.run.catalog_version = 'another-release';
    expect(
      await new ClaimNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).execute(f.workerId, ['fixture-release']),
    ).toBeNull();
    expect(f.repository.insert).not.toHaveBeenCalled();
    expect(f.journal.events[0].public_payload).toMatchObject({
      kind: 'run_changed',
      payload: { state: 'failed', revision: 2 },
    });
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes("state='failed'")),
    ).toBe(true);
  });
  it('fails known work when destination permission has been revoked', async () => {
    const f = runtimeFixture();
    f.authorize.execute.mockRejectedValueOnce(Error('denied'));
    expect(
      await new ClaimNodiaAiJobUseCase(
        f.runtimePort,
        f.authorization,
        f.policy,
      ).execute(f.workerId, ['fixture-release']),
    ).toBeNull();
    expect(f.repository.insert).not.toHaveBeenCalled();
  });
});
