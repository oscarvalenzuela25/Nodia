import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import { CodexOperationException } from '../../common/ai/codex/codex-contract.js';
import {
  CodexChatAcceptanceStore,
  sameCodexMcpScope,
  type CodexMcpAcceptanceScope,
} from '../../common/ai/codex/codex-chat-acceptance.js';
import type { NodiaAiRuntimeTerminalProof } from '../../nodia-ai-runtime/types/reconciliation.types.js';
import {
  CodexChatRuntimeError,
  type CodexChatIdentity,
} from '../../common/ai/codex/codex-chat-contract.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  assertRuntimeTerminalProof,
  readRuntimeProofRequest,
  runtimeProofDescriptor,
} from '../../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';
import {
  NodiaAiAdapterError,
  NodiaAiAdapterPort,
  NODIA_AI_MCP_CATALOG_LIMITS,
  isNodiaAiMcpToolDescriptorValid,
  nodiaAiMcpCatalogUtf8Bytes,
  type NodiaAiAdapterObservation,
  type NodiaAiAdapterReply,
  type NodiaAiAdapterRequest,
  type NodiaAiContextMeasureInput,
  type NodiaAiContextMeasurement,
} from '../types/nodia-ai-adapter.types.js';

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  const item = object(value);
  return item
    ? Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, canonical(item[key])]),
      )
    : value;
}
function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, 'utf8') <= maximum
  );
}

/** Private Nodia chat adapter. Native originals remain disabled until format acceptance. */
@Injectable()
export class CodexNodiaAiAdapterUseCase extends NodiaAiAdapterPort {
  private readonly pendingProbes = new Map<
    string,
    {
      scope: CodexMcpAcceptanceScope;
      selection: NodiaAiSelection;
      nonceSha256: string;
      deadline: number;
    }
  >();
  constructor(
    private readonly source: DataSource,
    private readonly runtime: CodexChatRuntime,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Optional()
    @Inject('CODEX_CHAT_ACCEPTANCE')
    private readonly acceptance = new CodexChatAcceptanceStore(runtime.journal),
  ) {
    super();
  }

  private async acceptanceScope(
    selection: NodiaAiSelection,
    observed: { resourceKey: string; runtimeSessionId: string },
    configurationGeneration: string,
  ): Promise<CodexMcpAcceptanceScope> {
    return {
      connectionId: selection.connection_id,
      resourceKey: observed.resourceKey,
      sessionGeneration: observed.runtimeSessionId,
      configurationGeneration,
      modelId: selection.model_id,
      effortId: selection.effort_id,
      runtimeFingerprint: createHash('sha256')
        .update(await this.runtime.fingerprint())
        .update(JSON.stringify(canonical(this.policy)))
        .digest('hex'),
    };
  }

  private validateSelection(selection: NodiaAiSelection): void {
    if (
      !selection ||
      typeof selection.connection_id !== 'string' ||
      !/^[1-9][0-9]{0,18}$/.test(selection.connection_id) ||
      BigInt(selection.connection_id) > 9223372036854775807n ||
      !text(selection.model_id, 128) ||
      !(
        selection.effort_id === null ||
        (typeof selection.effort_id === 'string' &&
          /^[a-z][a-z0-9_-]{0,31}$/.test(selection.effort_id))
      )
    )
      throw new NodiaAiAdapterError(
        'adapter_invalid_selection',
        'not_dispatched',
      );
    if (selection.mode !== 'token_plan_agentic')
      throw new NodiaAiAdapterError(
        'adapter_mode_unsupported',
        'not_dispatched',
      );
  }

