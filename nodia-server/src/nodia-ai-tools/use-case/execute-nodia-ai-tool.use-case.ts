import { contractModuleRoute, moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { nodiaAiFailureDiagnostic } from '../../nodia-ai-runtime/types/nodia-ai-failure-diagnostic.js';
import type { EntityManager } from 'typeorm';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { appendNodiaAiEvent } from '../../nodia-ai-run/event-journal.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiExecutionGrant } from '../../nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import type {
  NodiaAiClaim,
  NodiaAiStageContext,
} from '../../nodia-ai-runtime/types/worker.types.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import {
  NODIA_AI_MCP_CATALOG_LIMITS,
  nodiaAiMcpCatalogUtf8Bytes,
  isNodiaAiMcpToolDescriptorValid,
} from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  LoadNodiaAiKnowledgeUseCase,
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import {
  ExecuteNodiaAiKnowledgeToolUseCase,
  NODIA_AI_KNOWLEDGE_TOOLS,
} from '../../nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case.js';
import {
  DiscoverNodiaAiToolsUseCase,
  NODIA_AI_COMMON_TOOL_NAMES,
} from './discover-nodia-ai-tools.use-case.js';
import { NodiaAiToolRegistryUseCase } from './nodia-ai-tool-registry.use-case.js';
import { NodiaAiReportToolsUseCase } from './nodia-ai-report-tools.use-case.js';
import type {
  NodiaAiPreparedToolOperation,
  NodiaAiRegisteredTool,
  NodiaAiToolHandlerContext,
} from '../types/tool-registry.types.js';
import {
  NodiaAiToolSelectionFlowUseCase,
  NODIA_AI_SELECT_CAPABILITIES_TOOL,
  nodiaAiToolSelectionState,
} from './nodia-ai-tool-selection-flow.use-case.js';
import {
  isNodiaAiMcpExecutableRegistration,
  isNodiaAiMcpPreparationKind,
} from '../types/tool-registry.types.js';
function fail(code = 'capability_denied'): never {
  throw new Error(`nodia_ai:${code}`);
}
type ToolPhase =
  | 'reserve_budget'
  | 'validate_envelope'
  | 'technical'
  | 'external'
  | 'authority'
  | 'select_contract'
  | 'validate_input'
  | 'resource_authority'
  | 'replay'
  | 'native_read'
  | 'native_prepare'
  | 'validate_output'
  | 'output_authority'
  | 'persist_receipt';
