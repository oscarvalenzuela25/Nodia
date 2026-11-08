import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from './validate-nodia-ai-proposal.use-case.js';
import type { ProposalPreparerContext } from '../types/proposal-preparer.types.js';

@Injectable()
export class GetNodiaAiProposalUseCase {
  constructor(
    private readonly store: NodiaAiProposalService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly authorizeChat: AuthorizeNodiaAiConversationUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    identity: NodiaAiActorReference,
    id: string,
    revision?: number,
  ) {
    const key = conversationId(id);
    if (
      revision !== undefined &&
      (!Number.isSafeInteger(revision) || revision < 1 || revision > 2147483647)
    )
      throw new NotFoundException('nodia_ai:proposal_not_found');
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      return this.executeInTransaction(manager, identity, key, revision);
    });
  }
  /** Native read using the caller's authority transaction; MCP binds the conversation explicitly. */
  async executeInTransaction(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    id: string,
    revision?: number,
    knownChat?: string,
  ) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new InternalServerErrorException(
        'authorization:transaction_required',
      );
    const key = conversationId(id);
    if (
      revision !== undefined &&
      (!Number.isSafeInteger(revision) || revision < 1 || revision > 2147483647)
    )
      throw new NotFoundException('nodia_ai:proposal_not_found');
    await this.authorize.execute(identity, {}, manager);
    const loaded = await this.load(
      manager,
      identity,
      key,
      'read',
      revision,
      knownChat,
    );
    const projection = loaded.projection;
    if (loaded.revision.state === 'confirmed') {
      const executions: { id: string }[] = await manager.query(
        `SELECT id FROM nodia_ai_executions WHERE proposal_id=$1 AND origin_proposal_id=$1 AND origin_proposal_revision=$2 AND proposal_hash=$3 AND conversation_id=$4`,
        [
          loaded.proposal.id,
          loaded.revision.revision,
          loaded.revision.hash,
          loaded.chat.id,
        ],
      );
      if (executions.length !== 1)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      projection.execution_id = executions[0].id;
    }
    if (
      loaded.revision.state === 'ready' &&
      loaded.now >= loaded.revision.expires_at
    )
      projection.state = 'expired';
    else if (!loaded.catalogCompatible && loaded.revision.state === 'ready')
      projection.state = 'invalidated';
    return projection;
  }
  /** Shared by human mutations in their short, already fenced transaction. */
  async load(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    id: string,
    mode: 'read' | 'write',
    revisionNumber?: number,
    knownChat?: string,
  ) {
    const initial = await this.store.proposal(manager, id);
    if (!initial || (knownChat && initial.conversation_id !== knownChat))
      throw new NotFoundException('nodia_ai:proposal_not_found');
    const authorized = await this.authorizeChat.execute(
      manager,
      identity,
      initial.conversation_id,
      mode,
      'proposal',
    );
    // Another device can advance the revision while this request waits for the chat lock.
    const proposal = await this.store.proposal(manager, id);
    if (!proposal || proposal.conversation_id !== initial.conversation_id)
      throw new NotFoundException('nodia_ai:proposal_not_found');
    const revision = await this.store.revision(
      manager,
      id,
      revisionNumber ?? proposal.current_revision,
    );
    if (!revision) throw new NotFoundException('nodia_ai:proposal_not_found');
    const steps = await this.store.steps(manager, id, revision.revision);
    const catalogCompatible = this.validate.isCompatible(revision, steps);
    const historical = mode === 'read' && !catalogCompatible;
    const projection = historical
      ? this.validate.compileHistorical(proposal, revision, steps)
      : this.validate.compile(proposal, revision, steps);
    const context: ProposalPreparerContext = {
      manager,
      actor: authorized.actor,
      conversationId: proposal.conversation_id,
      moduleRoutes: authorized.actor.modules.map((module) => module.route),
      statementTimeoutMs: this.policy.timing.read_query_seconds * 1000,
      maxCollectionItems: this.policy.results.json_collection_items,
    };
    for (const step of steps) {
      const preparer = historical
        ? this.validate.historicalPreparer(step.tool_name)
        : this.validate.preparer(step.tool_name, step.contract_hash);
      await this.authorize.execute(
        identity,
        {
          moduleRoutes: preparer.moduleRoutes,
          actionKeys: preparer.actionKeys,
        },
        manager,
      );
      if (historical)
        await preparer.verifyHistoricalReadAuthority!(
          storedStep(step),
          context,
        );
      else await preparer.verifyAuthority(storedStep(step), context);
    }
    return {
      proposal,
      revision,
      steps,
      ...authorized,
      context,
      catalogCompatible,
      projection,
    };
  }
}