  private async generation(
    selection: NodiaAiSelection,
    manager: EntityManager = this.source.manager,
  ): Promise<string> {
    this.validateSelection(selection);
    const rows: unknown = await manager.query(
      `SELECT p.id::text, p.is_active, p.use_token_plan_agentic, p.fields, p.updated_at,
       c.key AS provider_key, c.is_active AS catalog_active, c.can_use_token_plan_agentic
       FROM ai_providers p INNER JOIN ai_provider_catalog c ON c.id=p.catalog_id
       WHERE p.id=$1${manager.queryRunner?.isTransactionActive ? ' FOR SHARE OF p,c' : ''}`,
      [selection.connection_id],
    );
    const row =
      Array.isArray(rows) && rows.length === 1 ? object(rows[0]) : null;
    if (
      !row ||
      row.id !== selection.connection_id ||
      row.provider_key !== 'openai' ||
      row.is_active !== true ||
      row.catalog_active !== true ||
      row.use_token_plan_agentic !== true ||
      row.can_use_token_plan_agentic !== true
    )
      throw new NodiaAiAdapterError(
        'adapter_connection_unavailable',
        'not_dispatched',
      );
    return createHash('sha256')
      .update(
        JSON.stringify(
          canonical({
            connection_id: row.id,
            provider_key: row.provider_key,
            mode: selection.mode,
            fields: object(row.fields)?.[selection.mode] ?? null,
            updated_at: row.updated_at,
            enabled: true,
          }),
        ),
      )
      .digest('hex');
  }

  async verifyConfiguration(
    selection: NodiaAiSelection,
    generation: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (
      !/^[0-9a-f]{64}$/.test(generation) ||
      (await this.generation(selection, manager)) !== generation
    )
      throw new NodiaAiAdapterError(
        'adapter_configuration_changed',
        'not_dispatched',
      );
  }

  async observe(
    selection: NodiaAiSelection,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterObservation> {
    const configurationGeneration = await this.generation(selection);
    const observedAt = new Date();
    const timeout = AbortSignal.timeout(30000);
    let observed: Awaited<ReturnType<CodexChatRuntime['observe']>>;
    try {
      observed = await this.runtime.observe(
        selection.connection_id,
        signal ? AbortSignal.any([signal, timeout]) : timeout,
      );
    } catch (error: unknown) {
      if (
        error instanceof CodexOperationException &&
        error.code === 'codex_profile_busy'
      )
        throw new NodiaAiAdapterError('runtime_busy', 'not_dispatched');
      throw error;
    }
    if (
      !/^codex-profile:[0-9a-f]{64}$/.test(observed.resourceKey) ||
      !/^[0-9a-f]{32}$/.test(observed.runtimeSessionId) ||
      typeof observed.session.available !== 'boolean' ||
      observed.supportsMcp !== false
    )
      throw new NodiaAiAdapterError(
        'adapter_invalid_observation',
        'not_dispatched',
      );
    await this.verifyConfiguration(selection, configurationGeneration);
    const model = observed.models.find(
      (candidate) => candidate.id === selection.model_id,
    );
    const modelAvailable =
      !!model &&
      (selection.effort_id === null ||
        model.supportedReasoningEfforts.includes(selection.effort_id));
    const sessionAvailable =
      observed.session.available === true &&
      observed.session.authenticated === true &&
      observed.session.usageAllowed !== false;
    const available = sessionAvailable && modelAvailable;
    const accepted = available
      ? await this.acceptance.read(selection.connection_id)
      : null;
    const supportsMcp =
      accepted !== null &&
      sameCodexMcpScope(
        accepted.scope,
        await this.acceptanceScope(
          selection,
          observed,
          configurationGeneration,
        ),
      );
    return {
      available,
      observedAt,
      source: 'codex_live_session_and_catalog',
      resourceKey: observed.resourceKey,
      configurationGeneration,
      sessionGeneration: observed.runtimeSessionId,
      adapterContractVersion: 'nodia-ai-codex-chat/1',
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId: selection.connection_id,
      },
      supportsMcp,
      verifiedModalities: [],
      verifiedAttachmentMediaTypes: [],
      reason: available
        ? null
        : sessionAvailable && !modelAvailable
          ? 'codex_model_unavailable'
          : (observed.session.reason ?? 'codex_session_unverified'),
    };
  }

