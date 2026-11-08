import { describe, expect, it, vi } from 'vitest';
import { RevokeOwnAuthSessionUseCase } from './revoke-own-auth-session.use-case.js';
import { configurationFixture } from '../../../test/fixtures/ai-provider-configuration.fixture.js';

describe('RevokeOwnAuthSessionUseCase', () => {
  const fixture = () => {
    const f = configurationFixture();
    const update = vi.fn(async () => ({ affected: 1 }));
    vi.mocked(f.manager.getRepository).mockReturnValue({ update } as never);
    return { ...f, update, uc: new RevokeOwnAuthSessionUseCase(f.source) };
  };
  it('revokes exactly the current actor/session and never all sessions or another account', async () => {
    const f = fixture();
    await f.uc.execute(f.actor);
    expect(f.update).toHaveBeenCalledWith(
      {
        public_id: f.actor.sessionId,
        user_id: f.actor.userId,
        revoked_at: expect.anything(),
      },
      { revoked_at: expect.any(Date) },
    );
    expect(
      f.trace.findIndex((t) => t.includes('LOCK TABLE actions')),
    ).toBeLessThan(f.trace.findIndex((t) => t.includes('AS "actorId"')));
  });
  it('uses the caller receipt transaction without opening another or resetting its budget', async () => {
    const f = fixture();
    await f.uc.execute({ ...f.actor, transaction: f.manager });
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.trace.some((t) => t.startsWith('SET LOCAL'))).toBe(false);
  });
  it('refuses an unguarded inherited manager before reading a session', async () => {
    const f = fixture();
    f.setAuthorityLocks(false);
    await expect(
      f.uc.execute({ ...f.actor, transaction: f.manager }),
    ).rejects.toThrow('authority_transaction_required');
    expect(f.update).not.toHaveBeenCalled();
  });
  it('refuses a no longer active inherited transaction', async () => {
    const f = fixture();
    f.manager.queryRunner!.isTransactionActive = false;
    await expect(
      f.uc.execute({ ...f.actor, transaction: f.manager }),
    ).rejects.toThrow('transaction_required');
    expect(f.update).not.toHaveBeenCalled();
  });
  it('rejects a revoked or expired actor before mutation', async () => {
    const f = fixture();
    f.setSession(false);
    await expect(f.uc.execute(f.actor)).rejects.toThrow('session_expired');
    expect(f.update).not.toHaveBeenCalled();
  });
  it('allows an ordinary user to revoke their own session without ai:manage', async () => {
    const f = fixture();
    f.setAdmin(false);
    f.setModule(false);
    await f.uc.execute(f.actor);
    expect(f.update).toHaveBeenCalledOnce();
  });
  it('propagates failed revocation so the enclosing receipt rolls back', async () => {
    const f = fixture();
    f.update.mockRejectedValueOnce(new Error('synthetic rollback'));
    await expect(
      f.uc.execute({ ...f.actor, transaction: f.manager }),
    ).rejects.toThrow('synthetic rollback');
  });
});
