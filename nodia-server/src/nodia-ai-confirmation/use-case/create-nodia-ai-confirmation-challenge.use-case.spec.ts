import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import { CreateNodiaAiConfirmationChallengeUseCase } from './create-nodia-ai-confirmation-challenge.use-case.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import { confirmationFixture } from './confirmation.fixture.js';
function fixture() {
  const f = confirmationFixture();
  const useCase = new CreateNodiaAiConfirmationChallengeUseCase(
    f.store as unknown as NodiaAiConfirmationService,
    f.get as unknown as GetNodiaAiProposalUseCase,
    f.validate,
    f.availability,
    f.policy,
  );
  return { ...f, useCase };
}
describe('NodiaAI human confirmation challenge', () => {
  it('returns an opaque 256-bit nonce only to caller and persists only its digest', async () => {
    const f = fixture();
    const result = await f.useCase.execute(f.identity, f.proposal.id, {
      proposal_revision: 1,
      expected_hash: f.revision.hash,
    });
    expect(result.confirmation_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const saved = f.store.issue.mock.calls[0][1];
    expect(saved.token_hash).toBe(
      createHash('sha256').update(result.confirmation_token).digest('hex'),
    );
    expect(JSON.stringify(saved)).not.toContain(result.confirmation_token);
    expect(saved.actor_id).toBe(f.actor.actorId);
    expect(saved.session_public_id).toBe(f.identity.sessionId);
    expect(saved.proposal_revision).toBe(1);
    expect(saved.expected_hash).toBe(f.revision.hash);
    expect(result.expires_at).toBe(
      new Date(f.now.getTime() + 120000).toISOString(),
    );
  });
  it('caps nonce validity at the earliest native session and proposal expiry', async () => {
    const f = fixture();
    const expires = new Date(f.now.getTime() + 15000);
    f.store.sessionExpiry.mockResolvedValueOnce(expires);
    expect(
      (
        await f.useCase.execute(f.identity, f.proposal.id, {
          proposal_revision: 1,
          expected_hash: f.revision.hash,
        })
      ).expires_at,
    ).toBe(expires.toISOString());
    f.revision.expires_at = new Date(f.now.getTime() + 10000);
    expect(
      (
        await f.useCase.execute(f.identity, f.proposal.id, {
          proposal_revision: 1,
          expected_hash: f.revision.hash,
        })
      ).expires_at,
    ).toBe(f.revision.expires_at.toISOString());
  });
  it.each(['hash', 'revision', 'expired', 'cancelled', 'busy', 'session'])(
    'rejects %s without storing a nonce',
    async (reason) => {
      const f = fixture();
      const request = { proposal_revision: 1, expected_hash: f.revision.hash };
      if (reason === 'hash') request.expected_hash = 'b'.repeat(64);
      if (reason === 'revision') request.proposal_revision = 2;
      if (reason === 'expired') f.revision.expires_at = f.now;
      if (reason === 'cancelled') f.revision.state = 'cancelled';
      if (reason === 'busy') f.chat.active_job_id = randomUUID() as never;
      if (reason === 'session')
        f.store.sessionExpiry.mockResolvedValueOnce(null as never);
      await expect(
        f.useCase.execute(f.identity, f.proposal.id, request),
      ).rejects.toThrow();
      expect(f.store.issue).not.toHaveBeenCalled();
    },
  );
  it('keeps production admission closed independently of configuration or authentication', async () => {
    const f = fixture();
    const useCase = new CreateNodiaAiConfirmationChallengeUseCase(
      f.store as unknown as NodiaAiConfirmationService,
      f.get as unknown as GetNodiaAiProposalUseCase,
      f.validate,
      new NodiaAiConfirmationAvailabilityUseCase([]),
      f.policy,
    );
    await expect(
      useCase.execute(f.identity, f.proposal.id, {
        proposal_revision: 1,
        expected_hash: f.revision.hash,
      }),
    ).rejects.toThrow('nodia_ai:execution_unavailable');
    expect(f.store.issue).not.toHaveBeenCalled();
  });
  it('does not issue for a denied owner or revoked resource', async () => {
    const f = fixture();
    f.get.load.mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    await expect(
      f.useCase.execute(f.identity, f.proposal.id, {
        proposal_revision: 1,
        expected_hash: f.revision.hash,
      }),
    ).rejects.toThrow('nodia_ai:capability_denied');
    expect(f.store.issue).not.toHaveBeenCalled();
  });
});