  async measureContext(
    input: NodiaAiContextMeasureInput,
    signal?: AbortSignal,
  ): Promise<NodiaAiContextMeasurement> {
    await this.generation(input.selection);
    signal?.throwIfAborted();
    this.validatePayload(input.canonicalPrompt, input.tools, input.attachments);
    const measured = this.runtime.measure({
      modelId: input.selection.model_id,
      ...(input.selection.effort_id !== null
        ? { effort: input.selection.effort_id }
        : {}),
      prompt: input.canonicalPrompt,
      tools: input.tools ?? [],
    });
    return {
      ...measured,
      measurementContractVersion: 'nodia-ai-context-budget/1',
      measurementScope: 'initial_native_prompt',
      modelContextTokens: null,
      firstMcpListingUpperBoundUtf8Bytes: 0,
    };
  }

  private validatePayload(
    prompt: string,
    tools: NodiaAiAdapterRequest['tools'],
    attachments: unknown,
  ): void {
    if (!text(prompt, this.policy.results.assembled_context_utf8_bytes))
      throw new NodiaAiAdapterError(
        'adapter_invalid_request',
        'not_dispatched',
      );
    if (
      attachments !== undefined &&
      (!Array.isArray(attachments) || attachments.length !== 0)
    )
      throw new NodiaAiAdapterError(
        'adapter_attachments_unverified',
        'not_dispatched',
      );
    if (
      tools !== undefined &&
      (!Array.isArray(tools) ||
        tools.length > NODIA_AI_MCP_CATALOG_LIMITS.tools ||
        new Set(tools.map((tool) => tool?.name)).size !== tools.length ||
        tools.some(
          (tool) =>
            !tool ||
            !object(tool.inputSchema) ||
            !isNodiaAiMcpToolDescriptorValid(tool),
        ) ||
        nodiaAiMcpCatalogUtf8Bytes(tools) >
          NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes)
    )
      throw new NodiaAiAdapterError('mcp_catalog_invalid', 'not_dispatched');
  }