/** The only Agentic callback dispatcher. Authority, durable cost and public contracts precede every result, including replay. */
@Injectable()
export class ExecuteNodiaAiToolUseCase {
  private readonly logger = new Logger(ExecuteNodiaAiToolUseCase.name);
  constructor(
    private readonly registry: NodiaAiToolRegistryUseCase,
    private readonly knowledge: LoadNodiaAiKnowledgeUseCase,
    private readonly knowledgeTools: ExecuteNodiaAiKnowledgeToolUseCase,
    private readonly discovery: DiscoverNodiaAiToolsUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly selectionFlow: NodiaAiToolSelectionFlowUseCase,
    private readonly reports?: NodiaAiReportToolsUseCase,
  ) {}
  async descriptors(claim: NodiaAiClaim, context: NodiaAiStageContext) {
    return context.checkpoint(async (manager) => {
      const authority = await this.authority(manager, claim, true);
      const registered = (
        await this.discovery.visible(manager, authority.actor, authority.routes)
      ).filter(
        (tool) =>
          isNodiaAiMcpExecutableRegistration(tool) &&
          authority.grant.allowed_operations.includes(tool.toolName) &&
          this.frozenHash(claim, tool.toolName) === tool.contractHash,
      );
      const technical = [
        ...NODIA_AI_KNOWLEDGE_TOOLS,
        ...this.discovery.descriptors(),
        this.selectionFlow.descriptor(),
      ].filter(
        (tool) =>
          authority.grant.allowed_operations.includes(tool.name) &&
          this.frozenHash(claim, tool.name) === this.contractHash(tool.name),
      );
      if (
        registered.length + technical.length >
        this.policy.results.json_collection_items
      )
        fail('context_limit');
      const descriptors = [
        ...technical,
        ...registered.map((tool) => ({
          name: tool.toolName,
          description: tool.description,
          inputSchema: structuredClone(tool.inputSchema),
        })),
      ];
      if (
        descriptors.length > NODIA_AI_MCP_CATALOG_LIMITS.tools ||
        descriptors.some((tool) => !isNodiaAiMcpToolDescriptorValid(tool)) ||
        nodiaAiMcpCatalogUtf8Bytes(descriptors) >
          NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes
      )
        throw new NodiaAiKnownPreDispatchError('nodia_ai:tool_catalog_limit');
      return descriptors;
    });
  }
  async execute(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    call: {
      callId: string;
      name: string;
      arguments: unknown;
    },
  ): Promise<NodiaAiJsonObject> {
    let phase: ToolPhase = 'reserve_budget';
    try {
      return await this.executeWithDiagnostics(claim, context, call, (next) => {
        phase = next;
      });
    } catch (error: unknown) {
      try {
        this.logger.warn(
          'nodia_ai_tool_execution_failed ' +
            JSON.stringify({
              phase,
              ...nodiaAiFailureDiagnostic(error),
            }),
        );
      } catch {
        /* Never replace the original callback failure with a diagnostic error. */
      }
      throw error;
    }
  }
  private async executeWithDiagnostics(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    call: {
      callId: string;
      name: string;
      arguments: unknown;
    },
    phase: (next: ToolPhase) => void,
  ): Promise<NodiaAiJsonObject> {
    // This transaction commits before any lookup, input rejection, resource check or replay.
    await context.checkpoint(async (manager) => {
      await this.authorize.execute(claim.identity, {}, manager);
      const reserved: {
        id: string;
      }[] = await manager.query(
        "WITH changed AS (UPDATE nodia_ai_runs SET tool_calls_used=tool_calls_used+1 WHERE id=$1 AND tool_calls_used<(budget_snapshot->>'tool_calls')::integer RETURNING id) SELECT id FROM changed",
        [claim.run.id],
      );
      if (reserved.length !== 1) fail('execution_limit');
    });
    phase('validate_envelope');
    if (context.signal.aborted) fail('cancelled');
    if (
      !call ||
      typeof call.callId !== 'string' ||
      !call.callId.trim() ||
      Buffer.byteLength(call.callId, 'utf8') > 512 ||
      typeof call.name !== 'string'
    )
      fail('invalid_tool_input');
    this.bound(call.arguments, 'input');
    if (call.name === NODIA_AI_SELECT_CAPABILITIES_TOOL) {
      return context.checkpoint(async (manager) => {
        const authority = await this.authority(manager, claim);
        if (
          !authority.grant.allowed_operations.includes(call.name) ||
          this.frozenHash(claim, call.name) !==
            this.selectionFlow.contractHash()
        )
          fail('catalog_changed');
        return this.selectionFlow.requestSelection(
          manager,
          claim,
          authority.actor,
          authority.routes,
          call,
        );
      });
    }
    if (this.reports?.handles(call.name)) {
      phase('technical');
      return this.executeReport(claim, context, call);
    }
    const technical = NODIA_AI_KNOWLEDGE_TOOLS.some(
      (tool) => tool.name === call.name,
    );
    if (technical) {
      phase('technical');
      const routes: string[] = [];
      const knowledgeContext: NodiaAiStageContext = {
        ...context,
        checkpoint: (work, isolation) =>
          context.checkpoint(async (manager) => {
            const authority = await this.authority(manager, claim);
            if (
              !authority.grant.allowed_operations.includes(call.name) ||
              this.frozenHash(claim, call.name) !== this.contractHash(call.name)
            )
              fail();
            routes.splice(0, routes.length, ...authority.routes);
            return work(manager);
          }, isolation),
      };
      return this.knowledgeTools.execute(
        claim,
        knowledgeContext,
        call,
        true,
        routes,
      );
    }
    const external = this.registry.get(call.name);
    if (external?.external) {
      phase('external');
      return this.executeExternal(claim, context, call, external);
    }
    return context.checkpoint(async (manager) => {
      phase('authority');
      const { actor, routes, grant } = await this.authority(manager, claim);
      phase('select_contract');
      if (!grant.allowed_operations.includes(call.name)) fail();
      const commonIndex = NODIA_AI_COMMON_TOOL_NAMES.indexOf(call.name);
      const kind = (['search', 'describe', 'entities'] as const)[commonIndex];
      const tool = commonIndex < 0 ? this.registry.get(call.name) : undefined;
      if (
        commonIndex < 0 &&
        (!tool ||
          !(tool.kind === 'read' || isNodiaAiMcpPreparationKind(tool.kind)) ||
          !this.discovery.published(tool) ||
          !tool.requiredModuleRoutes.every((route) => moduleRouteIncluded(routes, route)))
      )
        fail();
      const contractHash =
        tool?.contractHash ?? this.discovery.contractHash(call.name);
      if (this.frozenHash(claim, call.name) !== contractHash)
        fail('catalog_changed');
      const resolver = tool && this.discovery.isEntityResolver(tool, routes);
      phase('validate_input');
      const input = tool
        ? resolver
          ? this.discovery.validateResolverInput(tool, call.arguments)
          : this.registry.validateInput(tool, call.arguments)
        : this.discovery.validateInput(kind, call.arguments);
      this.bound(input, 'input');
      const preparationCallId =
        tool && isNodiaAiMcpPreparationKind(tool.kind)
          ? randomUUID()
          : undefined;
      const handlerContext = {
        manager,
        actor,
        moduleRoutes: routes,
        signal: context.signal,
        statementTimeoutMs: this.policy.timing.read_query_seconds * 1000,
        maxCollectionItems: this.policy.results.json_collection_items,
        conversationId: claim.run.conversation_id,
        runId: claim.run.id,
        attemptId: claim.attempt.id,
        ...(preparationCallId
          ? {
              toolCallId: preparationCallId,
            }
          : {}),
      };
      if (tool) {
        phase('resource_authority');
        await this.authorize.execute(
          claim.identity,
          {
            moduleRoutes: tool.requiredModuleRoutes,
            actionKeys: tool.actionKeys,
          },
          manager,
        );
        await tool.verifyAuthority(input, handlerContext);
      }
      const catalogOnly = ['discovery', 'selection_requested'].includes(
        nodiaAiToolSelectionState(claim.run.context_manifest.tool_selection)
          ?.phase ?? '',
      );
      if (
        catalogOnly &&
        nodiaAiToolSelectionState(claim.run.context_manifest.tool_selection)
          ?.catalog_hash !== this.selectionFlow.catalogHash()
      )
        fail('catalog_changed');
      const visible = (
        await this.discovery.visible(manager, actor, routes)
      ).filter(
        (item) =>
          (catalogOnly && (kind === 'search' || kind === 'describe')) ||
          (grant.allowed_operations.includes(item.toolName) &&
            this.frozenHash(claim, item.toolName) === item.contractHash),
      );
      // Discovery replay must not leak a capability whose action was revoked meanwhile.
      const scopeHash = knowledgeHash(
        canonicalKnowledge({
          routes: routes.map(contractModuleRoute).sort(),
          contracts: visible.map((item) => item.contractHash),
        }),
      );
      const permittedToolNames = visible.map((item) => item.toolName);
      if (kind === 'entities')
        await this.discovery.verifyEntityAuthority(
          manager,
          actor,
          routes,
          input,
          context.signal,
          permittedToolNames,
        );
      const argumentHash = knowledgeHash(canonicalKnowledge(input));
      const repo = manager.getRepository(NodiaAiToolCall);
      const prior = await repo.findOneBy({
        run_id: claim.run.id,
        adapter_call_id: call.callId,
      });
      if (prior) {
        phase('replay');
        if (
          prior.tool_name !== call.name ||
          prior.arguments_hash !== argumentHash ||
          prior.contract_hash !== contractHash ||
          prior.state !== 'completed' ||
          !prior.public_result ||
          prior.scope_manifest.authority_hash !== scopeHash
        )
          fail('request_conflict');
        this.bound(prior.public_result, 'output');
        const validated = tool
          ? resolver
            ? this.discovery.validateResolverOutput(
                tool,
                input,
                prior.public_result,
              )
            : this.registry.validateOutput(tool, prior.public_result)
          : this.discovery.validateResult(
              kind,
              prior.public_result,
              kind === 'entities' ? (input.resource_key as string) : undefined,
            );
        if (tool?.verifyResultAuthority)
          await tool.verifyResultAuthority(input, validated, {
            ...handlerContext,
            toolCallId: prior.id,
          });
        return validated;
      }
      // Checkpoint's authority barrier and transaction are shared with the typed domain port.
      // PostgreSQL bounds every statement; no provider, HTTP or SDK work is permitted here.
      phase(preparationCallId ? 'native_prepare' : 'native_read');
      await manager.query("SELECT set_config('statement_timeout',$1,true)", [
        String(this.policy.timing.read_query_seconds * 1000),
      ]);
      if (preparationCallId) {
        // Same fenced transaction as draft/proposal and the completed receipt. A rejection rolls all back.
        await repo.save(
          Object.assign(new NodiaAiToolCall(), {
            id: preparationCallId,
            conversation_id: claim.run.conversation_id,
            run_id: claim.run.id,
            adapter_call_id: call.callId,
            tool_name: call.name,
            contract_hash: contractHash,
            arguments_hash: argumentHash,
            arguments: input,
            public_result: null,
            scope_manifest: {
              schema_version: 1,
              module_routes: routes,
              authority_hash: scopeHash,
            },
            state: 'validated',
            created_at: new Date(),
            completed_at: null,
          }),
        );
      }
      const raw = tool
        ? await tool.handler(input, handlerContext)
        : await this.discovery.execute(
            manager,
            actor,
            routes,
            kind,
            input,
            context.signal,
            permittedToolNames,
            catalogOnly,
          );
      phase('validate_output');
      const result = tool
        ? resolver
          ? this.discovery.validateResolverOutput(tool, input, raw)
          : this.registry.validateOutput(tool, raw)
        : raw;
      this.bound(result, 'output');
      phase('output_authority');
      if (tool?.verifyResultAuthority)
        await tool.verifyResultAuthority(input, result, handlerContext);
      if (context.signal.aborted) fail('cancelled');
      const now = new Date();
      phase('persist_receipt');
      const receipt = await repo.save(
        Object.assign(new NodiaAiToolCall(), {
          id: preparationCallId ?? randomUUID(),
          conversation_id: claim.run.conversation_id,
          run_id: claim.run.id,
          adapter_call_id: call.callId,
          tool_name: call.name,
          contract_hash: contractHash,
          arguments_hash: argumentHash,
          arguments: input,
          public_result: result,
          scope_manifest: {
            schema_version: 1,
            module_routes: routes,
            authority_hash: scopeHash,
          },
          state: 'completed',
          created_at: now,
          completed_at: now,
        }),
      );
      await this.publishReceipt(manager, receipt, routes);
      return result;
    }, this.readIsolation(call));
  }
  /** Durable prepare / external execution / fresh authority. No network occurs under a SQL lease. */
  private async executeReport(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    call: {
      callId: string;
      name: string;
      arguments: unknown;
    },
  ): Promise<NodiaAiJsonObject> {
    const reports = this.reports!;
    const contractHash = reports.contractHash(call.name);
    const access = async (manager: EntityManager) => {
      const authority = await this.authority(manager, claim);
      if (
        !authority.grant.allowed_operations.includes(call.name) ||
        this.frozenHash(claim, call.name) !== contractHash
      )
        fail('catalog_changed');
      const input = reports.validateInput(call.name, call.arguments);
      const frozen = claim.run.context_manifest.module_routes as string[];
      reports.assertGranted(
        input,
        frozen.filter((route) =>
          moduleRouteIncluded(authority.grant.allowed_modules, route),
        ),
      );
      return { ...authority, input };
    };
    const admitted = await context.checkpoint(async (manager) => {
      const authority = await access(manager);
      const input = authority.input;
      const hash = knowledgeHash(canonicalKnowledge(input));
      const repo = manager.getRepository(NodiaAiToolCall);
      const prior = await repo.findOneBy({
        run_id: claim.run.id,
        adapter_call_id: call.callId,
      });
      if (prior) {
        if (
          prior.tool_name !== call.name ||
          prior.arguments_hash !== hash ||
          prior.contract_hash !== contractHash ||
          prior.state !== 'completed' ||
          !prior.public_result
        )
          fail('request_conflict');
        this.bound(prior.public_result, 'output');
        await reports.verifyResult(
          claim.identity,
          call.name,
          input,
          prior.public_result,
          manager,
          authority.routes,
        );
        return {
          id: prior.id,
          input,
          routes: authority.routes,
          replay: prior.public_result,
        };
      }
      if (context.signal.aborted) fail('cancelled');
      const receipt = await repo.save(
        Object.assign(new NodiaAiToolCall(), {
          id: randomUUID(),
          conversation_id: claim.run.conversation_id,
          run_id: claim.run.id,
          adapter_call_id: call.callId,
          tool_name: call.name,
          contract_hash: contractHash,
          arguments_hash: hash,
          arguments: input,
          public_result: null,
          scope_manifest: {
            schema_version: 1,
            module_routes: authority.routes,
          },
          state: 'validated',
          created_at: new Date(),
          completed_at: null,
        }),
      );
      return { id: receipt.id, input, routes: authority.routes, replay: null };
    });
    if (admitted.replay) return admitted.replay;
    // Each source owns its SQL transaction. A failed source cannot poison the receipt checkpoint.
    const deadlineAt = Math.min(
      claim.run.deadline_at?.getTime() ?? Infinity,
      Date.now() + this.policy.timing.domain_step_seconds * 1000,
    );
    const result = await reports.execute(
      claim.identity,
      call.name,
      admitted.input,
      {
        signal: context.signal,
        deadlineAt,
        allowedModuleRoutes: admitted.routes,
      },
    );
    this.bound(result, 'output');
    return context.checkpoint(async (manager) => {
      const authority = await access(manager);
      if (context.signal.aborted) fail('cancelled');
      if (Date.now() >= deadlineAt) fail('external_timeout');
      await reports.verifyResult(
        claim.identity,
        call.name,
        admitted.input,
        result,
        manager,
        authority.routes,
      );
      const repo = manager.getRepository(NodiaAiToolCall);
      const receipt = await repo.findOneBy({
        run_id: claim.run.id,
        adapter_call_id: call.callId,
      });
      if (
        !receipt ||
        receipt.id !== admitted.id ||
        receipt.state !== 'validated' ||
        receipt.contract_hash !== contractHash ||
        receipt.arguments_hash !==
          knowledgeHash(canonicalKnowledge(admitted.input))
      )
        fail('request_conflict');
      Object.assign(receipt, {
        state: 'completed',
        public_result: result,
        completed_at: new Date(),
      });
      await repo.save(receipt);
      await this.publishReceipt(manager, receipt, authority.routes);
      return result;
    });
  }
  private async executeExternal(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    call: {
      callId: string;
      name: string;
      arguments: unknown;
    },
    tool: NodiaAiRegisteredTool,
  ): Promise<NodiaAiJsonObject> {
    const deadlineAt = Math.min(
      claim.run.deadline_at?.getTime() ?? Number.POSITIVE_INFINITY,
      Date.now() + this.policy.timing.domain_step_seconds * 1000,
    );
    let prepared: NodiaAiPreparedToolOperation | undefined;
    try {
      const admitted = await context.checkpoint(async (manager) => {
        const access = await this.externalAccess(manager, claim, tool);
        const input = this.registry.validateInput(tool, call.arguments);
        this.bound(input, 'input');
        const argumentHash = knowledgeHash(canonicalKnowledge(input));
        const repo = manager.getRepository(NodiaAiToolCall);
        const prior = await repo.findOneBy({
          run_id: claim.run.id,
          adapter_call_id: call.callId,
        });
        const id = prior?.id ?? randomUUID();
        const handlerContext = this.externalContext(
          manager,
          claim,
          access,
          context.signal,
          id,
          deadlineAt,
        );
        await tool.verifyAuthority(input, handlerContext);
        prepared = await tool.external!.prepare(input, handlerContext);
        if (!/^[a-f0-9]{64}$/.test(prepared.fingerprint))
          fail('invalid_tool_output');
        if (prior) {
          if (
            prior.tool_name !== call.name ||
            prior.arguments_hash !== argumentHash ||
            prior.contract_hash !== tool.contractHash ||
            prior.scope_manifest.authority_hash !== access.scopeHash ||
            prior.scope_manifest.external_snapshot_hash !==
              prepared.fingerprint ||
            prior.state !== 'completed' ||
            !prior.public_result
          )
            fail('request_conflict');
          this.bound(prior.public_result, 'output');
          const result = this.registry.validateOutput(
            tool,
            prior.public_result,
          );
          await prepared.verify(handlerContext);
          await tool.verifyResultAuthority?.(input, result, handlerContext);
          return { replay: result, id, input, scopeHash: access.scopeHash };
        }
        if (context.signal.aborted || Date.now() >= deadlineAt)
          fail('cancelled');
        await repo.save(
          Object.assign(new NodiaAiToolCall(), {
            id,
            conversation_id: claim.run.conversation_id,
            run_id: claim.run.id,
            adapter_call_id: call.callId,
            tool_name: call.name,
            contract_hash: tool.contractHash,
            arguments_hash: argumentHash,
            arguments: input,
            public_result: null,
            scope_manifest: {
              schema_version: 1,
              module_routes: access.routes,
              authority_hash: access.scopeHash,
              external_snapshot_hash: prepared.fingerprint,
            },
            state: 'validated',
            created_at: new Date(),
            completed_at: null,
          }),
        );
        return { replay: undefined, id, input, scopeHash: access.scopeHash };
      }, tool.readIsolation);
      if (admitted.replay) return admitted.replay;
      const operation = prepared!;
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) fail('external_timeout');
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), remaining);
      const signal = AbortSignal.any([context.signal, timeout.signal]);
      let onAbort: (() => void) | undefined;
      let raw: NodiaAiJsonObject;
      try {
        signal.throwIfAborted();
        raw = await Promise.race([
          operation.execute(signal),
          new Promise<never>((_resolve, reject) => {
            onAbort = () =>
              reject(
                new Error(
                  context.signal.aborted
                    ? 'nodia_ai:cancelled'
                    : 'nodia_ai:external_timeout',
                ),
              );
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) onAbort();
          }),
        ]);
      } finally {
        clearTimeout(timer);
        if (onAbort) signal.removeEventListener('abort', onAbort);
      }
      this.bound(raw, 'output');
      const result = this.registry.validateOutput(tool, raw);
      return await context.checkpoint(async (manager) => {
        if (context.signal.aborted) fail('cancelled');
        if (Date.now() >= deadlineAt) fail('external_timeout');
        const access = await this.externalAccess(manager, claim, tool);
        if (access.scopeHash !== admitted.scopeHash) fail('request_conflict');
        const handlerContext = this.externalContext(
          manager,
          claim,
          access,
          context.signal,
          admitted.id,
          deadlineAt,
        );
        await tool.verifyAuthority(admitted.input, handlerContext);
        await operation.verify(handlerContext);
        await tool.verifyResultAuthority?.(
          admitted.input,
          result,
          handlerContext,
        );
        if (context.signal.aborted) fail('cancelled');
        if (Date.now() >= deadlineAt) fail('external_timeout');
        const repo = manager.getRepository(NodiaAiToolCall);
        const receipt = await repo.findOneBy({
          run_id: claim.run.id,
          adapter_call_id: call.callId,
        });
        if (
          !receipt ||
          receipt.id !== admitted.id ||
          receipt.state !== 'validated' ||
          receipt.contract_hash !== tool.contractHash ||
          receipt.arguments_hash !==
            knowledgeHash(canonicalKnowledge(admitted.input)) ||
          receipt.scope_manifest.external_snapshot_hash !==
            operation.fingerprint ||
          receipt.scope_manifest.authority_hash !== admitted.scopeHash
        )
          fail('request_conflict');
        await repo.save(
          Object.assign(receipt, {
            public_result: result,
            state: 'completed',
            completed_at: new Date(),
          }),
        );
        await this.publishReceipt(manager, receipt, access.routes);
        return result;
      }, tool.readIsolation);
    } finally {
      await prepared?.discard?.();
    }
  }
  private publishReceipt(
    manager: EntityManager,
    receipt: NodiaAiToolCall,
    routes: string[],
  ) {
    return appendNodiaAiEvent(manager, {
      conversationId: receipt.conversation_id,
      runId: receipt.run_id,
      eventKey: `tool:${receipt.id}:completed`,
      kind: 'tool_completed',
      payload: {
        result_ref: {
          tool_call_id: receipt.id,
          tool_name: receipt.tool_name,
          contract_hash: receipt.contract_hash,
        },
        state: 'completed',
        error: null,
      },
      moduleRoutes: routes,
      maxEvents: this.policy.results.outbox_events_per_activity,
    });
  }
  private async externalAccess(
    manager: EntityManager,
    claim: NodiaAiClaim,
    tool: NodiaAiRegisteredTool,
  ) {
    const access = await this.authority(manager, claim);
    if (
      !['read', 'read_artifact', 'analyze_attachment'].includes(tool.kind) ||
      !tool.external ||
      !access.grant.allowed_operations.includes(tool.toolName) ||
      !this.discovery.published(tool) ||
      !tool.requiredModuleRoutes.every((route) => moduleRouteIncluded(access.routes, route))
    )
      fail();
    if (this.frozenHash(claim, tool.toolName) !== tool.contractHash)
      fail('catalog_changed');
    await this.authorize.execute(
      claim.identity,
      {
        moduleRoutes: tool.requiredModuleRoutes,
        actionKeys: tool.actionKeys,
      },
      manager,
    );
    const visible = (
      await this.discovery.visible(manager, access.actor, access.routes)
    ).filter(
      (item) =>
        access.grant.allowed_operations.includes(item.toolName) &&
        this.frozenHash(claim, item.toolName) === item.contractHash,
    );
    return {
      ...access,
      scopeHash: knowledgeHash(
        canonicalKnowledge({
          routes: access.routes.map(contractModuleRoute).sort(),
          contracts: visible.map((item) => item.contractHash),
        }),
      ),
    };
  }
  private externalContext(
    manager: EntityManager,
    claim: NodiaAiClaim,
    access: {
      actor: NodiaAiToolHandlerContext['actor'];
      routes: string[];
    },
    signal: AbortSignal,
    id: string,
    deadlineAt: number,
  ): NodiaAiToolHandlerContext {
    return {
      manager,
      actor: access.actor,
      moduleRoutes: access.routes,
      signal,
      statementTimeoutMs: this.policy.timing.read_query_seconds * 1000,
      maxCollectionItems: this.policy.results.json_collection_items,
      maxRows: this.policy.results.list_max_rows,
      conversationId: claim.run.conversation_id,
      runId: claim.run.id,
      toolCallId: id,
      attemptId: claim.attempt.id,
      deadlineAt,
    };
  }
  private readIsolation(call: {
    name: string;
    arguments: unknown;
  }): 'REPEATABLE READ' | undefined {
    const direct = this.registry.get(call.name);
    if (direct) return direct.readIsolation;
    if (
      call.name !== 'nodia_entities_search' ||
      !call.arguments ||
      typeof call.arguments !== 'object' ||
      Array.isArray(call.arguments)
    )
      return undefined;
    const resourceKey =
      'resource_key' in call.arguments
        ? call.arguments.resource_key
        : undefined;
    return this.registry.findEntityResolver(resourceKey)?.readIsolation;
  }
  async progress(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    total: number,
    unforwarded = 0,
  ) {
    if (!['inference', 'delegated_inference'].includes(claim.job.stage_key))
      fail();
    return this.knowledgeTools.progress(claim, context, total, unforwarded);
  }
  async compactionProgress(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    total: number,
    unforwarded = 0,
  ): Promise<void> {
    if (
      claim.job.stage_key !== 'context' ||
      !['agentic', 'api_key'].includes(claim.run.selection_snapshot.mode)
    )
      fail();
    // Startup frames report zero requests. Commit any unexpected request cost
    // through the same monotonic ledger before rejecting tool use in compaction.
    await this.knowledgeTools.progress(claim, context, total, unforwarded);
    if (total !== 0 || unforwarded !== 0) fail();
  }
  private contractHash(name: string): string {
    if (name === NODIA_AI_SELECT_CAPABILITIES_TOOL)
      return this.selectionFlow.contractHash();
    const descriptor = NODIA_AI_KNOWLEDGE_TOOLS.find(
      (tool) => tool.name === name,
    );
    return descriptor
      ? knowledgeHash(canonicalKnowledge(descriptor))
      : this.discovery.contractHash(name);
  }
  private frozenHash(claim: NodiaAiClaim, name: string): unknown {
    const raw = claim.run.context_manifest.tool_contracts;
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw[name]
      : undefined;
  }
  private async authority(
    manager: EntityManager,
    claim: NodiaAiClaim,
    descriptorsOnly = false,
  ) {
    const actor = await this.authorize.execute(claim.identity, {}, manager);
    const run = await manager
      .getRepository(NodiaAiRun)
      .findOneByOrFail({ id: claim.run.id });
    const grant = await manager
      .getRepository(NodiaAiExecutionGrant)
      .findOneBy({ run_id: claim.run.id });
    const frozen = claim.run.context_manifest.module_routes;
    const delegated = claim.job.stage_key === 'delegated_inference';
    const target = run.routing_snapshot?.target;
    const activeSelection = delegated
      ? target?.selection
      : run.selection_snapshot;
    if (
      (!['inference', 'delegated_inference'].includes(claim.job.stage_key) &&
        !(descriptorsOnly && claim.job.stage_key === 'context')) ||
      !['agentic', 'api_key'].includes(String(activeSelection?.mode)) ||
      delegated
    )
      fail();
    const contracts = claim.run.context_manifest.tool_contracts;
    const frozenSelection = nodiaAiToolSelectionState(
      claim.run.context_manifest.tool_selection,
    );
    const currentSelection = nodiaAiToolSelectionState(
      run.context_manifest.tool_selection,
    );
    const hasSelection =
      claim.run.context_manifest.tool_selection !== undefined ||
      run.context_manifest.tool_selection !== undefined;
    if (hasSelection) {
      if (
        !frozenSelection ||
        !currentSelection ||
        currentSelection.catalog_hash !== this.selectionFlow.catalogHash() ||
        canonicalKnowledge(run.context_manifest.tool_selection_profile) !==
          canonicalKnowledge(
            claim.run.context_manifest.tool_selection_profile,
          ) ||
        (canonicalKnowledge(currentSelection) !==
          canonicalKnowledge(frozenSelection) &&
          !(
            frozenSelection.phase === 'discovery' &&
            currentSelection.phase === 'selection_requested' &&
            frozenSelection.catalog_hash === currentSelection.catalog_hash &&
            !frozenSelection.request &&
            currentSelection.request?.attempt_id === claim.attempt.id
          )) ||
        (['discovery', 'selection_requested'].includes(frozenSelection.phase) &&
          contracts &&
          typeof contracts === 'object' &&
          Object.keys(contracts).some((name) => this.registry.get(name)))
      )
        fail('catalog_changed');
    }
    if (
      !grant ||
      grant.actor_id !== actor.actorId ||
      grant.session_public_id !== actor.sessionId ||
      grant.revoked_at ||
      !Array.isArray(frozen) ||
      frozen.some((route) => typeof route !== 'string') ||
      !contracts ||
      typeof contracts !== 'object' ||
      Array.isArray(contracts) ||
      Object.values(contracts).some(
        (hash) => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash),
      ) ||
      run.catalog_version !== this.knowledge.manifest.catalog_release ||
      claim.run.catalog_version !== run.catalog_version ||
      claim.run.context_manifest.tool_catalog_version !==
        this.registry.catalogVersion ||
      run.context_manifest.tool_catalog_version !==
        this.registry.catalogVersion ||
      run.context_manifest.knowledge_release !==
        this.knowledge.manifest.release_id ||
      claim.run.context_manifest.knowledge_release !==
        this.knowledge.manifest.release_id ||
      canonicalKnowledge(run.context_manifest.tool_contracts) !==
        canonicalKnowledge(claim.run.context_manifest.tool_contracts)
    )
      fail('catalog_changed');
    const routes = actor.modules
      .map((item) => item.route)
      .filter(
        (route) =>
          moduleRouteIncluded(frozen, route) && moduleRouteIncluded(grant.allowed_modules, route),
      )
      .sort();
    return { actor, routes, grant };
  }
  private bound(value: unknown, side: 'input' | 'output'): void {
    const walk = (item: unknown, depth: number): void => {
      if (
        depth > this.policy.results.json_depth ||
        typeof item === 'bigint' ||
        typeof item === 'undefined' ||
        typeof item === 'function' ||
        typeof item === 'symbol' ||
        (typeof item === 'number' && !Number.isFinite(item))
      )
        fail(`invalid_tool_${side}`);
      if (item && typeof item === 'object') {
        if (
          !Array.isArray(item) &&
          Object.getPrototypeOf(item) !== Object.prototype &&
          Object.getPrototypeOf(item) !== null
        )
          fail(`invalid_tool_${side}`);
        const entries = Object.values(item);
        if (entries.length > this.policy.results.json_collection_items)
          fail(`invalid_tool_${side}`);
        for (const child of entries) walk(child, depth + 1);
      }
    };
    walk(value, 0);
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (
      bytes >
      (side === 'input'
        ? this.policy.results.tool_arguments_utf8_bytes
        : this.policy.results.tool_result_utf8_bytes)
    )
      fail(`invalid_tool_${side}`);
  }
}
