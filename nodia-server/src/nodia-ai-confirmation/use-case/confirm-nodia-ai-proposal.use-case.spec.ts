import 'reflect-metadata';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import { ConfirmNodiaAiProposalUseCase } from './confirm-nodia-ai-proposal.use-case.js';
import { GetNodiaAiExecutionUseCase } from './get-nodia-ai-execution.use-case.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import { confirmationFixture } from './confirmation.fixture.js';
vi.mock('../../nodia-ai-run/event-journal.js', () => ({
  appendNodiaAiExecutionEvent: vi.fn(async () => '1'),
}));
function fixture() {
  const f = confirmationFixture();
  const store = f.store as unknown as NodiaAiConfirmationService;
  const get = f.get as unknown as GetNodiaAiProposalUseCase;
  const status = new GetNodiaAiExecutionUseCase(
    store,
    get,
    f.validate,
    f.policy,
    f.availability,
  );
  return { ...f, status, storeTyped: store, getTyped: get };
}
function create(f: ReturnType<typeof fixture>, availability = f.availability) {
  return new ConfirmNodiaAiProposalUseCase(
    f.storeTyped,
    f.getTyped,
    f.validate,
    f.validateProposal,
    f.availability === availability ? f.availability : availability,
    f.status,
    f.policy,
  );
}
describe('NodiaAI exact proposal human approval', () => {
  it('refuses an event budget that cannot finish all admitted work before creating an execution', async () => {
    const f = fixture();
    const bounded = { ...f, policy: { ...f.policy, results: { ...f.policy.results, outbox_events_per_activity: 5 } } };
    await expect(create(bounded).execute(f.identity, f.proposal.id, f.request)).rejects.toThrow('nodia_ai:execution_limit');
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it('admits the frozen command identities, without invoking a writer or refreshing the preview', async () => {
    const f = fixture();
    const result = await create(f).execute(
      f.identity,
      f.proposal.id,
      f.request,
    );
    expect(result.execution.state).toBe('queued');
    expect(result.execution.steps[0].step_id).toBe(f.step.id);
    expect(result.execution.can_resume).toBe(false);
    expect(f.store.create).toHaveBeenCalledOnce();
    const execution = f.store.create.mock.calls[0][1];
    expect(execution.origin_proposal_id).toBe(f.proposal.id);
    expect(execution.proposal_hash).toBe(f.revision.hash);
    expect(f.preparer.verifyPreconditions).toHaveBeenCalledOnce();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.preparer.applyEdits).not.toHaveBeenCalled();
    expect(f.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nodia_ai_execution_grants'),
      expect.any(Array),
    );
    expect(f.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nodia_ai_jobs'),
      expect.any(Array),
    );
    expect(appendNodiaAiExecutionEvent).toHaveBeenCalledWith(
      f.manager,
      expect.objectContaining({
        executionId: execution.id,
        payload: { revision: 1, state: 'queued', error: null },
      }),
    );
  });
  it('recovers a lost response with the original request even when the nonce was consumed and expired', async () => {
    const f = fixture();
    f.store.request.mockResolvedValueOnce(f.execution);
    f.revision.state = 'confirmed';
    f.challenge.consumed_at = f.now;
    f.challenge.expires_at = f.now;
    const result = await create(f).execute(f.identity, f.proposal.id, {
      ...f.request,
      confirmation_token: 'B'.repeat(42) + 'A',
    });
    expect(result.execution.execution_id).toBe(f.execution.id);
    expect(f.store.challenge).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.preparer.verifyPreconditions).not.toHaveBeenCalled();
  });
  it('rejects a new request identity for an already admitted proposal instead of creating unrecorded aliases', async () => {
    const f = fixture();
    f.store.origin.mockResolvedValueOnce(f.execution);
    await expect(
      create(f).execute(f.identity, f.proposal.id, {
        ...f.request,
        client_request_id: randomUUID(),
      }),
    ).rejects.toThrow('nodia_ai:proposal_already_confirmed');
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it.each(['proposal', 'revision', 'hash', 'actor'])(
    'rejects reused request identity with changed %s',
    async (key) => {
      const f = fixture();
      f.store.request.mockResolvedValueOnce({
        ...f.execution,
        ...(key === 'proposal'
          ? { origin_proposal_id: randomUUID() }
          : key === 'revision'
            ? { origin_proposal_revision: 2 }
            : key === 'hash'
              ? { proposal_hash: 'b'.repeat(64) }
              : { actor_id: '2' }),
      });
      await expect(
        create(f).execute(f.identity, f.proposal.id, f.request),
      ).rejects.toThrow('nodia_ai:request_conflict');
      expect(f.store.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    'other_session',
    'other_actor',
    'expired',
    'consumed',
    'hash',
    'proposal',
  ])('rejects a %s nonce before any admission', async (reason) => {
    const f = fixture();
    if (reason === 'other_session')
      f.challenge.session_public_id = randomUUID();
    if (reason === 'other_actor') f.challenge.actor_id = '2';
    if (reason === 'expired') f.challenge.expires_at = f.now;
    if (reason === 'consumed') f.challenge.consumed_at = f.now;
    if (reason === 'hash') f.challenge.expected_hash = 'b'.repeat(64);
    if (reason === 'proposal') f.challenge.proposal_id = randomUUID();
    await expect(
      create(f).execute(f.identity, f.proposal.id, f.request),
    ).rejects.toThrow('nodia_ai:confirmation_invalid');
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it('denies production admission even with a syntactically valid human nonce', async () => {
    const f = fixture();
    await expect(
      create(f, new NodiaAiConfirmationAvailabilityUseCase([])).execute(
        f.identity,
        f.proposal.id,
        f.request,
      ),
    ).rejects.toThrow('nodia_ai:execution_unavailable');
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it('revalidates resource authority even for an admitted duplicate', async () => {
    const f = fixture();
    f.store.request.mockResolvedValueOnce(f.execution);
    f.get.load.mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    await expect(
      create(f).execute(f.identity, f.proposal.id, f.request),
    ).rejects.toThrow('nodia_ai:capability_denied');
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it('blocks stale material conditions without rewriting a frozen command', async () => {
    const f = fixture();
    vi.mocked(f.preparer.verifyPreconditions).mockRejectedValueOnce(
      new ConflictException('nodia_ai:proposal_invalidated'),
    );
    await expect(
      create(f).execute(f.identity, f.proposal.id, f.request),
    ).rejects.toThrow('nodia_ai:proposal_invalidated');
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
  });
  it.each(['challenge', 'proposal', 'session'])(
    'rejects %s expiry crossed during native material verification',
    async (reason) => {
      const f = fixture();
      if (reason === 'proposal')
        f.revision.expires_at = new Date(f.now.getTime() + 1000);
      if (reason === 'session')
        f.store.sessionExpiry.mockResolvedValueOnce(
          new Date(f.now.getTime() + 1000),
        );
      f.store.now.mockResolvedValueOnce(
        new Date(f.now.getTime() + (reason === 'challenge' ? 120000 : 2000)),
      );
      await expect(
        create(f).execute(f.identity, f.proposal.id, f.request),
      ).rejects.toThrow();
      expect(f.store.create).not.toHaveBeenCalled();
    },
  );
  it('rejects a saturated shared queue before consuming the nonce', async () => {
    const f = fixture();
    vi.mocked(f.manager.query).mockImplementation(async (sql: string) =>
      sql.includes('global_waiting')
        ? [
            {
              global_waiting: String(f.policy.queue.waiting_global),
              owner_waiting: '0',
            },
          ]
        : [],
    );
    await expect(
      create(f).execute(f.identity, f.proposal.id, f.request),
    ).rejects.toThrow('nodia_ai:execution_limit');
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.manager.query).not.toHaveBeenCalledWith(
      expect.stringContaining('SET consumed_at'),
      expect.anything(),
    );
  });
});
