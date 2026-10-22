import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiConfirmationChallenge } from '../entities/nodia-ai-confirmation-challenge.entity.js';
import { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import { ValidateNodiaAiConfirmationUseCase } from './validate-nodia-ai-confirmation.use-case.js';
@Injectable()
export class CreateNodiaAiConfirmationChallengeUseCase {
  constructor(
    private readonly store: NodiaAiConfirmationService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiConfirmationUseCase,
    private readonly availability: NodiaAiConfirmationAvailabilityUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    const request = this.validate.input(input, 'challenge');
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      const { proposal, revision, steps, actor, chat, now } =
        await this.get.load(manager, identity, key, 'write');
      if (
        proposal.current_revision !== request.proposal_revision ||
        revision.hash !== request.expected_hash
      )
        throw new ConflictException('nodia_ai:revision_conflict');
      if (revision.state !== 'ready')
        throw new ConflictException('nodia_ai:proposal_not_ready');
      if (now >= revision.expires_at)
        throw new GoneException('nodia_ai:proposal_expired');
      if (chat.active_job_id)
        throw new ConflictException('nodia_ai:conversation_busy');
      this.availability.require(steps, revision.catalog_version);
      const sessionExpiry = await this.store.sessionExpiry(
        manager,
        actor.actorId,
        actor.sessionId,
      );
      if (!sessionExpiry)
        throw new UnauthorizedException('auth:session_expired');
      const token = randomBytes(32).toString('base64url');
      const expires = new Date(
        Math.min(
          now.getTime() +
            this.policy.timing.confirmation_challenge_seconds * 1000,
          revision.expires_at.getTime(),
          chat.expires_at.getTime(),
          sessionExpiry.getTime(),
        ),
      );
      const challenge = Object.assign(new NodiaAiConfirmationChallenge(), {
        id: randomUUID(),
        proposal_id: proposal.id,
        proposal_revision: revision.revision,
        actor_id: actor.actorId,
        session_public_id: actor.sessionId,
        expected_hash: revision.hash,
        token_hash: createHash('sha256').update(token).digest('hex'),
        expires_at: expires,
        consumed_at: null,
        created_at: now,
      });
      await this.store.issue(manager, challenge);
      const result = {
        proposal_id: proposal.id,
        proposal_revision: revision.revision,
        expected_hash: revision.hash,
        confirmation_token: token,
        expires_at: expires.toISOString(),
      };
      this.validate.assert('ConfirmationChallengeResponse', result, true);
      return result;
    });
  }
}
