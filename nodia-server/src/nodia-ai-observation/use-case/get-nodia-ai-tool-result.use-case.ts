import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { ValidateFunction } from 'ajv';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { conversationId } from '../../nodia-ai-conversation/use-case/get-nodia-ai-conversation.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  DiscoverNodiaAiToolsUseCase,
  NODIA_AI_TOOL_COMMON_SCHEMA,
} from '../../nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case.js';
import {
  NodiaAiToolRegistryUseCase,
  compileNodiaAiToolSchema,
} from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiToolObservation } from '../types/nodia-ai-tool-observation.types.js';
import { projectNodiaAiToolObservation } from './project-nodia-ai-tool-observation.js';
import { NodiaAiReportToolsUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js';

function absent(): never {
  throw new NotFoundException('nodia_ai:tool_result_not_found');
}

/** Human observation of immutable receipts. Never executes a handler, provider or runtime replay. */
@Injectable()
export class GetNodiaAiToolResultUseCase {
  private readonly toolObservation: ValidateFunction;
  constructor(
    private readonly source: DataSource,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly authorizeChat: AuthorizeNodiaAiConversationUseCase,
    private readonly registry: NodiaAiToolRegistryUseCase,
    private readonly discovery: DiscoverNodiaAiToolsUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Inject(NODIA_AI_TOOL_COMMON_SCHEMA) commonSchemaSource: string,
    private readonly reports?: NodiaAiReportToolsUseCase,
  ) {
    this.toolObservation = compileNodiaAiToolSchema({
      sourceJson: commonSchemaSource,
      definition: 'ToolObservation',
      sha256: createHash('sha256').update(commonSchemaSource).digest('hex'),
    }).validate;
  }
  async execute(
    identity: NodiaAiActorReference,
    id: string,
  ): Promise<NodiaAiJsonObject> {
    return (await this.read(identity, id, 'tool_result')).result;
  }
  async observe(
    identity: NodiaAiActorReference,
    id: string,
  ): Promise<NodiaAiToolObservation> {
    const observation = (await this.read(identity, id, 'tool_observation'))
      .observation;
    if (!this.toolObservation(observation))
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    return observation;
  }
  private async read(
    identity: NodiaAiActorReference,
    id: string,
    inspection: string,
  ) {
    const key = conversationId(id);
    const timeout = this.policy.timing.read_query_seconds * 1000;
    // Only identity/contract lookup precedes the native isolation boundary; no result escapes here.
    const selected = await this.source.transaction(async (manager) => {
      await lockAuthority(manager, false, timeout);
      await this.authorize.execute(identity, {}, manager);
      const row = await manager.getRepository(NodiaAiToolCall).findOne({
        where: { id: key },
        select: { tool_name: true, contract_hash: true },
      });
      if (row && this.reports?.handles(row.tool_name)) {
        if (row.contract_hash !== this.reports.contractHash(row.tool_name))
          return absent();
        return { reportName: row.tool_name };
      }
      const tool = row && this.registry.get(row.tool_name);
      if (
        !tool ||
        !row ||
        row.contract_hash !== tool.contractHash ||
        !this.discovery.published(tool)
      )
        return absent();
      return tool;
    });
    return this.source.transaction(
      ('reportName' in selected ? undefined : selected.readIsolation) ??
        'READ COMMITTED',
      async (manager) => {
        await lockAuthority(manager, false, timeout);
        // Reauthorize after choosing isolation; revocation between both transactions must win.
        await this.authorize.execute(identity, {}, manager);
        const call = await manager
          .getRepository(NodiaAiToolCall)
          .findOneBy({ id: key });
        if (!call) return absent();
        const { actor, chat } = await this.authorizeChat.execute(
          manager,
          identity,
          call.conversation_id,
          'read',
          inspection,
        );
        if ('reportName' in selected) {
          const reports = this.reports!;
          if (
            call.tool_name !== selected.reportName ||
            call.contract_hash !== reports.contractHash(call.tool_name) ||
            call.state !== 'completed' ||
            !call.completed_at ||
            !Number.isFinite(call.completed_at.getTime()) ||
            !call.public_result
          )
            return absent();
          this.bound(
            call.arguments,
            this.policy.results.tool_arguments_utf8_bytes,
          );
          this.bound(
            call.public_result,
            this.policy.results.tool_result_utf8_bytes,
          );
          const input = reports.validateInput(call.tool_name, call.arguments);
          if (knowledgeHash(canonicalKnowledge(input)) !== call.arguments_hash)
            throw new InternalServerErrorException(
              'nodia_ai:invalid_persisted_state',
            );
          const routes = call.scope_manifest.module_routes;
          if (
            call.scope_manifest.schema_version !== 1 ||
            !Array.isArray(routes) ||
            routes.some((route) => typeof route !== 'string')
          )
            throw new InternalServerErrorException(
              'nodia_ai:invalid_persisted_state',
            );
          await reports.verifyResult(
            identity,
            call.tool_name,
            input,
            call.public_result,
            manager,
            routes as string[],
            chat.owner_id,
          );
          const observation: NodiaAiToolObservation = {
            result_ref: {
              tool_call_id: call.id,
              tool_name: call.tool_name,
              contract_hash: call.contract_hash,
            },
            observed_at: call.completed_at.toISOString(),
            source: {
              module_key: 'nodia_ai',
              resource_key: 'reports',
              operation_key: 'run',
              description_key: 'nodiaAi:reports.title',
            },
            summary: { total: null, returned: null },
            navigation: [],
          };
          return { result: call.public_result, observation };
        }
        if (
          call.tool_name !== selected.toolName ||
          call.contract_hash !== selected.contractHash ||
          call.state !== 'completed' ||
          !call.completed_at ||
          !Number.isFinite(call.completed_at.getTime()) ||
          !call.public_result ||
          !this.discovery.published(selected)
        )
          return absent();
        await this.authorize.execute(
          identity,
          {
            moduleRoutes: selected.requiredModuleRoutes,
            actionKeys: selected.actionKeys,
          },
          manager,
        );
        const routes = actor.modules.map((module) => module.route);
        const moduleRoute = this.registry
          .modules(routes)
          .find((module) => module.key === selected.moduleKey)?.route;
        if (
          !moduleRoute ||
          !selected.requiredModuleRoutes.every((route) =>
            routes.includes(route),
          )
        )
          return absent();
        const context: NodiaAiToolHandlerContext = {
          manager,
          actor,
          moduleRoutes: routes,
          statementTimeoutMs: timeout,
          maxCollectionItems: this.policy.results.json_collection_items,
          maxRows: this.policy.results.list_max_rows,
          conversationId: call.conversation_id,
          runId: call.run_id,
          toolCallId: call.id,
        };
        try {
          this.bound(
            call.arguments,
            this.policy.results.tool_arguments_utf8_bytes,
          );
          this.bound(
            call.public_result,
            this.policy.results.tool_result_utf8_bytes,
          );
          const resolver = this.discovery.isEntityResolver(selected, routes);
          const input = resolver
            ? this.discovery.validateResolverInput(selected, call.arguments)
            : this.registry.validateInput(selected, call.arguments);
          if (knowledgeHash(canonicalKnowledge(input)) !== call.arguments_hash)
            throw Error();
          const manifest = call.scope_manifest;
          if (
            manifest.schema_version !== 1 ||
            !Array.isArray(manifest.module_routes) ||
            !selected.requiredModuleRoutes.every(
              (route) =>
                manifest.module_routes instanceof Array &&
                manifest.module_routes.includes(route),
            )
          )
            throw Error();
          await selected.verifyAuthority(input, context);
          const result = resolver
            ? this.discovery.validateResolverOutput(
                selected,
                input,
                call.public_result,
              )
            : this.registry.validateOutput(selected, call.public_result);
          await selected.verifyResultAuthority?.(input, result, context);
          return {
            result,
            observation: projectNodiaAiToolObservation(
              call,
              selected,
              input,
              result,
              moduleRoute,
            ),
          };
        } catch (error) {
          // Native authorization errors retain their status. Corrupted stored data never becomes an empty success.
          if (error instanceof Error && 'getStatus' in error) throw error;
          if (
            error instanceof Error &&
            error.message === 'nodia_ai:catalog_changed'
          )
            return absent();
          throw new InternalServerErrorException(
            'nodia_ai:invalid_persisted_state',
          );
        }
      },
    );
  }
  private bound(value: unknown, bytes: number) {
    const walk = (node: unknown, depth: number): void => {
      if (depth > this.policy.results.json_depth) throw Error();
      if (node !== null && typeof node === 'object') {
        const values = Object.values(node);
        if (values.length > this.policy.results.json_collection_items)
          throw Error();
        for (const child of values) walk(child, depth + 1);
      } else if (
        node !== null &&
        !['string', 'number', 'boolean'].includes(typeof node)
      )
        throw Error();
      else if (typeof node === 'number' && !Number.isFinite(node))
        throw Error();
    };
    walk(value, 0);
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > bytes) throw Error();
  }
}