  /** Explicit operator canary. The caller supplies the already-authorized read gateway.
   * Health/login/selection never call this method or trigger paid inference.
   */
  async probeMcp(
    request: NodiaAiAdapterRequest,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterReply> {
    if (
      request.tools?.length !== 1 ||
      request.tools[0].name !== 'nodia_knowledge_index' ||
      !request.onToolCall
    )
      throw new NodiaAiAdapterError('mcp_probe_invalid', 'not_dispatched');
    const toolName = request.tools[0].name;
    const gateway = request.onToolCall;
    request = {
      ...request,
      selection: Object.freeze({ ...request.selection }),
      tools: JSON.parse(
        JSON.stringify(request.tools),
      ) as NodiaAiAdapterRequest['tools'],
      deadlineAt: new Date(request.deadlineAt),
    };
    for (const [id, value] of this.pendingProbes)
      if (value.deadline < Date.now()) this.pendingProbes.delete(id);
    if (this.pendingProbes.size >= 4)
      throw new NodiaAiAdapterError('mcp_probe_busy', 'not_dispatched');
    const observation = await this.observe(request.selection, signal);
    if (
      !observation.available ||
      observation.resourceKey !== request.resourceKey ||
      observation.sessionGeneration !== request.sessionGeneration ||
      observation.configurationGeneration !== request.configurationGeneration
    )
      throw new NodiaAiAdapterError('mcp_probe_invalid', 'not_dispatched');
    const scope = await this.acceptanceScope(
      request.selection,
      {
        resourceKey: request.resourceKey,
        runtimeSessionId: request.sessionGeneration,
      },
      request.configurationGeneration,
    );
    await this.acceptance.invalidate(scope);
    const nonce = randomBytes(32).toString('hex');
    let callbacks = 0;
    const reply = await this.execute(
      {
        ...request,
        canonicalPrompt:
          `${request.canonicalPrompt}\nTechnical transport acceptance: call the supplied tool ${toolName} exactly once. ` +
          'Return the verification_nonce from its result verbatim. The nonce is generated by the server and is not supplied in this prompt. Do not call other tools.',
        onToolCall: async (call, callSignal) => {
          if (++callbacks !== 1 || call.name !== toolName)
            throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
          const result = await gateway(call, callSignal);
          return { result, verification_nonce: nonce };
        },
      },
      signal,
    );
    if (
      reply.kind !== 'answer' ||
      callbacks !== 1 ||
      !reply.text.includes(nonce)
    )
      throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
    this.pendingProbes.set(reply.terminalProof.terminalProofId, {
      scope,
      selection: { ...request.selection },
      nonceSha256: createHash('sha256').update(nonce).digest('hex'),
      deadline: request.deadlineAt.getTime(),
    });
    return reply;
  }

  /** Operator-only completion after the exact native ACK. No public endpoint. */
  async acceptMcpProbe(
    proof: NodiaAiRuntimeTerminalProof,
    signal: AbortSignal,
  ): Promise<void> {
    signal.throwIfAborted();
    const expected = readRuntimeProofRequest(runtimeProofDescriptor(proof));
    assertRuntimeTerminalProof(expected, proof);
    if (
      !expected.adapterIdentity ||
      expected.adapterIdentity.providerKey !== 'openai'
    )
      throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
    proof = Object.freeze({
      ...expected,
      adapterIdentity: Object.freeze({ ...expected.adapterIdentity }),
      processClosed: true,
      outcome: proof.outcome,
      terminalProofId: proof.terminalProofId,
      observedAt: new Date(proof.observedAt),
    });
    const pending = this.pendingProbes.get(proof.terminalProofId);
    if (!pending)
      throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
    const observed = await this.observe(pending.selection, signal);
    if (
      !observed.available ||
      !observed.resourceKey ||
      !sameCodexMcpScope(
        pending.scope,
        await this.acceptanceScope(
          pending.selection,
          {
            resourceKey: observed.resourceKey,
            runtimeSessionId: observed.sessionGeneration,
          },
          observed.configurationGeneration,
        ),
      )
    )
      throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
    await this.runtime.journal.admission(async () => {
      signal.throwIfAborted();
      const record = await this.runtime.journal.read(proof.attemptId);
      if (
        !record ||
        !record.acknowledged ||
        record.state !== 'completed' ||
        record.unforwardedRequests !== 0
      )
        throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
      const actual = this.runtime.journal.proof(record);
      assertRuntimeTerminalProof(actual, proof);
      if (
        actual.terminalProofId !== proof.terminalProofId ||
        actual.observedAt.getTime() !== proof.observedAt.getTime() ||
        actual.adapterIdentity?.connectionId !== pending.scope.connectionId ||
        actual.sessionGeneration !== pending.scope.sessionGeneration ||
        actual.resourceKey !== pending.scope.resourceKey
      )
        throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
      const identity = await this.runtime.journal.identity(
        pending.scope.connectionId,
        false,
        false,
      );
      if (
        identity.runtimeSessionId !== pending.scope.sessionGeneration ||
        identity.resourceKey !== pending.scope.resourceKey
      )
        throw new NodiaAiAdapterError('mcp_probe_unverified', 'unknown');
      await this.verifyConfiguration(
        pending.selection,
        pending.scope.configurationGeneration,
      );
      await this.acceptance.write({
        version: 1,
        scope: pending.scope,
        verifiedAt: actual.observedAt.toISOString(),
        terminalProofId: actual.terminalProofId,
        nonceSha256: pending.nonceSha256,
      });
    });
    this.pendingProbes.delete(proof.terminalProofId);
  }

  async execute(
    request: NodiaAiAdapterRequest,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterReply> {
    this.validateSelection(request.selection);
    this.validatePayload(
      request.canonicalPrompt,
      request.tools,
      request.attachments,
    );
    const remaining =
      request.deadlineAt instanceof Date
        ? request.deadlineAt.getTime() - Date.now()
        : NaN;
    if (!Number.isFinite(remaining) || remaining <= 0)
      throw new NodiaAiAdapterError(
        'adapter_deadline_expired',
        'not_dispatched',
      );
    const deadline = AbortSignal.timeout(
      Math.min(this.policy.timing.provider_dispatch_seconds * 1000, remaining),
    );
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    if (combined.aborted)
      throw new NodiaAiAdapterError(
        'adapter_cancelled_before_dispatch',
        'not_dispatched',
      );
    if (
      !request.onLeaseCheck ||
      !request.onProtocolProgress ||
      (request.tools?.length && !request.onToolCall)
    )
      throw new NodiaAiAdapterError(
        'mcp_callback_unconfigured',
        'not_dispatched',
      );
    const identity: CodexChatIdentity = {
      engine: 'agentic',
      attemptId: request.attemptId,
      operationRef: request.attemptId,
      resourceKey: request.resourceKey,
      sessionGeneration: request.sessionGeneration,
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId: request.selection.connection_id,
      },
    };
    Object.freeze(identity.adapterIdentity);
    Object.freeze(identity);
    try {
      readRuntimeProofRequest(runtimeProofDescriptor(identity));
    } catch {
      throw new NodiaAiAdapterError(
        'adapter_invalid_request',
        'not_dispatched',
      );
    }
    await this.verifyConfiguration(
      request.selection,
      request.configurationGeneration,
    );
    await request.onLeaseCheck(combined);
    try {
      const reply = await this.runtime.execute(
        {
          identity,
          modelId: request.selection.model_id,
          ...(request.selection.effort_id !== null
            ? { effort: request.selection.effort_id }
            : {}),
          prompt: request.canonicalPrompt,
          tools: request.tools ?? [],
          deadlineAt: request.deadlineAt,
          signal: combined,
          limits: {
            requests: this.policy.budget.mcp_rpc_messages_per_run,
            toolCalls: this.policy.budget.tool_calls_per_run,
            argumentUtf8Bytes: this.policy.results.tool_arguments_utf8_bytes,
            resultUtf8Bytes: this.policy.results.tool_result_utf8_bytes,
            jsonDepth: this.policy.results.json_depth,
            collectionItems: this.policy.results.json_collection_items,
          },
        },
        {
          onPrepared: async (prepared) => {
            try {
              if (
                JSON.stringify(runtimeProofDescriptor(prepared)) !==
                JSON.stringify(runtimeProofDescriptor(identity))
              )
                throw Error('identity mismatch');
            } catch {
              throw new NodiaAiAdapterError(
                'adapter_prepared_identity_invalid',
                'not_dispatched',
              );
            }
            await request.onLeaseCheck!(combined);
          },
          assertLease: request.onLeaseCheck,
          onProtocolProgress: request.onProtocolProgress,
          onToolCall: async (call, callSignal) => {
            if (
              !request.onToolCall ||
              !request.tools?.some((tool) => tool.name === call.name)
            )
              throw new NodiaAiAdapterError('mcp_call_invalid', 'unknown');
            return request.onToolCall(call, callSignal);
          },
        },
      );
      assertRuntimeTerminalProof(identity, reply.terminalProof);
      if (
        reply.terminalProof.observedAt.getTime() > Date.now() + 5000 ||
        reply.terminalProof.outcome !== 'completed' ||
        !text(reply.text, this.policy.results.assistant_text_utf8_bytes)
      )
        throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown');
      return {
        kind: 'answer',
        text: reply.text,
        terminalProof: reply.terminalProof,
      };
    } catch (error) {
      if (!(
        error instanceof CodexChatRuntimeError &&
        error.outcome === 'not_dispatched'
      )) {
        const accepted = await this.acceptance.read(
          request.selection.connection_id,
        );
        if (
          accepted &&
          accepted.scope.resourceKey === request.resourceKey &&
          accepted.scope.sessionGeneration === request.sessionGeneration &&
          accepted.scope.configurationGeneration ===
            request.configurationGeneration &&
          accepted.scope.modelId === request.selection.model_id &&
          accepted.scope.effortId === request.selection.effort_id
        )
          await this.acceptance.invalidate(accepted.scope);
      }
      if (error instanceof NodiaAiAdapterError) throw error;
      // The runtime owns the native start gate. An unclassified error after entering it remains uncertain.
      if (
        error instanceof CodexChatRuntimeError &&
        error.outcome === 'not_dispatched'
      )
        throw new NodiaAiAdapterError(error.code, 'not_dispatched');
      throw new NodiaAiAdapterError('codex_result_unknown', 'unknown');
    }
  }
}
