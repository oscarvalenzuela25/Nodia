import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import type { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { GetNodiaAiProposalUseCase } from './get-nodia-ai-proposal.use-case.js';
import { proposalFixture } from './proposal.fixture.js';
function fixture() {
  const f = proposalFixture();
  return {
    ...f,
    get: new GetNodiaAiProposalUseCase(
      f.store as unknown as NodiaAiProposalService,
      f.authorize as unknown as AuthorizeNodiaAiUseCase,
      f.authorizeChat as unknown as AuthorizeNodiaAiConversationUseCase,
      f.validate,
      f.policy,
    ),
  };
}
describe('Observe immutable NodiaAI proposal', () => {
  it('reads an opted-in older snapshot without making it executable or editable', async () => {
    const f = fixture();
    const historical = vi.fn(async () => undefined);
    f.preparer.verifyHistoricalReadAuthority = historical;
    Object.assign(f.preparer, {
      contractHash: 'b'.repeat(64),
      catalogVersion: 'fixture/2',
    });
    const original = JSON.stringify([f.proposal, f.revision, f.step]);
    expect(await f.get.execute(f.identity, f.proposal.id)).toMatchObject({
      hash: f.revision.hash,
      state: 'invalidated',
    });
    expect(historical).toHaveBeenCalledOnce();
    expect(f.preparer.verifyAuthority).not.toHaveBeenCalled();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    await expect(
      f.get.load(f.manager, f.identity, f.proposal.id, 'write'),
    ).rejects.toThrow('nodia_ai:catalog_changed');
    expect(JSON.stringify([f.proposal, f.revision, f.step])).toBe(original);
  });
  it('does not expose a mismatched family without an explicit historical authority port', async () => {
    const f = fixture();
    Object.assign(f.preparer, { contractHash: 'b'.repeat(64) });
    await expect(f.get.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:catalog_changed',
    );
  });
  it('rechecks current historical authority and frozen integrity rather than trusting a prior read', async () => {
    const f = fixture();
    f.preparer.verifyHistoricalReadAuthority = vi.fn(async () => undefined);
    Object.assign(f.preparer, { contractHash: 'b'.repeat(64) });
    await f.get.execute(f.identity, f.proposal.id);
    vi.mocked(f.preparer.verifyHistoricalReadAuthority).mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    await expect(f.get.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
    f.step.command_template.name = 'tampered';
    await expect(f.get.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it('rechecks current resource authority without recalculating commands or preview', async () => {
    const f = fixture();
    const snapshot = JSON.stringify(f.step);
    const result = await f.get.execute(f.identity, f.proposal.id);
    expect(result.hash).toBe(f.revision.hash);
    expect(f.preparer.verifyAuthority).toHaveBeenCalledOnce();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(JSON.stringify(f.step)).toBe(snapshot);
    expect(f.store.proposal).toHaveBeenCalledTimes(2);
  });
  it('revocation prevents a previous successful projection from being returned', async () => {
    const f = fixture();
    await f.get.execute(f.identity, f.proposal.id);
    vi.mocked(f.preparer.verifyAuthority).mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    await expect(f.get.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
  });
  it('expired readiness is projected without modifying the frozen expiry or hash', async () => {
    const f = fixture();
    f.authorizeChat.execute.mockResolvedValueOnce({
      actor: f.actor,
      chat: f.chat,
      now: new Date(f.revision.expires_at),
    });
    const result = await f.get.execute(f.identity, f.proposal.id);
    expect(result.state).toBe('expired');
    expect(f.revision.state).toBe('ready');
    expect(result.hash).toBe(f.revision.hash);
  });
  it('rereads current revision after waiting for conversation authorization lock', async () => {
    const f = fixture();
    f.store.proposal
      .mockResolvedValueOnce({ ...f.proposal, current_revision: 1 })
      .mockResolvedValueOnce({ ...f.proposal, current_revision: 2 });
    await f.get.execute(f.identity, f.proposal.id);
    expect(f.store.revision).toHaveBeenCalledWith(f.manager, f.proposal.id, 2);
  });
  it('does not return corrupted projections or unknown proposals', async () => {
    const f = fixture();
    f.step.command_template.name = 'Tampered';
    await expect(f.get.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    const other = fixture();
    other.store.proposal.mockResolvedValueOnce(null as never);
    await expect(
      other.get.execute(other.identity, other.proposal.id),
    ).rejects.toThrow('nodia_ai:proposal_not_found');
  });
});
