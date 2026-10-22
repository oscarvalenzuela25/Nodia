import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import type { NodiaAiProposalPreparer } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  conversationFixture,
  testChatId,
  testIdentity,
} from '../../nodia-ai-conversation/use-case/conversation-admission.fixture.js';
import {
  ObserveNodiaAiProposalsUseCase,
  proposalEventKey,
  type ProposalEventReference,
} from './observe-nodia-ai-proposals.use-case.js';

function fixture() {
  const { policy } = conversationFixture();
  const actor = {
    actorId: testIdentity.userId,
    sessionId: testIdentity.sessionId,
    isSuperAdmin: false,
    modules: [{ id: '1', key: 'finance', route: '/finance' }],
  };
  const preparer: NodiaAiProposalPreparer = {
    toolName: 'nodia_test_prepare',
    contractHash: 'a'.repeat(64),
    catalogVersion: 'test/1',
    moduleRoutes: ['/finance'],
    actionKeys: [],
    editableFields: { name: 'string' },
    bindableFields: {},
    outputKeys: { id: 'record_id' },
    prepare: vi.fn(async () => {
      throw new Error('Observation must not prepare');
    }),
    applyEdits: vi.fn(async () => {
      throw new Error('Observation must not edit');
    }),
    verifyAuthority: vi.fn(async () => undefined),
  };
  const validate = new ValidateNodiaAiProposalUseCase(
    [preparer],
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
  const now = new Date('2026-10-16T12:00:00Z');
  const proposal = Object.assign(new NodiaAiProposal(), {
    id: randomUUID(),
    conversation_id: testChatId,
    actor_id: '1',
    current_revision: 1,
    created_at: now,
  });
  const revision = Object.assign(new NodiaAiProposalRevision(), {
    proposal_id: proposal.id,
    revision: 1,
    state: 'ready',
    hash: '',
    catalog_version: 'test/1',
    canonicalization_version: 'jcs-rfc8785/1',
    created_at: now,
    expires_at: new Date(now.getTime() + 900000),
  });
  const id = randomUUID();
  const step = Object.assign(new NodiaAiProposalStep(), {
    id,
    proposal_id: proposal.id,
    proposal_revision: 1,
    position: 1,
    tool_name: preparer.toolName,
    contract_hash: preparer.contractHash,
    kind: 'domain_change',
    effect_key: 'record.create',
    scope: { subject_user_id: '1' },
    command_template: { name: 'Comida' },
    preconditions: { observed_version: '1' },
    output_bindings: [],
    public_step: {
      step_id: id,
      tool_name: preparer.toolName,
      kind: 'domain_change',
      effect_key: 'record.create',
      target: null,
      scope: { subject_user_id: '1' },
      changes: [
        {
          field_key: 'name',
          before: null,
          before_present: false,
          after: 'Comida',
          after_present: true,
          origin: 'user',
        },
      ],
      depends_on: [],
      output_bindings: [],
    },
  });
  revision.hash = String(
    validate.compile(proposal, revision, [step], false).hash,
  );
  const proposals = [proposal],
    revisions = [revision],
    steps = [step];
  const proposalFind = vi.fn(async (_options: unknown) => proposals);
  const revisionFind = vi.fn(async (_options: unknown) => revisions);
  const stepFind = vi.fn(async (_options: unknown) => steps);
  const getRepository = vi.fn((entity: unknown) => {
    if (entity === NodiaAiProposal) return { findBy: proposalFind };
    if (entity === NodiaAiProposalRevision) return { find: revisionFind };
    if (entity === NodiaAiProposalStep) return { find: stepFind };
    throw new Error('Observation may not query business resources');
  });
  const manager = {
    getRepository,
    query: vi.fn(async () => {
      throw new Error('No arbitrary or business SQL');
    }),
  } as unknown as EntityManager;
  const filterAuthorized = vi.fn(
    async (_identity: unknown, requirements: readonly unknown[]) => ({
      actor,
      allowed: requirements.map(() => true),
    }),
  );
  const subject = new ObserveNodiaAiProposalsUseCase(
    validate,
    { filterAuthorized } as unknown as AuthorizeNodiaAiUseCase,
    policy,
  );
  const ref: ProposalEventReference = {
    proposal_id: proposal.id,
    revision: 1,
    hash: revision.hash,
  };
  const execute = (refs: readonly ProposalEventReference[] = [ref]) =>
    subject.execute(manager, testIdentity, testChatId, actor, refs);
  return {
    subject,
    execute,
    manager,
    actor,
    preparer,
    validate,
    policy,
    proposal,
    revision,
    step,
    proposals,
    revisions,
    steps,
    ref,
    proposalFind,
    revisionFind,
    stepFind,
    filterAuthorized,
    getRepository,
  };
}

describe('ObserveNodiaAiProposalsUseCase', () => {
  it('does no work for an empty feed', async () => {
    const f = fixture();
    expect(await f.execute([])).toEqual(new Set());
    expect(f.getRepository).not.toHaveBeenCalled();
    expect(f.filterAuthorized).not.toHaveBeenCalled();
  });
  it('batches three payload reads, deduplicates refs and never prepares or edits', async () => {
    const f = fixture();
    expect(await f.execute([f.ref, f.ref])).toEqual(
      new Set([proposalEventKey(f.ref)]),
    );
    expect(f.proposalFind).toHaveBeenCalledTimes(1);
    expect(f.revisionFind).toHaveBeenCalledTimes(1);
    expect(f.stepFind).toHaveBeenCalledTimes(1);
    expect(f.filterAuthorized).toHaveBeenCalledTimes(1);
    expect(f.preparer.verifyAuthority).toHaveBeenCalledTimes(1);
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.preparer.applyEdits).not.toHaveBeenCalled();
    expect(f.manager.query).not.toHaveBeenCalled();
  });
  it('can observe the exact superseded revision without replacing it with the current revision', async () => {
    const f = fixture();
    f.proposal.current_revision = 2;
    f.revision.state = 'superseded';
    expect(await f.execute()).toEqual(new Set([proposalEventKey(f.ref)]));
    expect(f.revisionFind.mock.calls[0][0]).toEqual({
      where: [{ proposal_id: f.proposal.id, revision: 1 }],
    });
    expect(f.preparer.verifyAuthority).toHaveBeenCalledWith(
      expect.objectContaining({
        id: f.step.id,
        commandTemplate: { name: 'Comida' },
      }),
      expect.anything(),
    );
  });
  it('authorizes multiple proposals in one batch rather than one authority query per event', async () => {
    const f = fixture();
    const secondProposal = Object.assign(new NodiaAiProposal(), {
      ...f.proposal,
      id: randomUUID(),
    });
    const secondRevision = Object.assign(new NodiaAiProposalRevision(), {
      ...f.revision,
      proposal_id: secondProposal.id,
      hash: '',
    });
    const stepId = randomUUID();
    const secondStep = Object.assign(new NodiaAiProposalStep(), {
      ...f.step,
      id: stepId,
      proposal_id: secondProposal.id,
      public_step: { ...f.step.public_step, step_id: stepId },
    });
    secondRevision.hash = String(
      f.validate.compile(secondProposal, secondRevision, [secondStep], false)
        .hash,
    );
    f.proposals.push(secondProposal);
    f.revisions.push(secondRevision);
    f.steps.push(secondStep);
    const secondRef = {
      proposal_id: secondProposal.id,
      revision: 1,
      hash: secondRevision.hash,
    };
    expect(await f.execute([f.ref, secondRef])).toEqual(
      new Set([proposalEventKey(f.ref), proposalEventKey(secondRef)]),
    );
    expect(f.filterAuthorized).toHaveBeenCalledTimes(1);
    expect(f.filterAuthorized.mock.calls[0][1]).toHaveLength(2);
    expect(f.preparer.verifyAuthority).toHaveBeenCalledTimes(2);
    expect(f.getRepository).toHaveBeenCalledTimes(3);
  });
  it('does not load private revision/step payload when the referenced proposal belongs to another chat', async () => {
    const f = fixture();
    f.proposal.conversation_id = randomUUID();
    expect(await f.execute()).toEqual(new Set());
    expect(f.revisionFind).not.toHaveBeenCalled();
    expect(f.stepFind).not.toHaveBeenCalled();
    expect(f.filterAuthorized).not.toHaveBeenCalled();
  });
  it('queries only references actually belonging to the requested chat', async () => {
    const f = fixture();
    const foreign = {
      proposal_id: randomUUID(),
      revision: 9,
      hash: 'b'.repeat(64),
    };
    expect(await f.execute([foreign, f.ref])).toEqual(
      new Set([proposalEventKey(f.ref)]),
    );
    expect(f.revisionFind.mock.calls[0][0]).toEqual({
      where: [{ proposal_id: f.proposal.id, revision: 1 }],
    });
    expect(f.stepFind.mock.calls[0][0]).toMatchObject({
      where: [{ proposal_id: f.proposal.id, proposal_revision: 1 }],
    });
  });
  it('hides an absent proposal reference without revealing whether it exists elsewhere', async () => {
    const f = fixture();
    f.proposals.length = 0;
    expect(await f.execute()).toEqual(new Set());
  });
  it('fails closed for a local event hash/revision mismatch', async () => {
    const f = fixture();
    await expect(
      f.execute([{ ...f.ref, hash: 'c'.repeat(64) }]),
    ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    f.revisions.length = 0;
    await expect(f.execute()).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it('detects persisted command tampering using the real compiler and hash', async () => {
    const f = fixture();
    f.step.command_template.name = 'Mutated after freeze';
    await expect(f.execute()).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    expect(f.filterAuthorized).not.toHaveBeenCalled();
  });
  it('hides a retired or unknown preparer without invoking any handler', async () => {
    const f = fixture();
    vi.spyOn(f.validate, 'preparer').mockImplementation(() => {
      throw new BadRequestException('nodia_ai:catalog_changed');
    });
    expect(await f.execute()).toEqual(new Set());
    expect(f.preparer.verifyAuthority).not.toHaveBeenCalled();
    expect(f.filterAuthorized).not.toHaveBeenCalled();
  });
  it('current module/action denial hides the reference before scope checks', async () => {
    const f = fixture();
    f.filterAuthorized.mockResolvedValue({ actor: f.actor, allowed: [false] });
    expect(await f.execute()).toEqual(new Set());
    expect(f.preparer.verifyAuthority).not.toHaveBeenCalled();
  });
  it.each([
    new ForbiddenException('scope revoked'),
    new NotFoundException('resource hidden'),
  ])('hides a reference on current native scope denial %s', async (error) => {
    const f = fixture();
    vi.mocked(f.preparer.verifyAuthority).mockRejectedValue(error);
    expect(await f.execute()).toEqual(new Set());
  });
  it('passes fresh authorization to native scope checks rather than stale caller metadata', async () => {
    const f = fixture();
    const fresh = {
      ...f.actor,
      modules: [{ id: '2', key: 'current', route: '/current' }],
    };
    f.filterAuthorized.mockResolvedValue({ actor: fresh, allowed: [true] });
    await f.execute();
    expect(f.preparer.verifyAuthority).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actor: fresh, moduleRoutes: ['/current'] }),
    );
  });
  it('does not hide invalid sessions or operational failures as an empty successful feed', async () => {
    const f = fixture();
    f.filterAuthorized.mockRejectedValue(
      new UnauthorizedException('auth:session_expired'),
    );
    await expect(f.execute()).rejects.toThrow('auth:session_expired');
    f.filterAuthorized.mockResolvedValue({ actor: f.actor, allowed: [true] });
    vi.mocked(f.preparer.verifyAuthority).mockRejectedValue(
      new Error('operational failure'),
    );
    await expect(f.execute()).rejects.toThrow('operational failure');
  });
  it('accepts 256 raw references and rejects 257 before database work', async () => {
    const f = fixture();
    expect(f.policy.results.outbox_events_per_activity).toBe(256);
    expect(await f.execute(Array.from({ length: 256 }, () => f.ref))).toEqual(
      new Set([proposalEventKey(f.ref)]),
    );
    f.getRepository.mockClear();
    await expect(
      f.execute(Array.from({ length: 257 }, () => f.ref)),
    ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    expect(f.getRepository).not.toHaveBeenCalled();
  });
  it.each([
    { revision: 0 },
    { revision: 1.5 },
    { revision: 2147483648 },
    { hash: 'invalid' },
    { proposal_id: 'invalid' },
  ])(
    'rejects malformed persisted references before queries %j',
    async (patch) => {
      const f = fixture();
      await expect(f.execute([{ ...f.ref, ...patch }])).rejects.toThrow(
        'nodia_ai:invalid_persisted_state',
      );
      expect(f.getRepository).not.toHaveBeenCalled();
    },
  );
  it('bounds the step query and rejects rows beyond the per-reference step budget', async () => {
    const f = fixture();
    f.steps.push(...Array.from({ length: 8 }, () => f.step));
    await expect(f.execute()).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
    expect(f.stepFind.mock.calls[0][0]).toMatchObject({ take: 9 });
  });
});
