import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { NodiaAiProposalService } from '../../nodia-ai-proposal/nodia-ai-proposal.service.js';
import type { NodiaAiProposalReviewField } from '../../nodia-ai-proposal/types/proposal-review.types.js';
import { proposalFixture } from '../../nodia-ai-proposal/use-case/proposal.fixture.js';
import { NodiaAiConfirmationAvailabilityUseCase } from '../../nodia-ai-confirmation/use-case/nodia-ai-confirmation-availability.use-case.js';
import { GetNodiaAiProposalReviewUseCase } from './get-nodia-ai-proposal-review.use-case.js';
function fixture() {
  const f = proposalFixture();
  const field: NodiaAiProposalReviewField = {
    field_key: 'name',
    label_key: 'nodia_ai:proposal_field_name',
    kind: 'text',
    nullable: false,
    max_length: 255,
    minimum: null,
    maximum: null,
    options: [],
  };
  Object.assign(f.preparer, { reviewFields: [field] });
  const loaded = {
    catalogCompatible: true,
    proposal: f.proposal,
    revision: f.revision,
    steps: [f.step],
    actor: f.actor,
    chat: f.chat,
    now: f.now,
  };
  const get = { load: vi.fn(async () => loaded) };
  const useCase = new GetNodiaAiProposalReviewUseCase(
    f.store as unknown as NodiaAiProposalService,
    get as unknown as GetNodiaAiProposalUseCase,
    f.validate,
    new NodiaAiConfirmationAvailabilityUseCase([]),
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    f.policy,
  );
  return { ...f, field, loaded, get, useCase };
}
describe('NodiaAI human-only exact preview affordances', () => {
  it('does not offer edits or confirmation for an authorized incompatible historical snapshot', async () => {
    const f = fixture();
    f.loaded.catalogCompatible = false;
    const preparer = vi.spyOn(f.validate, 'preparer');
    const result = await f.useCase.execute(f.identity, f.proposal.id);
    expect(result).toMatchObject({
      hash: f.revision.hash,
      read_only: true,
      editable_fields: [],
      confirmation: { available: false, reason: 'nodia_ai:proposal_read_only' },
    });
    expect(preparer).not.toHaveBeenCalled();
  });
  it('returns the exact revision/hash and registered scalar fields without minting a nonce', async () => {
    const f = fixture();
    const snapshot = JSON.stringify(f.step);
    const result = await f.useCase.execute(f.identity, f.proposal.id);
    expect(result).toEqual({
      proposal_id: f.proposal.id,
      revision: 1,
      hash: f.revision.hash,
      read_only: false,
      editable_fields: [{ ...f.field, step_id: f.step.id }],
      confirmation: {
        available: false,
        reason: 'nodia_ai:execution_unavailable',
      },
    });
    expect(Object.keys(result)).not.toContain('confirmation_token');
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.preparer.applyEdits).not.toHaveBeenCalled();
    expect(JSON.stringify(f.step)).toBe(snapshot);
  });
  it.each(['foreign', 'historical', 'expired', 'cancelled', 'confirmed'])(
    'keeps a %s proposal read-only',
    async (reason) => {
      const f = fixture();
      if (reason === 'foreign') {
        f.actor.actorId = '2';
        f.actor.isSuperAdmin = true;
      }
      if (reason === 'historical') f.proposal.current_revision = 2;
      if (reason === 'expired') f.revision.expires_at = f.now;
      if (reason === 'cancelled') f.revision.state = 'cancelled';
      if (reason === 'confirmed') f.revision.state = 'confirmed';
      const result = await f.useCase.execute(f.identity, f.proposal.id, 1);
      expect(result.read_only).toBe(true);
      expect(result.editable_fields).toEqual([]);
      expect(result.confirmation).toEqual({
        available: false,
        reason: 'nodia_ai:proposal_read_only',
      });
      expect(f.get.load).toHaveBeenCalledWith(
        f.manager,
        f.identity,
        f.proposal.id,
        'read',
        1,
      );
    },
  );
  it('rechecks authorization before exposing metadata', async () => {
    const f = fixture();
    f.get.load.mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    await expect(f.useCase.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
  });
  it.each(['bound', 'not_editable', 'absent'])(
    'does not expose %s values as editable controls',
    async (reason) => {
      const f = fixture();
      if (reason === 'bound')
        f.step.output_bindings = [
          {
            target_field_key: 'name',
            from_step_id: f.step.id,
            output_key: 'id',
          },
        ];
      if (reason === 'not_editable')
        Object.assign(f.preparer, { editableFields: {} });
      if (reason === 'absent') {
        const changes = f.step.public_step.changes as {
          after_present: boolean;
        }[];
        changes[0].after_present = false;
      }
      expect(
        (await f.useCase.execute(f.identity, f.proposal.id)).editable_fields,
      ).toEqual([]);
    },
  );
  it('refuses object/array editors and unknown descriptor fields at the schema boundary', async () => {
    const f = fixture();
    Object.assign(f.preparer, {
      reviewFields: [{ ...f.field, kind: 'object' }],
    });
    await expect(f.useCase.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    Object.assign(f.preparer, {
      reviewFields: [{ ...f.field, endpoint: '/execute' }],
    });
    await expect(f.useCase.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it('can advertise confirmation only from a registered executable contract', async () => {
    const f = fixture();
    const useCase = new GetNodiaAiProposalReviewUseCase(
      f.store as unknown as NodiaAiProposalService,
      f.get as unknown as GetNodiaAiProposalUseCase,
      f.validate,
      new NodiaAiConfirmationAvailabilityUseCase([
        {
          toolName: f.preparer.toolName,
          contractHash: f.preparer.contractHash,
          catalogVersion: f.revision.catalog_version,
        },
      ]),
      readFileSync(
        new URL(
          '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
          import.meta.url,
        ),
        'utf8',
      ),
      f.policy,
    );
    expect(
      (await useCase.execute(f.identity, f.proposal.id)).confirmation,
    ).toEqual({ available: true, reason: null });
  });
});
