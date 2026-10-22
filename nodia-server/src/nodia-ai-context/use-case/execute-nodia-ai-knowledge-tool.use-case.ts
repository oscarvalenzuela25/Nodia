import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { appendNodiaAiEvent } from '../../nodia-ai-run/event-journal.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiClaim,
  NodiaAiStageContext,
} from '../../nodia-ai-runtime/types/worker.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  LoadNodiaAiKnowledgeUseCase,
  canonicalKnowledge,
  knowledgeHash,
} from './load-nodia-ai-knowledge.use-case.js';

export const NODIA_AI_KNOWLEDGE_TOOLS = Object.freeze([
  {
    name: 'nodia_knowledge_index',
    description:
      'List published Nodia product knowledge fragments authorized for this conversation. This grants no business operation.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'nodia_knowledge_get',
    description:
      'Read specific published knowledge fragments from the authorized index by exact ID; no business records or executable instructions.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fragment_ids: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          uniqueItems: true,
          items: { type: 'string', minLength: 1, maxLength: 256 },
        },
      },
      required: ['fragment_ids'],
    },
  },
]);
const fail = (code = 'invalid_knowledge_request'): never => {
  throw new Error(`nodia_ai:${code}`);
};
function args(name: string, input: unknown): NodiaAiJsonObject {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  )
    return fail();
  const object = input as Record<string, unknown>;
  if (name === 'nodia_knowledge_index') {
    if (Object.keys(object).length) return fail();
    return {};
  }
  if (
    name !== 'nodia_knowledge_get' ||
    Object.keys(object).length !== 1 ||
    !Array.isArray(object.fragment_ids) ||
    object.fragment_ids.length < 1 ||
    object.fragment_ids.length > 8 ||
    new Set(object.fragment_ids).size !== object.fragment_ids.length ||
    object.fragment_ids.some(
      (id) =>
        typeof id !== 'string' ||
        !id.trim() ||
        Buffer.byteLength(id, 'utf8') > 256,
    )
  )
    return fail();
  return { fragment_ids: object.fragment_ids as string[] };
}
/** Technical knowledge reads retained behind the shared ToolGateway. */
@Injectable()
export class ExecuteNodiaAiKnowledgeToolUseCase {
  constructor(
    private readonly knowledge: LoadNodiaAiKnowledgeUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    call: { callId: string; name: string; arguments: unknown },
    requestAlreadyCharged = false,
    authorizedRoutes?: readonly string[],
  ): Promise<NodiaAiJsonObject> {
    // Commit the request cost before validation/read work can fail or roll back.
    // Cached results deduplicate effects, not the budget spent requesting them.
    // Native IPC replays/rejections that do not reach this callback are charged
    // by progress instead. Native hook denials grant no Server tool execution.
    if (!requestAlreadyCharged)
      await context.checkpoint(async (manager) => {
        await this.authorize.execute(claim.identity, {}, manager);
        const reserved: { id: string }[] = await manager.query(
          `WITH changed AS (UPDATE nodia_ai_runs SET tool_calls_used=tool_calls_used+1 WHERE id=$1 AND tool_calls_used<(budget_snapshot->>'tool_calls')::integer RETURNING id) SELECT id FROM changed`,
          [claim.run.id],
        );
        if (reserved.length !== 1) return fail('execution_limit');
      });
    if (
      typeof call.callId !== 'string' ||
      !call.callId.trim() ||
      Buffer.byteLength(call.callId, 'utf8') > 512
    )
      return Promise.reject(new Error('nodia_ai:invalid_knowledge_request'));
    const input = args(call.name, call.arguments),
      descriptor = NODIA_AI_KNOWLEDGE_TOOLS.find(
        (tool) => tool.name === call.name,
      )!;
    if (
      Buffer.byteLength(JSON.stringify(input), 'utf8') >
      this.policy.results.tool_arguments_utf8_bytes
    )
      return fail();
    const argumentHash = knowledgeHash(canonicalKnowledge(input)),
      contractHash = knowledgeHash(canonicalKnowledge(descriptor));
    return context.checkpoint(async (manager) => {
      const actor = await this.authorize.execute(claim.identity, {}, manager);
      const frozen = claim.run.context_manifest.module_routes;
      if (
        !Array.isArray(frozen) ||
        frozen.some((route) => typeof route !== 'string') ||
        claim.run.context_manifest.knowledge_release !==
          this.knowledge.manifest.release_id
      )
        return fail('knowledge_release_changed');
      const routes = actor.modules
        .map((module) => module.route)
        .filter(
          (route) =>
            frozen.includes(route) &&
            (!authorizedRoutes || authorizedRoutes.includes(route)),
        );
      const repo = manager.getRepository(NodiaAiToolCall);
      const index = this.knowledge.index(routes);
      const prior = await repo.findOneBy({
        run_id: claim.run.id,
        adapter_call_id: call.callId,
      });
      if (prior) {
        const priorRoutes = prior.scope_manifest.module_routes;
        if (
          prior.tool_name !== call.name ||
          prior.arguments_hash !== argumentHash ||
          prior.contract_hash !== contractHash ||
          prior.state !== 'completed' ||
          !prior.public_result ||
          !Array.isArray(priorRoutes) ||
          priorRoutes.some(
            (route) => typeof route !== 'string' || !routes.includes(route),
          )
        )
          return fail('request_conflict');
        const result = prior.public_result;
        if (
          Object.keys(result).sort().join(',') !== 'items,release_id' ||
          result.release_id !== this.knowledge.manifest.release_id ||
          !Array.isArray(result.items) ||
          Buffer.byteLength(JSON.stringify(result), 'utf8') >
            this.policy.results.tool_result_utf8_bytes
        )
          return fail('invalid_tool_output');
        if (call.name === 'nodia_knowledge_index') {
          if (canonicalKnowledge(result.items) !== canonicalKnowledge(index))
            return fail('invalid_tool_output');
        } else {
          const ids = input.fragment_ids as string[];
          if (
            result.items.length !== ids.length ||
            new Set(
              result.items.map((item) =>
                item && typeof item === 'object' && !Array.isArray(item)
                  ? item.id
                  : null,
              ),
            ).size !== ids.length
          )
            return fail('invalid_tool_output');
          for (const item of result.items) {
            if (
              !item ||
              typeof item !== 'object' ||
              Array.isArray(item) ||
              Object.keys(item).sort().join(',') !== 'id,sha256,text' ||
              typeof item.id !== 'string' ||
              !ids.includes(item.id) ||
              typeof item.text !== 'string' ||
              typeof item.sha256 !== 'string' ||
              item.sha256 !==
                index.find((entry) => entry.id === item.id)?.sha256 ||
              knowledgeHash(item.text) !== item.sha256
            )
              return fail('invalid_tool_output');
          }
        }
        return structuredClone(prior.public_result);
      }
      const fragmentIds = input.fragment_ids as string[] | undefined;
      const content =
        call.name === 'nodia_knowledge_get'
          ? this.knowledge.execute(routes, fragmentIds)
          : null;
      const result: NodiaAiJsonObject = {
        release_id: this.knowledge.manifest.release_id,
        items: content
          ? content.fragments.map((item) => ({
              id: item.id,
              sha256: item.sha256,
              text: item.text,
            }))
          : index.map((item) => ({ ...item })),
      };
      if (
        Buffer.byteLength(JSON.stringify(result), 'utf8') >
        this.policy.results.tool_result_utf8_bytes
      )
        return fail('context_limit');
      if (content) {
        const run = await manager
          .getRepository(NodiaAiRun)
          .findOneByOrFail({ id: claim.run.id });
        const previous = run.context_manifest.fragments;
        const refs = new Map<string, NodiaAiJsonObject>();
        if (Array.isArray(previous))
          for (const item of previous) {
            if (
              item &&
              typeof item === 'object' &&
              !Array.isArray(item) &&
              typeof item.id === 'string'
            )
              refs.set(item.id, item);
          }
        for (const item of content.fragments) {
          const metadata = index.find((entry) => entry.id === item.id)!;
          refs.set(item.id, {
            id: item.id,
            sha256: item.sha256,
            document_revision: metadata.document_revision,
          });
        }
        run.context_manifest = {
          ...run.context_manifest,
          fragments: [...refs.values()],
        };
        await manager.getRepository(NodiaAiRun).save(run);
      }
      const entity = Object.assign(new NodiaAiToolCall(), {
        id: randomUUID(),
        conversation_id: claim.run.conversation_id,
        run_id: claim.run.id,
        adapter_call_id: call.callId,
        tool_name: call.name,
        contract_hash: contractHash,
        arguments_hash: argumentHash,
        arguments: input,
        public_result: result,
        scope_manifest: { schema_version: 1, module_routes: routes },
        state: 'completed',
        created_at: new Date(),
        completed_at: new Date(),
      });
      await repo.save(entity);
      await appendNodiaAiEvent(manager, {
        conversationId: claim.run.conversation_id,
        runId: claim.run.id,
        eventKey: `tool:${entity.id}:completed`,
        kind: 'tool_completed',
        payload: {
          result_ref: {
            tool_call_id: entity.id,
            tool_name: entity.tool_name,
            contract_hash: entity.contract_hash,
          },
          state: 'completed',
          error: null,
        },
        moduleRoutes: routes,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      return result;
    });
  }
  progress(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    total: number,
    unforwardedToolRequests = 0,
  ): Promise<void> {
    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      total > this.policy.budget.mcp_rpc_messages_per_run ||
      !Number.isSafeInteger(unforwardedToolRequests) ||
      unforwardedToolRequests < 0 ||
      unforwardedToolRequests > this.policy.budget.tool_calls_per_run
    )
      return Promise.reject(new Error('nodia_ai:execution_limit'));
    return context.checkpoint(async (manager) => {
      const run = await manager
        .getRepository(NodiaAiRun)
        .findOneByOrFail({ id: claim.run.id });
      const raw = run.context_manifest.mcp_rpc_progress;
      const progress =
        raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      const prior = progress[claim.attempt.id] ?? 0;
      const hiddenRaw = run.context_manifest.mcp_unforwarded_tool_progress;
      const hiddenProgress =
        hiddenRaw && typeof hiddenRaw === 'object' && !Array.isArray(hiddenRaw)
          ? hiddenRaw
          : {};
      const priorHidden = hiddenProgress[claim.attempt.id] ?? 0;
      if (
        typeof prior !== 'number' ||
        !Number.isSafeInteger(prior) ||
        total < prior ||
        typeof priorHidden !== 'number' ||
        !Number.isSafeInteger(priorHidden) ||
        unforwardedToolRequests < priorHidden
      )
        return fail('invalid_provider_response');
      const delta = total - prior;
      const hiddenDelta = unforwardedToolRequests - priorHidden;
      if (delta === 0 && hiddenDelta === 0) return;
      const changed: { id: string }[] = await manager.query(
        `WITH changed AS (UPDATE nodia_ai_runs SET mcp_rpc_messages_used=mcp_rpc_messages_used+$2,tool_calls_used=tool_calls_used+$3 WHERE id=$1 AND mcp_rpc_messages_used+$2<=(budget_snapshot->>'mcp_rpc_messages')::integer AND tool_calls_used+$3<=(budget_snapshot->>'tool_calls')::integer RETURNING id) SELECT id FROM changed`,
        [run.id, delta, hiddenDelta],
      );
      if (changed.length !== 1) return fail('execution_limit');
      // Save only the manifest, preserving the SQL-reserved counter in the same transaction.
      await manager.query(
        'UPDATE nodia_ai_runs SET context_manifest=$2::jsonb WHERE id=$1',
        [
          run.id,
          JSON.stringify({
            ...run.context_manifest,
            mcp_rpc_progress: { ...progress, [claim.attempt.id]: total },
            mcp_unforwarded_tool_progress: {
              ...hiddenProgress,
              [claim.attempt.id]: unforwardedToolRequests,
            },
          }),
        ],
      );
    });
  }
}
