import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiExecutionGrant } from '../../nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import type { NodiaAiClaim } from '../../nodia-ai-runtime/types/worker.types.js';
import {
  LoadNodiaAiKnowledgeUseCase,
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { NODIA_AI_KNOWLEDGE_TOOLS } from '../../nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case.js';
import {
  NodiaAiToolRegistryUseCase,
  compileNodiaAiToolSchema,
} from './nodia-ai-tool-registry.use-case.js';
import { DiscoverNodiaAiToolsUseCase } from './discover-nodia-ai-tools.use-case.js';
import {
  SelectNodiaAiTurnToolsUseCase,
  loadNodiaAiToolSelectionProfiles,
} from './select-nodia-ai-turn-tools.use-case.js';
import { nodiaAiToolSelectionState } from '../types/tool-selection.types.js';
export { nodiaAiToolSelectionState } from '../types/tool-selection.types.js';

export const NODIA_AI_SELECT_CAPABILITIES_TOOL = 'nodia_capabilities_select';
const fail = (code = 'capability_denied'): never => {
  throw new Error(`nodia_ai:${code}`);
};

/** Discovery selects names only. Business execution starts in a separate, acknowledged generation. */
@Injectable()
export class NodiaAiToolSelectionFlowUseCase {
  private readonly source = readFileSync(
    new URL('../config/tool-selection.schema.json', import.meta.url),
    'utf8',
  );
  private readonly inputContract = compileNodiaAiToolSchema({
    sourceJson: this.source,
    sha256: knowledgeHash(this.source),
    definition: 'SelectCapabilitiesInput',
  });
  private readonly technicalNames =
    loadNodiaAiToolSelectionProfiles().technical_tool_names;
  constructor(
    private readonly registry: NodiaAiToolRegistryUseCase,
    private readonly knowledge: LoadNodiaAiKnowledgeUseCase,
    private readonly discovery: DiscoverNodiaAiToolsUseCase,
    private readonly selector: SelectNodiaAiTurnToolsUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
  ) {}
  descriptor() {
    return {
      name: NODIA_AI_SELECT_CAPABILITIES_TOOL,
      description:
        'Select exact authorized capability IDs discovered in the published catalog for the next generation. This executes no business operation. After a successful selection, finish this generation immediately; the backend verifies closure and acknowledgement before continuing with those tools.',
      inputSchema: structuredClone(this.inputContract.schema),
    };
  }
  contractHash() {
    return knowledgeHash(
      canonicalKnowledge({
        descriptor: this.descriptor(),
        contract: this.source,
      }),
    );
  }
  catalogHash() {
    return knowledgeHash(
      canonicalKnowledge(
        this.discovery
          .registeredCatalog()
          .filter((tool) => this.discovery.published(tool))
          .map((tool) => ({ id: tool.capabilityId, hash: tool.contractHash }))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      ),
    );
  }
  /** Complete public metadata, never a grant, business query or schema dump. */
  async discoveryIndex(
    manager: EntityManager,
    claim: NodiaAiClaim,
  ): Promise<NodiaAiJsonObject | undefined> {
    const frozen = nodiaAiToolSelectionState(
      claim.run.context_manifest.tool_selection,
    );
    const selection =
      claim.job.stage_key === 'delegated_inference'
        ? claim.run.routing_snapshot.target?.selection
        : claim.run.selection_snapshot;
    if (
      selection?.mode !== 'token_plan_agentic' ||
      frozen?.phase !== 'discovery'
    )
      return undefined;
    if (!manager.queryRunner?.isTransactionActive)
      return fail('capability_denied');
    const actor = await this.authorize.execute(claim.identity, {}, manager);
    const run = await manager
      .getRepository(NodiaAiRun)
      .findOneByOrFail({ id: claim.run.id });
    const grant = await manager
      .getRepository(NodiaAiExecutionGrant)
      .findOneByOrFail({ run_id: run.id });
    const current = nodiaAiToolSelectionState(
      run.context_manifest.tool_selection,
    );
    const routes = run.context_manifest.module_routes;
    if (
      !current ||
      current.phase !== 'discovery' ||
      current.catalog_hash !== frozen.catalog_hash ||
      current.catalog_hash !== this.catalogHash() ||
      run.actor_id !== actor.actorId ||
      run.actor_id !== claim.identity.userId ||
      run.conversation_id !== claim.run.conversation_id ||
      grant.actor_id !== actor.actorId ||
      grant.session_public_id !== actor.sessionId ||
      grant.revoked_at ||
      !(grant.expires_at instanceof Date) ||
      !Number.isFinite(grant.expires_at.getTime()) ||
      grant.expires_at.getTime() <= Date.now() ||
      !Array.isArray(grant.allowed_operations) ||
      grant.allowed_operations.length > 128 ||
      !Array.isArray(grant.allowed_modules) ||
      grant.allowed_modules.length > 64 ||
      !grant.allowed_operations.includes('chat:respond') ||
      !grant.allowed_operations.includes(NODIA_AI_SELECT_CAPABILITIES_TOOL) ||
      !Array.isArray(routes) ||
      routes.length > 64 ||
      routes.some((route) => typeof route !== 'string') ||
      canonicalKnowledge(routes) !==
        canonicalKnowledge(claim.run.context_manifest.module_routes) ||
      canonicalKnowledge(run.selection_snapshot) !==
        canonicalKnowledge(claim.run.selection_snapshot) ||
      canonicalKnowledge(run.routing_snapshot) !==
        canonicalKnowledge(claim.run.routing_snapshot) ||
      canonicalKnowledge(run.context_manifest.tool_contracts) !==
        canonicalKnowledge(claim.run.context_manifest.tool_contracts) ||
      run.context_manifest.tool_contracts === null ||
      typeof run.context_manifest.tool_contracts !== 'object' ||
      Array.isArray(run.context_manifest.tool_contracts) ||
      run.context_manifest.tool_contracts[NODIA_AI_SELECT_CAPABILITIES_TOOL] !==
        this.contractHash()
    )
      return fail('catalog_changed');
    const authorizedRoutes = actor.modules
      .map((module) => module.route)
      .filter(
        (route) =>
          routes.includes(route) && grant.allowed_modules.includes(route),
      )
      .sort();
    const tools = await this.discovery.visible(
      manager,
      actor,
      authorizedRoutes,
    );
    const ids = new Set<string>(),
      names = new Set<string>();
    const grouped = new Map<string, Map<string, NodiaAiJsonObject[]>>();
    for (const tool of [...tools].sort((a, b) =>
      a.capabilityId < b.capabilityId
        ? -1
        : a.capabilityId > b.capabilityId
          ? 1
          : 0,
    )) {
      if (!this.discovery.published(tool)) continue;
      if (ids.has(tool.capabilityId) || names.has(tool.toolName))
        return fail('catalog_changed');
      ids.add(tool.capabilityId);
      names.add(tool.toolName);
      let resources = grouped.get(tool.moduleKey);
      if (!resources) {
        resources = new Map();
        grouped.set(tool.moduleKey, resources);
      }
      const capabilities = resources.get(tool.resourceKey) ?? [];
      capabilities.push({
        capability_id: tool.capabilityId,
        tool_name: tool.toolName,
        kind: tool.kind,
        description: tool.description,
      });
      resources.set(tool.resourceKey, capabilities);
      if (
        grouped.size > 128 ||
        resources.size > 128 ||
        capabilities.length > 128
      )
        return fail('context_limit');
    }
    const ordered = <T>(entries: Map<string, T>) =>
      [...entries.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return {
      schema_version: 1,
      catalog_version: this.registry.catalogVersion,
      catalog_hash: current.catalog_hash,
      selection_required: true,
      modules: ordered(grouped).map(([moduleKey, resources]) => ({
        module_key: moduleKey,
        resources: ordered(resources).map(([resourceKey, capabilities]) => ({
          resource_key: resourceKey,
          capabilities,
        })),
      })),
    };
  }
  private select(
    ids: string[],
    actor: NodiaAiAuthorizedActor,
    routes: readonly string[],
    manager: EntityManager,
  ) {
    return this.discovery.visible(manager, actor, routes).then((visible) =>
      this.selector.execute(
        {
          profileId: 'selected_capabilities',
          registeredTools: this.discovery.registeredCatalog(),
          publishedCapabilityIds:
            this.knowledge.manifest.capability_contracts.map(
              (item) => item.capability_id,
            ),
          authorizedToolNames: visible.map((item) => item.toolName),
          technicalTools: [
            ...NODIA_AI_KNOWLEDGE_TOOLS.map((descriptor) => ({
              descriptor,
              contractHash: knowledgeHash(canonicalKnowledge(descriptor)),
            })),
            ...this.discovery.descriptors().map((descriptor) => ({
              descriptor,
              contractHash: this.discovery.contractHash(descriptor.name),
            })),
          ],
        },
        {
          schema_version: 1,
          default_profile_id: 'selected_capabilities',
          technical_tool_names: this.technicalNames,
          profiles: [
            {
              profile_id: 'selected_capabilities',
              revision: 1,
              capability_ids: ids,
              required_capability_ids: ids,
            },
          ],
        },
      ),
    );
  }
  async requestSelection(
    manager: EntityManager,
    claim: NodiaAiClaim,
    actor: NodiaAiAuthorizedActor,
    routes: readonly string[],
    call: { callId: string; name: string; arguments: unknown },
  ): Promise<NodiaAiJsonObject> {
    if (
      !manager.queryRunner?.isTransactionActive ||
      call.name !== NODIA_AI_SELECT_CAPABILITIES_TOOL ||
      !this.inputContract.validate(call.arguments)
    )
      return fail('invalid_tool_input');
    const input = structuredClone(call.arguments) as {
      catalog_version: string;
      capability_ids: string[];
    };
    if (input.catalog_version !== this.registry.catalogVersion)
      return fail('catalog_changed');
    const run = await manager
      .getRepository(NodiaAiRun)
      .findOneByOrFail({ id: claim.run.id });
    const state = nodiaAiToolSelectionState(
      run.context_manifest.tool_selection,
    );
    if (
      !state ||
      !['discovery', 'selection_requested'].includes(state.phase) ||
      state.catalog_hash !== this.catalogHash()
    )
      return fail('catalog_changed');
    const activeAttempt = await manager
      .getRepository(NodiaAiJobAttempt)
      .findOneBy({ id: claim.attempt.id });
    const activeSelection =
      activeAttempt?.routing_phase === 'delegated'
        ? run.routing_snapshot.target?.selection
        : run.selection_snapshot;
    if (
      !activeAttempt ||
      activeAttempt.job_id !== claim.job.id ||
      activeAttempt.phase !== 'dispatch_armed' ||
      activeAttempt.ended_at !== null ||
      !['inference', 'delegated_inference'].includes(activeAttempt.stage_key) ||
      activeSelection?.mode !== 'token_plan_agentic' ||
      canonicalKnowledge(activeAttempt.selection_snapshot) !==
        canonicalKnowledge(activeSelection) ||
      run.actor_id !== actor.actorId
    )
      return fail('capability_denied');
    const selection = await this.select(
      [...input.capability_ids].sort(),
      actor,
      routes,
      manager,
    );
    const argumentHash = knowledgeHash(canonicalKnowledge(input));
    const result = {
      status: 'selection_requested',
      selected_capability_ids: [...selection.capabilityIds],
      next_action: 'finish_current_generation',
      business_effects: false,
    };
    const repo = manager.getRepository(NodiaAiToolCall);
    const prior = await repo.findOneBy({
      run_id: run.id,
      adapter_call_id: call.callId,
    });
    if (prior) {
      if (
        prior.tool_name !== call.name ||
        prior.arguments_hash !== argumentHash ||
        canonicalKnowledge(prior.arguments) !== canonicalKnowledge(input) ||
        prior.contract_hash !== this.contractHash() ||
        prior.state !== 'completed' ||
        !prior.public_result ||
        canonicalKnowledge(prior.public_result) !==
          canonicalKnowledge(result) ||
        prior.scope_manifest.authority_hash !==
          knowledgeHash(canonicalKnowledge(selection.toolContracts)) ||
        state.request?.tool_call_id !== prior.id ||
        state.request.attempt_id !== claim.attempt.id ||
        canonicalKnowledge(state.request.tool_contracts) !==
          canonicalKnowledge(selection.toolContracts)
      )
        return fail('request_conflict');
      return prior.public_result;
    }
    if (state.request) return fail('request_conflict');
    const id = randomUUID();
    await repo.save(
      Object.assign(new NodiaAiToolCall(), {
        id,
        conversation_id: run.conversation_id,
        run_id: run.id,
        adapter_call_id: call.callId,
        tool_name: call.name,
        contract_hash: this.contractHash(),
        arguments_hash: argumentHash,
        arguments: input,
        public_result: result,
        scope_manifest: {
          schema_version: 1,
          module_routes: [...routes],
          authority_hash: knowledgeHash(
            canonicalKnowledge(selection.toolContracts),
          ),
        },
        state: 'completed',
        created_at: new Date(),
        completed_at: new Date(),
      }),
    );
    run.context_manifest = {
      ...run.context_manifest,
      tool_selection: {
        ...state,
        phase: 'selection_requested',
        request: {
          attempt_id: claim.attempt.id,
          tool_call_id: id,
          capability_ids: [...selection.capabilityIds],
          profile: { ...selection.profile },
          tool_contracts: { ...selection.toolContracts },
        },
      } as unknown as NodiaAiJsonObject,
    };
    await manager.getRepository(NodiaAiRun).save(run);
    return result;
  }
  private async planSelection(manager: EntityManager, claim: NodiaAiClaim) {
    if (!manager.queryRunner?.isTransactionActive)
      return fail('capability_denied');
    const actor = await this.authorize.execute(claim.identity, {}, manager);
    const run = await manager
      .getRepository(NodiaAiRun)
      .findOneByOrFail({ id: claim.run.id });
    const state = nodiaAiToolSelectionState(
      run.context_manifest.tool_selection,
    );
    const request = state?.request;
    if (
      !state ||
      state.phase !== 'ack_pending' ||
      !request ||
      state.catalog_hash !== this.catalogHash()
    )
      return fail('catalog_changed');
    const previous = await manager
      .getRepository(NodiaAiJobAttempt)
      .findOneBy({ id: request.attempt_id });
    const receipt = await manager
      .getRepository(NodiaAiToolCall)
      .findOneBy({ id: request.tool_call_id });
    const pending = await manager.query(
      'SELECT id FROM nodia_ai_jobs WHERE dedup_key=$1',
      ['ack:' + request.attempt_id],
    );
    const priorSelection =
      previous?.routing_phase === 'delegated'
        ? run.routing_snapshot.target?.selection
        : run.selection_snapshot;
    const receiptIds = receipt?.arguments.capability_ids;
    if (
      !previous ||
      previous.job_id !== claim.job.id ||
      previous.phase !== 'completed' ||
      !previous.ended_at ||
      !['inference', 'delegated_inference'].includes(previous.stage_key) ||
      !priorSelection ||
      canonicalKnowledge(previous.selection_snapshot) !==
        canonicalKnowledge(priorSelection) ||
      !receipt ||
      receipt.conversation_id !== run.conversation_id ||
      receipt.run_id !== run.id ||
      receipt.state !== 'completed' ||
      receipt.tool_name !== NODIA_AI_SELECT_CAPABILITIES_TOOL ||
      receipt.contract_hash !== this.contractHash() ||
      receipt.arguments.catalog_version !== this.registry.catalogVersion ||
      !Array.isArray(receiptIds) ||
      canonicalKnowledge([...receiptIds].sort()) !==
        canonicalKnowledge(request.capability_ids) ||
      receipt.arguments_hash !==
        knowledgeHash(canonicalKnowledge(receipt.arguments)) ||
      receipt.scope_manifest.authority_hash !==
        knowledgeHash(canonicalKnowledge(request.tool_contracts)) ||
      canonicalKnowledge(receipt.public_result) !==
        canonicalKnowledge({
          status: 'selection_requested',
          selected_capability_ids: request.capability_ids,
          next_action: 'finish_current_generation',
          business_effects: false,
        }) ||
      pending.length
    )
      return fail('tool_selection_ack_pending');
    const grant = await manager
      .getRepository(NodiaAiExecutionGrant)
      .findOneByOrFail({ run_id: run.id });
    const routes = actor.modules
      .map((module) => module.route)
      .filter(
        (route) =>
          grant.allowed_modules.includes(route) &&
          Array.isArray(run.context_manifest.module_routes) &&
          run.context_manifest.module_routes.includes(route),
      );
    const selected = await this.select(
      request.capability_ids,
      actor,
      routes,
      manager,
    );
    if (
      canonicalKnowledge(selected.toolContracts) !==
        canonicalKnowledge(request.tool_contracts) ||
      canonicalKnowledge(selected.profile) !==
        canonicalKnowledge(request.profile)
    )
      return fail('catalog_changed');
    return { run, grant, selected, state };
  }
  /** Read-only preflight, so a known rejection can terminate before the final persist callback. */
  async verifySelection(
    manager: EntityManager,
    claim: NodiaAiClaim,
  ): Promise<void> {
    await this.planSelection(manager, claim);
  }
  async activateSelection(
    manager: EntityManager,
    claim: NodiaAiClaim,
  ): Promise<void> {
    const { run, grant, selected, state } = await this.planSelection(
      manager,
      claim,
    );
    grant.allowed_operations = [
      'chat:respond',
      ...Object.keys(selected.toolContracts).sort(),
    ];
    await manager.getRepository(NodiaAiExecutionGrant).save(grant);
    run.context_manifest = {
      ...run.context_manifest,
      tool_contracts: { ...selected.toolContracts },
      tool_selection_profile: { ...selected.profile },
      tool_selection: {
        ...state,
        phase: 'execution',
      } as unknown as NodiaAiJsonObject,
    };
    await manager.getRepository(NodiaAiRun).save(run);
  }
}
