import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { EntityManager } from 'typeorm';
import { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from './validate-nodia-ai-proposal.use-case.js';
import { NodiaAiProposal } from '../entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import { NodiaAiDraft } from '../entities/nodia-ai-draft.entity.js';
import type {
  PreparedProposalStep,
  ProposalPreparerContext,
} from '../types/proposal-preparer.types.js';

@Injectable()
export class PrepareNodiaAiProposalUseCase {
  constructor(
    private readonly store: NodiaAiProposalService,
    private readonly authorizeChat: AuthorizeNodiaAiConversationUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  /** Internal application port. Caller owns the active transaction and authority fence; never an HTTP/model command endpoint. */
  async execute(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    input: {
      conversationId: string;
      toolName: string;
      partial: NodiaAiJsonObject;
      toolCallId?: string;
      draftId?: string;
      expectedDraftRevision?: number;
    },
  ): Promise<NodiaAiJsonObject> {
    if (!manager.queryRunner?.isTransactionActive)
      throw new BadRequestException('authorization:transaction_required');
    // A stored envelope is a backend capability, not a format the model may nominate.
    if (!input.partial || typeof input.partial !== 'object' || Array.isArray(input.partial)
      || Object.hasOwn(input.partial, 'schema_version'))
      throw new BadRequestException('nodia_ai:invalid_input');
    await lockAuthority(
      manager,
      false,
      this.policy.timing.read_query_seconds * 1000,
    );
    const { actor, chat, now } = await this.authorizeChat.execute(
      manager,
      identity,
      input.conversationId,
      'write',
    );
    const preparer = this.validate.preparer(input.toolName);
    await this.authorize.execute(
      identity,
      { moduleRoutes: preparer.moduleRoutes, actionKeys: preparer.actionKeys },
      manager,
    );
    if (
      Buffer.byteLength(JSON.stringify(input.partial)) >
      this.policy.results.tool_arguments_utf8_bytes
    )
      throw new HttpException(
        'nodia_ai:execution_limit',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const context: ProposalPreparerContext = {
      manager,
      actor,
      conversationId: chat.id,
      moduleRoutes: actor.modules.map((module) => module.route),
      statementTimeoutMs: this.policy.timing.read_query_seconds * 1000,
      maxCollectionItems: this.policy.results.json_collection_items,
    };
    if (input.toolCallId) {
      const calls: { id: string }[] = await manager.query(
        'SELECT id FROM nodia_ai_tool_calls WHERE id=$1 AND conversation_id=$2',
        [input.toolCallId, chat.id],
      );
      if (calls.length !== 1)
        throw new BadRequestException('nodia_ai:invalid_input');
    }
    const existing = input.draftId
      ? await manager
          .getRepository(NodiaAiDraft)
          .findOneBy({ id: input.draftId, conversation_id: chat.id })
      : null;
    if (
      input.draftId &&
      (!existing ||
        existing.actor_id !== actor.actorId ||
        existing.tool_name !== preparer.toolName ||
        existing.catalog_version !== preparer.catalogVersion ||
        existing.state !== 'incomplete' ||
        existing.revision !== input.expectedDraftRevision)
    )
      throw new ConflictException('nodia_ai:revision_conflict');
    if (!input.draftId && input.expectedDraftRevision !== undefined)
      throw new BadRequestException('nodia_ai:invalid_input');
    const prepared = await preparer.prepare(
      input.partial,
      context,
      existing?.partial_command,
    );
    const draftId = existing?.id ?? randomUUID();
    if (prepared.status === 'needs_clarification') {
      if (!prepared.missingFields.length && !prepared.clarificationKeys.length)
        throw new BadRequestException('nodia_ai:invalid_input');
      const result: NodiaAiJsonObject = {
        status: prepared.status,
        draft_id: draftId,
        proposal: null,
        missing_fields: [...prepared.missingFields],
        clarification_keys: [...prepared.clarificationKeys],
        error: null,
      };
      this.validate.assert('PreparationResult', result);
      const draft = Object.assign(new NodiaAiDraft(), {
        id: draftId,
        conversation_id: chat.id,
        actor_id: actor.actorId,
        tool_call_id: existing?.tool_call_id ?? input.toolCallId ?? null,
        tool_name: preparer.toolName,
        catalog_version: preparer.catalogVersion,
        revision: 1,
        scope: {},
        partial_command: prepared.partial,
        clarifications: {
          missing_fields: [...prepared.missingFields],
          clarification_keys: [...prepared.clarificationKeys],
        },
        state: 'incomplete',
        claimed_proposal_id: null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
      draft.revision = (existing?.revision ?? 0) + 1;
      if (existing) await manager.getRepository(NodiaAiDraft).save(draft);
      else await this.store.insertDraft(manager, draft);
      return result;
    }
    const proposal = Object.assign(new NodiaAiProposal(), {
      id: randomUUID(),
      conversation_id: chat.id,
      actor_id: actor.actorId,
      current_revision: 1,
      created_at: now,
    });
    const revision = Object.assign(new NodiaAiProposalRevision(), {
      proposal_id: proposal.id,
      revision: 1,
      state: 'ready',
      hash: '',
      catalog_version: preparer.catalogVersion,
      canonicalization_version: 'jcs-rfc8785/1',
      created_at: now,
      expires_at: new Date(
        Math.min(
          chat.expires_at.getTime(),
          now.getTime() + this.policy.timing.proposal_seconds * 1000,
        ),
      ),
    });
    const step = this.step(
      proposal.id,
      1,
      1,
      preparer.toolName,
      preparer.contractHash,
      prepared,
    );
    await preparer.verifyAuthority(storedStep(step), context);
    const publicProposal = this.validate.compile(
      proposal,
      revision,
      [step],
      false,
    );
    revision.hash = String(publicProposal.hash);
    await this.store.create(manager, proposal, revision, [step]);
    const draft = Object.assign(new NodiaAiDraft(), {
      id: draftId,
      conversation_id: chat.id,
      actor_id: actor.actorId,
      tool_call_id: existing?.tool_call_id ?? input.toolCallId ?? null,
      tool_name: preparer.toolName,
      catalog_version: preparer.catalogVersion,
      revision: 1,
      scope: prepared.scope,
      partial_command: prepared.commandTemplate,
      clarifications: { missing_fields: [], clarification_keys: [] },
      state: 'ready',
      claimed_proposal_id: proposal.id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
    draft.revision = (existing?.revision ?? 0) + 1;
    if (existing) await manager.getRepository(NodiaAiDraft).save(draft);
    else await this.store.insertDraft(manager, draft);
    await this.store.publishReady(
      manager,
      proposal,
      publicProposal,
      preparer.moduleRoutes,
      this.policy.results.outbox_events_per_activity,
    );
    const result: NodiaAiJsonObject = {
      status: 'ready',
      draft_id: draftId,
      proposal: publicProposal,
      missing_fields: [],
      clarification_keys: [],
      error: null,
    };
    this.validate.assert('PreparationResult', result);
    return result;
  }
  step(
    proposalId: string,
    revision: number,
    position: number,
    name: string,
    hash: string,
    prepared: PreparedProposalStep,
    id: string = randomUUID(),
  ) {
    const publicStep: NodiaAiJsonObject = {
      ...prepared.publicStep,
      step_id: id,
    };
    return Object.assign(new NodiaAiProposalStep(), {
      id,
      proposal_id: proposalId,
      proposal_revision: revision,
      position,
      tool_name: name,
      contract_hash: hash,
      kind: String(publicStep.kind),
      effect_key: String(publicStep.effect_key),
      scope: prepared.scope,
      command_template: prepared.commandTemplate,
      public_step: publicStep,
      output_bindings: publicStep.output_bindings,
      preconditions: prepared.preconditions,
    });
  }
}
