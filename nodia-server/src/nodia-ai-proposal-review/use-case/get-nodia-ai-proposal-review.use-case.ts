import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ValidateFunction } from 'ajv';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { NodiaAiProposalService } from '../../nodia-ai-proposal/nodia-ai-proposal.service.js';
import {
  ValidateNodiaAiProposalUseCase,
  NODIA_AI_PROPOSAL_COMMON_SCHEMA,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { NodiaAiConfirmationAvailabilityUseCase } from '../../nodia-ai-confirmation/use-case/nodia-ai-confirmation-availability.use-case.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';

/** Human-only affordances. It does not mint a token or alter the frozen proposal. */
@Injectable()
export class GetNodiaAiProposalReviewUseCase {
  private readonly schema: ValidateFunction;
  constructor(
    private readonly store: NodiaAiProposalService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    private readonly availability: NodiaAiConfirmationAvailabilityUseCase,
    @Inject(NODIA_AI_PROPOSAL_COMMON_SCHEMA) source: string,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {
    this.schema = compileNodiaAiToolSchema({
      sourceJson: source,
      definition: 'ProposalReviewMetadata',
      sha256: createHash('sha256').update(source).digest('hex'),
    }).validate;
  }
  execute(identity: NodiaAiActorReference, id: string, revision?: number) {
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
      const loaded = await this.get.load(
        manager,
        identity,
        key,
        'read',
        revision,
      );
      const readonly =
        !loaded.catalogCompatible ||
        loaded.actor.actorId !== loaded.chat.owner_id ||
        loaded.proposal.current_revision !== loaded.revision.revision ||
        loaded.revision.state !== 'ready' ||
        loaded.now >= loaded.revision.expires_at;
      const fields = readonly
        ? []
        : loaded.steps.flatMap((step) => {
            const preparer = this.validate.preparer(
              step.tool_name,
              step.contract_hash,
            );
            const bound = new Set(
              step.output_bindings.map((binding) => binding.target_field_key),
            );
            const changes = step.public_step.changes;
            return (preparer.reviewFields ?? [])
              .filter(
                (field) =>
                  Object.hasOwn(preparer.editableFields, field.field_key) &&
                  !bound.has(field.field_key) &&
                  Array.isArray(changes) &&
                  changes.some(
                    (change) =>
                      change &&
                      typeof change === 'object' &&
                      !Array.isArray(change) &&
                      change.field_key === field.field_key &&
                      change.after_present === true,
                  ),
              )
              .map((field) => ({
                ...field,
                options: field.options.map((option) => ({ ...option })),
                step_id: step.id,
              }));
          });
      const eligibility = readonly
        ? { can_confirm: false, reason: 'nodia_ai:proposal_read_only' }
        : this.availability.describe(
            loaded.steps,
            loaded.revision.catalog_version,
          );
      const result = {
        proposal_id: loaded.proposal.id,
        revision: loaded.revision.revision,
        hash: loaded.revision.hash,
        read_only: readonly,
        editable_fields: fields,
        confirmation: {
          available: eligibility.can_confirm,
          reason: eligibility.reason,
        },
      };
      if (
        !this.schema(result) ||
        Buffer.byteLength(JSON.stringify(result)) >
          this.policy.results.tool_result_utf8_bytes
      )
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      return result as NodiaAiJsonObject;
    });
  }
}
