import { moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import { projectHistoricalAiSnapshots } from '../../nodia-ai-conversation/use-case/historical-ai-snapshots.js';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { ValidateFunction } from 'ajv';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { conversationId } from '../../nodia-ai-conversation/use-case/get-nodia-ai-conversation.use-case.js';
import { NodiaAiPageQueryDto } from '../../nodia-ai-conversation/dto/nodia-ai-conversation-query.dto.js';
import { validateNodiaAiDto } from '../../nodia-ai-conversation/dto/nodia-ai-validation.js';
import { ProjectNodiaAiRunUseCase } from '../../nodia-ai-conversation/use-case/project-nodia-ai-run.use-case.js';
import { canReadNodiaAiManifest } from '../../nodia-ai-conversation/use-case/list-nodia-ai-messages.use-case.js';
import {
  cursorScope,
  decodeCursor,
  encodeCursor,
} from '../../nodia-ai-conversation/use-case/nodia-ai-pagination.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NODIA_AI_TOOL_COMMON_SCHEMA } from '../../nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { NodiaAiToolRegistryUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { NodiaAiReportToolsUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import {
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiObservationService } from '../nodia-ai-observation.service.js';
import { GetNodiaAiToolResultUseCase } from './get-nodia-ai-tool-result.use-case.js';
import {
  ObserveNodiaAiProposalsUseCase,
  proposalEventKey,
  type ProposalEventReference,
} from './observe-nodia-ai-proposals.use-case.js';

function hidden(error: unknown) {
  return (
    error instanceof Error &&
    (('getStatus' in error &&
      typeof error.getStatus === 'function' &&
      [403, 404, 409].includes(error.getStatus())) ||
      ['nodia_ai:capability_denied', 'nodia_ai:catalog_changed'].includes(
        error.message,
      ))
  );
}
/** Durable observation uses current authority; cursors never act as receipts or grants. */
@Injectable()
export class ObserveNodiaAiRunUseCase {
  private readonly eventPage: ValidateFunction;
  constructor(
    private readonly data: NodiaAiObservationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly project: ProjectNodiaAiRunUseCase,
    private readonly results: GetNodiaAiToolResultUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Inject(NODIA_AI_TOOL_COMMON_SCHEMA) source: string,
    private readonly registry: NodiaAiToolRegistryUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly proposals: ObserveNodiaAiProposalsUseCase,
    private readonly reports: NodiaAiReportToolsUseCase,
  ) {
    this.eventPage = compileNodiaAiToolSchema({
      sourceJson: source,
      definition: 'EventPage',
      sha256: createHash('sha256').update(source).digest('hex'),
    }).validate;
  }
  async summary(identity: NodiaAiActorReference, id: string) {
    const key = conversationId(id);
    return this.data.transaction(async (manager) => {
      await lockAuthority(manager);
      const run = await this.data.run(manager, key);
      if (!run) throw new NotFoundException('nodia_ai:run_not_found');
      await this.access.execute(
        manager,
        identity,
        run.conversation_id,
        'read',
        'run',
      );
      return this.project.execute(run);
    });
  }
  async events(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    const query = validateNodiaAiDto(NodiaAiPageQueryDto, input);
    const limit = query.page_limit ?? this.policy.results.list_default_rows;
    if (limit > this.policy.results.list_max_rows)
      throw new BadRequestException('nodia_ai:invalid_input');
    // Do not keep chat/authority locks open while reauthorizing domains under their native isolation.
    const initial = await this.data.transaction(async (manager) => {
      await lockAuthority(manager);
      const run = await this.data.run(manager, key);
      if (!run) throw new NotFoundException('nodia_ai:run_not_found');
      const { actor, chat } = await this.access.execute(
        manager,
        identity,
        run.conversation_id,
        'read',
        'events',
      );
      const refs = await this.data.toolRefs(
        manager,
        key,
        this.policy.budget.tool_calls_per_run,
      );
      if (refs.length > this.policy.budget.tool_calls_per_run)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      return { run, actor, chat, refs };
    });
    const permitted = new Set<string>();
    for (const ref of initial.refs) {
      try {
        const projection = await this.results.observe(identity, ref.id);
        if (
          projection.result_ref.tool_name === ref.tool_name &&
          projection.result_ref.contract_hash === ref.contract_hash
        )
          permitted.add(ref.id);
      } catch (error) {
        if (!hidden(error)) throw error;
      }
    }
    return this.data.transaction(async (manager) => {
      await lockAuthority(manager);
      const { actor, chat } = await this.access.execute(
        manager,
        identity,
        initial.chat.id,
        'read',
      );
      // Technical reports are not published product tools. Recheck their exact
      // receipt and native domain authority with this same transaction manager.
      // Preserve the reader/writer chat -> domain lock order. This is an
      // authority-only check, without an aggregate, dispatch or nested reader.
      const reportRefs = initial.refs.filter(
        (ref) => permitted.has(ref.id) && this.reports.handles(ref.tool_name),
      );
      for (const ref of reportRefs) {
        try {
          await this.verifyReport(
            manager,
            identity,
            chat.id,
            chat.owner_id,
            key,
            ref,
            actor.modules.map((module) => module.route),
          );
        } catch (error) {
          if (!hidden(error)) throw error;
          permitted.delete(ref.id);
        }
      }
      const registered = initial.refs.map((ref) =>
        this.registry.get(ref.tool_name),
      );
      const current = await this.authorize.filterAuthorized(
        identity,
        registered.map((tool) => ({
          moduleRoutes: tool?.requiredModuleRoutes ?? [],
          actionKeys: tool?.actionKeys ?? [],
        })),
        manager,
      );
      initial.refs.forEach((ref, index) => {
        if (
          !this.reports.handles(ref.tool_name) &&
          (!registered[index] || !current.allowed[index])
        )
          permitted.delete(ref.id);
      });
      const proposalRows = await this.data.proposalEvents(
        manager,
        key,
        this.policy.results.outbox_events_per_activity,
      );
      if (proposalRows.length > this.policy.results.outbox_events_per_activity)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      const proposalRefs: ProposalEventReference[] = proposalRows.map((row) => {
        const value = row.public_payload.payload;
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          typeof value.proposal_id !== 'string' ||
          typeof value.revision !== 'number' ||
          !Number.isSafeInteger(value.revision) ||
          value.revision < 1 ||
          typeof value.hash !== 'string' ||
          !/^[a-f0-9]{64}$/.test(value.hash)
        )
          throw new InternalServerErrorException(
            'nodia_ai:invalid_persisted_state',
          );
        return {
          proposal_id: value.proposal_id,
          revision: value.revision,
          hash: value.hash,
        };
      });
      const proposalAccess = await this.proposals.execute(
        manager,
        identity,
        chat.id,
        actor,
        proposalRefs,
      );
      const permittedProposalEvents = new Set(
        proposalRows
          .filter((_, index) =>
            proposalAccess.has(proposalEventKey(proposalRefs[index])),
          )
          .map((row) => row.id),
      );
      const scope = cursorScope({
        version: 'ai16',
        actor: actor.actorId,
        session: actor.sessionId,
        chat: chat.id,
        run: key,
        epoch: chat.retention_epoch,
      });
      // New authorized receipts do not reset an existing observer. A revoked/restored receipt does.
      const visibility = cursorScope({
        routes: actor.modules.map((module) => module.route).sort(),
        restrictedResults: initial.refs
          .filter(
            (ref, index) =>
              (registered[index] || this.reports.handles(ref.tool_name)) &&
              !permitted.has(ref.id),
          )
          .map((ref) => ref.id)
          .sort(),
        restrictedProposals: [
          ...new Set(
            proposalRefs
              .filter((ref) => !proposalAccess.has(proposalEventKey(ref)))
              .map(proposalEventKey),
          ),
        ].sort(),
      });
      const after = decodeCursor(query.cursor, scope);
      const position = after?.[0] ?? '0';
      if (
        after &&
        (after.length !== 2 ||
          !/^(0|[1-9]\d{0,18})$/.test(position) ||
          !/^[a-f0-9]{64}$/.test(after[1]) ||
          BigInt(position) > BigInt(chat.next_event_seq))
      )
        throw new BadRequestException('nodia_ai:invalid_cursor');
      if (after && after[1] !== visibility)
        return this.checked({
          conversation_id: chat.id,
          items: [],
          next_cursor: null,
          cursor_state: 'reset_required',
          has_more: false,
        });
      const rows = await this.data.events(manager, key, position, limit);
      const window = rows.slice(0, limit);
      const routes = actor.modules.map((module) => module.route);
      const items: NodiaAiJsonObject[] = [];
      let scanned = position;
      let hasMore = rows.length > limit;
      for (const row of window) {
        const payload = structuredClone(row.public_payload);
        if (payload.kind === 'run_stage_changed') {
          const value = payload.payload;
          if (!value || typeof value !== 'object' || Array.isArray(value) || !value.stage || typeof value.stage !== 'object' || Array.isArray(value.stage))
            throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
          try { value.stage.selection = projectHistoricalAiSnapshots(value.stage.selection,
            { schema_version: 1, enabled: false, revision: 1, target: null }).selection; }
          catch { throw new InternalServerErrorException('nodia_ai:invalid_persisted_state'); }
        }
        const resultRef =
          payload.payload &&
          typeof payload.payload === 'object' &&
          !Array.isArray(payload.payload)
            ? payload.payload.result_ref
            : undefined;
        const toolId =
          resultRef &&
          typeof resultRef === 'object' &&
          !Array.isArray(resultRef)
            ? resultRef.tool_call_id
            : undefined;
        if (typeof toolId === 'string' && permitted.has(toolId)) {
          const original = initial.refs.find((ref) => ref.id === toolId)!;
          if (
            !resultRef ||
            typeof resultRef !== 'object' ||
            Array.isArray(resultRef) ||
            resultRef.tool_name !== original.tool_name ||
            resultRef.contract_hash !== original.contract_hash
          )
            throw new InternalServerErrorException(
              'nodia_ai:invalid_persisted_state',
            );
        }
        const visible =
          canReadNodiaAiManifest(row.scope_manifest, routes) &&
          (payload.kind !== 'proposal_ready' ||
            permittedProposalEvents.has(row.id)) &&
          (payload.kind !== 'tool_completed' ||
            (typeof toolId === 'string' && permitted.has(toolId)));
        const item: NodiaAiJsonObject = {
          event_id: row.id,
          conversation_id: chat.id,
          run_id: key,
          seq: row.seq,
          cursor: encodeCursor(scope, [row.seq, visibility]),
          kind: payload.kind,
          payload: payload.payload,
          created_at: row.created_at.toISOString(),
        };
        // Bound the complete response before advancing over an event; never truncate a single event.
        if (
          visible &&
          Buffer.byteLength(JSON.stringify([...items, item]), 'utf8') >
            this.policy.results.tool_result_utf8_bytes - 2048
        ) {
          if (!items.length)
            throw new InternalServerErrorException(
              'nodia_ai:invalid_persisted_state',
            );
          hasMore = true;
          break;
        }
        scanned = row.seq;
        if (visible) items.push(item);
      }
      return this.checked({
        conversation_id: chat.id,
        items,
        next_cursor: encodeCursor(scope, [scanned, visibility]),
        cursor_state: 'current',
        has_more: hasMore,
      });
    });
  }
  private async verifyReport(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    chatId: string,
    ownerId: string,
    runId: string,
    ref: { id: string; tool_name: string; contract_hash: string },
    currentRoutes: readonly string[],
  ): Promise<void> {
    const [isolation]: { transaction_isolation: string }[] =
      await manager.query('SHOW transaction_isolation');
    if (isolation?.transaction_isolation !== 'read committed')
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    if (ref.contract_hash !== this.reports.contractHash(ref.tool_name))
      throw new NotFoundException('nodia_ai:tool_result_not_found');
    const call = await manager
      .getRepository(NodiaAiToolCall)
      .findOneBy({ id: ref.id });
    if (
      !call ||
      call.run_id !== runId ||
      call.conversation_id !== chatId ||
      call.tool_name !== ref.tool_name ||
      call.contract_hash !== ref.contract_hash ||
      call.state !== 'completed' ||
      !call.completed_at ||
      !Number.isFinite(call.completed_at.getTime()) ||
      !call.public_result
    )
      throw new NotFoundException('nodia_ai:tool_result_not_found');
    for (const [value, maximum] of [
      [call.arguments, this.policy.results.tool_arguments_utf8_bytes],
      [call.public_result, this.policy.results.tool_result_utf8_bytes],
    ] as const) {
      if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maximum)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
    }
    const input = this.reports.validateInput(call.tool_name, call.arguments);
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
    const authorizedRoutes = (routes as string[]).filter((route) =>
      moduleRouteIncluded(currentRoutes, route),
    );
    this.reports.assertGranted(input, authorizedRoutes);
    await this.reports.verifyResult(
      identity,
      call.tool_name,
      input,
      call.public_result,
      manager,
      authorizedRoutes,
      ownerId,
    );
  }
  private checked(page: NodiaAiJsonObject) {
    if (!this.eventPage(page))
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    return page;
  }
}
