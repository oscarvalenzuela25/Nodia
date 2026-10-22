import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import type {
  NodiaAiActorReference,
  NodiaAiAuthorizedActor,
} from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';

export interface ProposalEventReference {
  proposal_id: string;
  revision: number;
  hash: string;
}
export const proposalEventKey = (ref: ProposalEventReference) =>
  `${ref.proposal_id}:${ref.revision}:${ref.hash}`;
function denied(error: unknown): boolean {
  return (
    error instanceof Error &&
    (('getStatus' in error &&
      typeof error.getStatus === 'function' &&
      [403, 404, 409, 410].includes(error.getStatus())) ||
      ['nodia_ai:capability_denied', 'nodia_ai:catalog_changed'].includes(
        error.message,
      ))
  );
}

/** Three bounded batch reads, then native scope checks. No preparation, business reads or provider calls. */
@Injectable()
export class ObserveNodiaAiProposalsUseCase {
  constructor(
    private readonly validate: ValidateNodiaAiProposalUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    conversationId: string,
    actor: NodiaAiAuthorizedActor,
    references: readonly ProposalEventReference[],
  ): Promise<Set<string>> {
    const allowed = new Set<string>();
    if (!references.length) return allowed;
    const fail = (): never => {
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    };
    if (
      references.length > this.policy.results.outbox_events_per_activity ||
      references.some(
        (ref) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
            ref.proposal_id,
          ) ||
          !Number.isSafeInteger(ref.revision) ||
          ref.revision < 1 ||
          ref.revision > 2147483647 ||
          !/^[0-9a-f]{64}$/.test(ref.hash),
      )
    )
      fail();
    const unique = [
      ...new Map(
        references.map((ref) => [proposalEventKey(ref), ref]),
      ).values(),
    ];
    const ids = [...new Set(unique.map((ref) => ref.proposal_id))];
    const proposals = await manager
      .getRepository(NodiaAiProposal)
      .findBy({ id: In(ids), conversation_id: conversationId });
    const own = proposals.filter(
      (proposal) => proposal.conversation_id === conversationId,
    );
    const keys = unique
      .filter((ref) => own.some((proposal) => proposal.id === ref.proposal_id))
      .map((ref) => ({ proposal_id: ref.proposal_id, revision: ref.revision }));
    if (!keys.length) return allowed;
    const revisions = await manager
      .getRepository(NodiaAiProposalRevision)
      .find({ where: keys });
    const maxSteps = keys.length * this.policy.budget.steps_per_proposal;
    const steps = await manager
      .getRepository(NodiaAiProposalStep)
      .find({
        where: keys.map((key) => ({
          proposal_id: key.proposal_id,
          proposal_revision: key.revision,
        })),
        order: { position: 'ASC' },
        take: maxSteps + 1,
      });
    if (steps.length > maxSteps) fail();
    const candidates: {
      ref: ProposalEventReference;
      selected: NodiaAiProposalStep[];
      preparers: ReturnType<ValidateNodiaAiProposalUseCase['preparer']>[];
    }[] = [];
    for (const ref of unique) {
      const proposal = own.find((row) => row.id === ref.proposal_id);
      if (!proposal) continue;
      const revision = revisions.find(
        (row) =>
          row.proposal_id === ref.proposal_id && row.revision === ref.revision,
      );
      if (!revision || revision.hash !== ref.hash) return fail();
      const selected = steps.filter(
        (row) =>
          row.proposal_id === ref.proposal_id &&
          row.proposal_revision === ref.revision,
      );
      try {
        this.validate.compile(proposal, revision, selected);
        const preparers = selected.map((step) =>
          this.validate.preparer(step.tool_name, step.contract_hash),
        );
        candidates.push({ ref, selected, preparers });
      } catch (error) {
        if (!denied(error)) throw error;
      }
    }
    if (!candidates.length) return allowed;
    const access = await this.authorize.filterAuthorized(
      identity,
      candidates.flatMap((candidate) =>
        candidate.preparers.map((preparer) => ({
          moduleRoutes: preparer.moduleRoutes,
          actionKeys: preparer.actionKeys,
        })),
      ),
      manager,
    );
    if (
      access.actor.actorId !== identity.userId ||
      access.actor.sessionId.toLowerCase() !==
        identity.sessionId.toLowerCase() ||
      actor.actorId !== identity.userId
    )
      fail();
    const context = {
      manager,
      actor: access.actor,
      conversationId,
      moduleRoutes: access.actor.modules.map((module) => module.route),
      statementTimeoutMs: this.policy.timing.read_query_seconds * 1000,
      maxCollectionItems: this.policy.results.json_collection_items,
    };
    let offset = 0;
    for (const { ref, selected, preparers } of candidates) {
      const permitted = access.allowed.slice(offset, offset + preparers.length);
      offset += preparers.length;
      if (permitted.length !== preparers.length || !permitted.every(Boolean))
        continue;
      try {
        for (const [index, step] of selected.entries())
          await preparers[index].verifyAuthority(storedStep(step), context);
        allowed.add(proposalEventKey(ref));
      } catch (error) {
        if (!denied(error)) throw error;
      }
    }
    return allowed;
  }
}
