import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiAdmissionPreparer } from '../../nodia-ai-conversation/types/nodia-ai-admission.types.js';
import type {
  NodiaAiActorReference,
  NodiaAiAuthorizedActor,
} from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type {
  NodiaAiConversationSummary,
  NodiaAiSelection,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { LoadNodiaAiKnowledgeUseCase } from './load-nodia-ai-knowledge.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { canonicalKnowledge } from './load-nodia-ai-knowledge.use-case.js';
import { knowledgeHash } from './load-nodia-ai-knowledge.use-case.js';
import { DiscoverNodiaAiToolsUseCase } from '../../nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case.js';
import { NODIA_AI_KNOWLEDGE_TOOLS } from './execute-nodia-ai-knowledge-tool.use-case.js';
import { SelectNodiaAiTurnToolsUseCase } from '../../nodia-ai-tools/use-case/select-nodia-ai-turn-tools.use-case.js';
import { NodiaAiToolSelectionFlowUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import { observationIdentityManifest } from './nodia-ai-observation-identity.js';

@Injectable()
export class PrepareNodiaAiAdmissionUseCase implements NodiaAiAdmissionPreparer {
  private readonly observations = new WeakSet<object>();
  constructor(
    private readonly adapter: NodiaAiAdapterPort,
    private readonly knowledge: LoadNodiaAiKnowledgeUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly tools: DiscoverNodiaAiToolsUseCase,
    private readonly selector: SelectNodiaAiTurnToolsUseCase,
    private readonly selectionFlow: NodiaAiToolSelectionFlowUseCase,
  ) {}
  async observe(
    identity: NodiaAiActorReference,
    chat: Readonly<NodiaAiConversationSummary>,
    options?: { toolProfileId?: string },
  ) {
    if (!chat.selection || chat.selection.mode === 'api_key')
      throw new ServiceUnavailableException('nodia_ai:mode_unavailable');
    const observation = {
      actorId: identity.userId,
      sessionId: identity.sessionId,
      conversationId: chat.conversation_id,
      revision: chat.revision,
      selection: structuredClone(chat.selection),
      toolProfileId: options?.toolProfileId,
      eligibility: structuredClone(await this.adapter.observe(chat.selection)),
    };
    if (observation.eligibility.adapterIdentity) Object.freeze(observation.eligibility.adapterIdentity);
    Object.freeze(observation.selection);
    Object.freeze(observation.eligibility);
    Object.freeze(observation);
    this.observations.add(observation);
    return observation;
  }
  async prepare(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    chat: Readonly<NodiaAiConversation>,
    now: Date,
    value: unknown,
  ) {
    if (!value || typeof value !== 'object' || !this.observations.has(value))
      throw new ConflictException('nodia_ai:eligibility_changed');
    // The WeakSet is a server-private capability; a JSON request can never manufacture an observation.
    const observation = value as Awaited<
      ReturnType<PrepareNodiaAiAdmissionUseCase['observe']>
    >;
    const selection: NodiaAiSelection = {
      connection_id: chat.selected_connection_id!,
      mode: chat.selected_mode!,
      model_id: chat.selected_model_id!,
      effort_id: chat.selected_effort_id,
    };
    const age =
      now.getTime() - new Date(observation.eligibility.observedAt).getTime();
    if (
      observation.actorId !== actor.actorId ||
      observation.sessionId !== actor.sessionId ||
      observation.conversationId !== chat.id ||
      observation.revision !== chat.revision ||
      canonicalKnowledge(selection) !==
        canonicalKnowledge(observation.selection) ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > this.policy.timing.eligibility_observation_seconds * 1000
    )
      throw new ConflictException('nodia_ai:eligibility_changed');
    if (
      !observation.eligibility.available ||
      !observation.eligibility.resourceKey
    )
      throw new ServiceUnavailableException('nodia_ai:mode_unavailable');
    let adapterManifest: ReturnType<typeof observationIdentityManifest>;
    try { adapterManifest = observationIdentityManifest(selection, observation.eligibility); }
    catch { throw new ConflictException('nodia_ai:eligibility_changed'); }
    const codex = adapterManifest.adapter_identity !== undefined;
    await this.adapter.verifyConfiguration(
      selection,
      observation.eligibility.configurationGeneration,
      manager,
    );
    const modules = actor.modules.map((item) => item.route).sort();
    const knowledge = this.knowledge.manifest;
    const visible = await this.tools.visible(manager, actor, modules);
    let selected: ReturnType<SelectNodiaAiTurnToolsUseCase['execute']>;
    try {
      selected = this.selector.execute({
        profileId: observation.toolProfileId,
        registeredTools: this.tools.registeredCatalog(),
        publishedCapabilityIds: knowledge.capability_contracts.map(
          (item) => item.capability_id,
        ),
        authorizedToolNames: visible.map((item) => item.toolName),
        technicalTools: [
          ...NODIA_AI_KNOWLEDGE_TOOLS.map((descriptor) => ({
            descriptor,
            contractHash: knowledgeHash(canonicalKnowledge(descriptor)),
          })),
          ...this.tools.descriptors().map((descriptor) => ({
            descriptor,
            contractHash: this.tools.contractHash(descriptor.name),
          })),
        ],
      });
    } catch (error: unknown) {
      if (!(error instanceof NodiaAiKnownPreDispatchError)) throw error;
      if (
        error.errorCode === 'nodia_ai:tool_selection_unknown' ||
        (observation.toolProfileId !== undefined &&
          error.errorCode === 'nodia_ai:tool_selection_invalid')
      )
        throw new BadRequestException(error.errorCode);
      if (error.errorCode === 'nodia_ai:tool_selection_changed')
        throw new ConflictException(error.errorCode);
      if (error.errorCode === 'nodia_ai:capability_denied')
        throw new ForbiddenException(error.errorCode);
      if (
        [
          'nodia_ai:tool_catalog_limit',
          'nodia_ai:tool_selection_unpublished',
          'nodia_ai:tool_selection_invalid',
        ].includes(error.errorCode)
      )
        throw new ServiceUnavailableException(error.errorCode);
      throw error;
    }
    const automatic = selected.profile.profile_id === 'automatic_discovery';
    const contracts = {
      ...selected.toolContracts,
      ...(automatic
        ? {
            [this.selectionFlow.descriptor().name]:
              this.selectionFlow.contractHash(),
          }
        : {}),
    };
    return {
      selection,
      catalogVersion: knowledge.catalog_release,
      contextManifest: {
        schema_version: 1,
        ...adapterManifest,
        verified_modalities: [
          ...(!codex ? observation.eligibility.verifiedModalities ?? [] : []),
        ],
        verified_attachment_media_types: [
          ...(!codex ? observation.eligibility.verifiedAttachmentMediaTypes ?? [] : []),
        ],
        knowledge_release: knowledge.release_id,
        resource_key: observation.eligibility.resourceKey,
        configuration_generation:
          observation.eligibility.configurationGeneration,
        session_generation: observation.eligibility.sessionGeneration,
        module_routes: modules,
        tool_catalog_version: knowledge.catalog_release,
        tool_contracts: contracts,
        tool_selection_profile: { ...selected.profile },
        tool_selection: {
          schema_version: 1,
          phase: automatic ? 'discovery' : 'execution',
          catalog_hash: this.selectionFlow.catalogHash(),
        },
      },
      grantScope: { schema_version: 1, module_routes: modules },
      allowedModules: modules,
      allowedOperations: ['chat:respond', ...Object.keys(contracts).sort()],
    };
  }
}
