import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiDraft } from '../entities/nodia-ai-draft.entity.js';
import { GetNodiaAiProposalUseCase } from './get-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from './validate-nodia-ai-proposal.use-case.js';
import { normalizeNodiaAiProposalInput } from './normalize-nodia-ai-proposal-input.js';
@Injectable()
export class CancelNodiaAiProposalUseCase {
  constructor(
    private readonly store: NodiaAiProposalService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    const normalized = normalizeNodiaAiProposalInput(
      input,
      'cancel',
      this.policy.results.json_collection_items,
    );
    this.validate.assert('ProposalCancelRequest', normalized);
    const request = normalized as {
      expected_proposal_revision: number;
      client_request_id: string;
    };
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      const { proposal, revision, steps, now } = await this.get.load(
        manager,
        identity,
        key,
        'write',
      );
      if (proposal.current_revision !== request.expected_proposal_revision)
        throw new ConflictException('nodia_ai:revision_conflict');
      if (!['ready', 'cancelled'].includes(revision.state))
        throw new ConflictException('nodia_ai:proposal_not_ready');
      if (revision.state === 'ready')
        revision.state = now >= revision.expires_at ? 'expired' : 'cancelled';
      await manager
        .getRepository(NodiaAiProposalRevision)
        .update(
          { proposal_id: proposal.id, revision: revision.revision },
          { state: revision.state },
        );
      await manager
        .getRepository(NodiaAiDraft)
        .update({ claimed_proposal_id: proposal.id }, { state: 'cancelled' });
      return this.validate.compile(proposal, revision, steps);
    });
  }
}
