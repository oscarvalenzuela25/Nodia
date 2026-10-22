import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { UpdateNodiaAiRoutingDto } from '../dto/nodia-ai-routing.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import type { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { conversationId } from './get-nodia-ai-conversation.use-case.js';
import { verifyConfiguredRoutingTarget } from '../../nodia-ai-context/use-case/nodia-ai-routing-target.js';

/** Explicit human configuration. Neither the model nor this switch can approve a business write. */
@Injectable()
export class UpdateNodiaAiRoutingUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly project: ProjectNodiaAiConversationUseCase,
    private readonly adapter: NodiaAiAdapterPort,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id),
      dto = validateNodiaAiDto(UpdateNodiaAiRoutingDto, input);
    if (dto.enabled && !dto.target)
      throw new BadRequestException('nodia_ai:invalid_input');
    const preflight = await this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { chat } = await this.access.execute(
        manager,
        identity,
        key,
        'write',
      );
      this.validate(chat, dto);
      if (dto.enabled && dto.target) {
        try {
          await verifyConfiguredRoutingTarget(manager, {
            ...dto.target.selection,
            effort_id: dto.target.selection.effort_id ?? null,
          });
        } catch {
          throw new BadRequestException('nodia_ai:invalid_selection');
        }
      }
      return this.project.execute(chat);
    });
    const target = dto.target;
    // A broken provider never prevents withdrawing consent. A currently armed inference may finish,
    // but its frozen routing revision cannot authorize a new delegated dispatch.
    const observation =
      dto.enabled && target
        ? await this.adapter.observe({
            ...target.selection,
            effort_id: target.selection.effort_id ?? null,
          })
        : null;
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { chat, actor, now } = await this.access.execute(
        manager,
        identity,
        key,
        'write',
      );
      this.validate(chat, dto);
      if (chat.revision !== preflight.revision)
        throw new ConflictException('nodia_ai:revision_conflict');
      if (dto.enabled && target && observation) {
        const age = now.getTime() - new Date(observation.observedAt).getTime();
        if (
          !observation.available ||
          !observation.supportsMcp ||
          !observation.resourceKey
        )
          throw new ServiceUnavailableException('nodia_ai:agentic_unavailable');
        if (
          !Number.isFinite(age) ||
          age < 0 ||
          age > this.policy.timing.eligibility_observation_seconds * 1000 ||
          target.configuration_generation !==
            observation.configurationGeneration ||
          target.session_generation !== observation.sessionGeneration
        )
          throw new ConflictException('nodia_ai:eligibility_changed');
        await this.adapter.verifyConfiguration(
          {
            ...target.selection,
            effort_id: target.selection.effort_id ?? null,
          },
          observation.configurationGeneration,
          manager,
        );
        try {
          await verifyConfiguredRoutingTarget(manager, {
            ...target.selection,
            effort_id: target.selection.effort_id ?? null,
          });
        } catch {
          throw new ConflictException('nodia_ai:eligibility_changed');
        }
      }
      chat.routing_enabled = dto.enabled;
      chat.routing_target_selection = target
        ? {
            selection: {
              connection_id: target.selection.connection_id,
              mode: 'token_plan_agentic',
              model_id: target.selection.model_id,
              effort_id: target.selection.effort_id ?? null,
            },
            configuration_generation: target.configuration_generation,
            session_generation: target.session_generation,
          }
        : null;
      chat.routing_revision++;
      chat.revision++;
      chat.updated_at = now;
      await this.conversations.save(manager, chat);
      await manager.query(
        `INSERT INTO nodia_ai_audit_events(id,actor_id,session_public_id,conversation_id,event_key,correlation_id,minimal_details) VALUES($1,$2,$3,$4,'conversation.routing.updated',$5,$6::jsonb)`,
        [
          randomUUID(),
          actor.actorId,
          actor.sessionId,
          chat.id,
          randomUUID(),
          JSON.stringify({
            enabled: chat.routing_enabled,
            routing_revision: chat.routing_revision,
          }),
        ],
      );
      return this.project.execute(chat);
    });
  }
  private validate(chat: NodiaAiConversation, dto: UpdateNodiaAiRoutingDto) {
    if (
      chat.revision !== dto.expected_conversation_revision ||
      chat.routing_revision !== dto.expected_routing_revision ||
      chat.revision >= 2147483647 ||
      chat.routing_revision >= 2147483647
    )
      throw new ConflictException('nodia_ai:revision_conflict');
    if (dto.enabled && chat.active_job_id)
      throw new ConflictException('nodia_ai:conversation_busy');
    if (dto.enabled && chat.selected_mode !== 'token_plan_web')
      throw new BadRequestException('nodia_ai:invalid_selection');
    if (
      dto.target &&
      (dto.target.selection.mode !== 'token_plan_agentic' ||
        dto.target.selection.connection_id !== chat.selected_connection_id ||
        dto.target.selection.effort_id === undefined)
    )
      throw new BadRequestException('nodia_ai:invalid_selection');
  }
}
