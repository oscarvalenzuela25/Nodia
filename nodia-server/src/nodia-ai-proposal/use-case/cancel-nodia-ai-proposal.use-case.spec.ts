import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { CancelNodiaAiProposalDto } from '../dto/nodia-ai-proposal.dto.js';
import type { GetNodiaAiProposalUseCase } from './get-nodia-ai-proposal.use-case.js';
import { CancelNodiaAiProposalUseCase } from './cancel-nodia-ai-proposal.use-case.js';
import { proposalFixture } from './proposal.fixture.js';
function fixture() {
  const f = proposalFixture();
  const update = vi.fn(async () => undefined);
  Object.assign(f.manager, { getRepository: () => ({ update }) });
  const get = {
    load: vi.fn(async () => ({
      proposal: f.proposal,
      revision: f.revision,
      steps: [f.step],
      now: f.now,
    })),
  };
  const cancel = new CancelNodiaAiProposalUseCase(
    f.store as unknown as NodiaAiProposalService,
    get as unknown as GetNodiaAiProposalUseCase,
    f.validate,
    f.policy,
  );
  const command = {
    client_request_id: randomUUID(),
    expected_proposal_revision: 1,
  };
  return { ...f, get, cancel, update, command };
}
describe('Cancel NodiaAI proposal from the human channel', () => {
  it('accepts an exact transformed HTTP DTO and preserves the frozen command/hash', async () => {
    const f = fixture();
    const before = JSON.stringify(f.step);
    const hash = f.revision.hash;
    const dto = plainToInstance(CancelNodiaAiProposalDto, f.command);
    const result = await f.cancel.execute(f.identity, f.proposal.id, dto);
    expect(result.state).toBe('cancelled');
    expect(result.hash).toBe(hash);
    expect(f.update).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(f.step)).toBe(before);
    expect(f.get.load).toHaveBeenCalledWith(
      f.manager,
      f.identity,
      f.proposal.id,
      'write',
    );
  });
  it('rejects unknown DTO keys instead of silently projecting them away', async () => {
    const f = fixture();
    const dto = plainToInstance(CancelNodiaAiProposalDto, {
      ...f.command,
      expected_hash: 'a'.repeat(64),
    });
    await expect(
      f.cancel.execute(f.identity, f.proposal.id, dto),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.update).not.toHaveBeenCalled();
  });
  it('does not evaluate accessor properties from a DTO', async () => {
    const f = fixture();
    const dto = plainToInstance(CancelNodiaAiProposalDto, f.command);
    const getter = vi.fn(() => 1);
    Object.defineProperty(dto, 'expected_proposal_revision', {
      get: getter,
      enumerable: true,
    });
    await expect(
      f.cancel.execute(f.identity, f.proposal.id, dto),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(getter).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
  it('rejects stale revision before writing cancellation', async () => {
    const f = fixture();
    await expect(
      f.cancel.execute(f.identity, f.proposal.id, {
        ...f.command,
        expected_proposal_revision: 2,
      }),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.update).not.toHaveBeenCalled();
  });
});
