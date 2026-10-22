import { Injectable } from '@nestjs/common';
import { parseNativeTerminalProof } from '../native-terminal-proof.js';
import { createHash } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiAdapterTransport } from '../nodia-ai-adapter.service.js';
import {
  NodiaAiAdapterError,
  NodiaAiAdapterPort,
  NODIA_AI_MCP_CATALOG_LIMITS,
  NODIA_AI_NATIVE_MEDIA_TYPES,
  nodiaAiMcpCatalogUtf8Bytes,
  isNodiaAiMcpToolDescriptorValid,
  type NodiaAiAdapterObservation,
  type NodiaAiAdapterRequest,
  type NodiaAiAdapterReply,
  type NodiaAiContextMeasureInput,
  type NodiaAiContextMeasurement,
} from '../types/nodia-ai-adapter.types.js';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, 'utf8') <= maximum
  );
}
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  const data = record(value);
  return data
    ? Object.fromEntries(
        Object.keys(data)
          .sort()
          .map((key) => [key, canonical(data[key])]),
      )
    : value;
}

@Injectable()
export class GeminiNodiaAiAdapterUseCase extends NodiaAiAdapterPort {
  constructor(
    private readonly source: DataSource,
    private readonly transport: NodiaAiAdapterTransport,
  ) {
    super();
  }

  async measureContext(input: NodiaAiContextMeasureInput, signal?: AbortSignal): Promise<NodiaAiContextMeasurement> {
    const engine = this.engine(input.selection);
    if (!text(input.canonicalPrompt, 262144) ||
      (input.tools && (!Array.isArray(input.tools) || input.tools.length > NODIA_AI_MCP_CATALOG_LIMITS.tools ||
        new Set(input.tools.map((tool) => tool.name)).size !== input.tools.length ||
        input.tools.some((tool) => !isNodiaAiMcpToolDescriptorValid(tool)) ||
        nodiaAiMcpCatalogUtf8Bytes(input.tools) > NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes)) ||
      (engine === 'web' && Boolean(input.tools?.length)) ||
      (input.attachments && (!Array.isArray(input.attachments) || input.attachments.length > 4 ||
        input.attachments.some((item) => !['image', 'pdf', 'audio'].includes(item.kind) ||
          (item.media_type !== undefined && !text(item.media_type, 128))))))
      throw new NodiaAiAdapterError('adapter_invalid_request', 'not_dispatched');
    const timeout = AbortSignal.timeout(10000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const value = record(await this.transport.request(`/nodia-ai/${engine}/measure-context`, {
      model_id: input.selection.model_id, effort_id: input.selection.effort_id,
      canonical_prompt: input.canonicalPrompt,
      tools: (input.tools ?? []).map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })),
      attachments: (input.attachments ?? []).map((item) => ({ kind: item.kind, media_type: item.media_type })),
    }, combined));
    const byteKeys = ['canonical_utf8_bytes', 'catalog_utf8_bytes', 'overhead_utf8_bytes', 'total_utf8_bytes', 'max_utf8_bytes',
      'first_mcp_listing_upper_bound_utf8_bytes'];
    if (!value || !exactKeys(value, ['measurement_contract_version', 'measurement_scope', 'measurement_kind',
      ...byteKeys, 'model_context_tokens']) ||
      value.measurement_contract_version !== 'nodia-ai-context-budget/1' ||
      value.measurement_scope !== 'initial_native_prompt' ||
      value.measurement_kind !== (engine === 'agentic' && input.attachments?.length ? 'upper_bound' : 'exact') ||
      byteKeys.some((key) => typeof value[key] !== 'number' || !Number.isSafeInteger(value[key]) || Number(value[key]) < 0) ||
      value.canonical_utf8_bytes !== Buffer.byteLength(input.canonicalPrompt, 'utf8') ||
      value.max_utf8_bytes !== 262144 || value.model_context_tokens !== null ||
      Number(value.total_utf8_bytes) !== Number(value.canonical_utf8_bytes) + Number(value.catalog_utf8_bytes) + Number(value.overhead_utf8_bytes) ||
      (!input.tools?.length && value.catalog_utf8_bytes !== 0) ||
      (!input.tools?.length && value.first_mcp_listing_upper_bound_utf8_bytes !== 0) ||
      (Boolean(input.tools?.length) && (value.catalog_utf8_bytes === 0 ||
        Number(value.first_mcp_listing_upper_bound_utf8_bytes) <= Number(value.catalog_utf8_bytes))))
      throw new NodiaAiAdapterError('adapter_invalid_context_measurement', 'not_dispatched');
    return {
      measurementContractVersion: 'nodia-ai-context-budget/1', measurementScope: 'initial_native_prompt',
      measurementKind: value.measurement_kind as 'exact' | 'upper_bound',
      canonicalUtf8Bytes: Number(value.canonical_utf8_bytes), catalogUtf8Bytes: Number(value.catalog_utf8_bytes),
      overheadUtf8Bytes: Number(value.overhead_utf8_bytes), totalUtf8Bytes: Number(value.total_utf8_bytes),
      maxUtf8Bytes: Number(value.max_utf8_bytes), modelContextTokens: null,
      firstMcpListingUpperBoundUtf8Bytes: Number(value.first_mcp_listing_upper_bound_utf8_bytes),
    };
  }

  private engine(selection: NodiaAiSelection): 'web' | 'agentic' {
    if (
      !/^[1-9][0-9]{0,18}$/.test(selection.connection_id) ||
      BigInt(selection.connection_id) > 9223372036854775807n ||
      !text(selection.model_id, 1024) ||
      !(selection.effort_id === null || text(selection.effort_id, 256))
    ) {
      throw new NodiaAiAdapterError(
        'adapter_invalid_selection',
        'not_dispatched',
      );
    }
    if (selection.mode === 'token_plan_web') return 'web';
    if (selection.mode === 'token_plan_agentic') return 'agentic';
    throw new NodiaAiAdapterError('adapter_mode_unsupported', 'not_dispatched');
  }

  private async generation(
    selection: NodiaAiSelection,
    manager: EntityManager = this.source.manager,
  ): Promise<string> {
    const engine = this.engine(selection);
    const rows: unknown = await manager.query(
      `SELECT p.id::text, p.is_active, p.use_token_plan_web, p.use_token_plan_agentic,
       p.fields, p.updated_at, c.key AS provider_key, c.is_active AS catalog_active,
       c.can_use_token_plan_web, c.can_use_token_plan_agentic
       FROM ai_providers p INNER JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1${manager.queryRunner?.isTransactionActive ? ' FOR SHARE OF p,c' : ''}`,
      [selection.connection_id],
    );
    const row =
      Array.isArray(rows) && rows.length === 1 ? record(rows[0]) : null;
    if (
      !row ||
      row.provider_key !== 'gemini' ||
      row.is_active !== true ||
      row.catalog_active !== true ||
      row[
        engine === 'web' ? 'use_token_plan_web' : 'use_token_plan_agentic'
      ] !== true ||
      row[
        engine === 'web'
          ? 'can_use_token_plan_web'
          : 'can_use_token_plan_agentic'
      ] !== true
    ) {
      throw new NodiaAiAdapterError(
        'adapter_connection_unavailable',
        'not_dispatched',
      );
    }
    const fields = record(row.fields);
    return createHash('sha256')
      .update(
        JSON.stringify(
          canonical({
            connection_id: row.id,
            provider_key: row.provider_key,
            mode: selection.mode,
            fields: fields?.[selection.mode] ?? null,
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
    const engine = this.engine(selection);
    const configurationGeneration = await this.generation(selection);
    const timeout = AbortSignal.timeout(30000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const value = record(
      await this.transport.request(
        `/nodia-ai/${engine}/observe`,
        {
          model_id: selection.model_id,
          effort_id: selection.effort_id,
          configuration_generation: configurationGeneration,
        },
        combined,
      ),
    );
    const keys = [
      'available',
      'observed_at',
      'source',
      'resource_key',
      'session_generation',
      'adapter_contract_version',
      'supports_mcp',
      'reason',
    ];
    if (
      !value ||
      !exactKeys(
        value,
        [...keys, ...['verified_modalities', 'verified_attachment_media_types']
          .filter((key) => Object.hasOwn(value, key))],
      ) ||
      (value.verified_attachment_media_types !== undefined &&
        (!Array.isArray(value.verified_attachment_media_types) ||
          new Set(value.verified_attachment_media_types).size !== value.verified_attachment_media_types.length ||
          value.verified_attachment_media_types.some((mime) =>
            typeof mime !== 'string' || !Object.hasOwn(NODIA_AI_NATIVE_MEDIA_TYPES, mime)))) ||
      (value.verified_modalities !== undefined &&
        (!Array.isArray(value.verified_modalities) ||
          new Set(value.verified_modalities).size !==
            value.verified_modalities.length ||
          value.verified_modalities.some(
            (kind) => !['image', 'pdf', 'audio'].includes(String(kind)),
          ))) ||
      typeof value.available !== 'boolean' ||
      value.source !== 'gemini_live_session_and_catalog' ||
      value.adapter_contract_version !== 'nodia-ai-gemini-chat/1' ||
      typeof value.supports_mcp !== 'boolean' ||
      (engine === 'web' && value.supports_mcp !== false) ||
      typeof value.session_generation !== 'string' ||
      !/^[0-9a-f]{32}$/.test(value.session_generation) ||
      !(
        value.resource_key === null ||
        (typeof value.resource_key === 'string' &&
          /^gemini-profile:[0-9a-f]{64}$/.test(value.resource_key))
      ) ||
      !(value.reason === null || text(value.reason, 256)) ||
      typeof value.observed_at !== 'string'
    ) {
      throw new NodiaAiAdapterError(
        'adapter_invalid_observation',
        'not_dispatched',
      );
    }
    const observedAt = new Date(value.observed_at);
    if (
      !Number.isFinite(observedAt.getTime()) ||
      observedAt.getTime() > Date.now() + 5000 ||
      Date.now() - observedAt.getTime() > 300000 ||
      (value.available &&
        (value.resource_key === null || value.reason !== null))
    )
      throw new NodiaAiAdapterError(
        'adapter_invalid_observation',
        'not_dispatched',
      );
    await this.verifyConfiguration(selection, configurationGeneration);
    return {
      available: value.available,
      observedAt,
      source: value.source,
      resourceKey: value.resource_key,
      configurationGeneration,
      sessionGeneration: value.session_generation,
      adapterContractVersion: value.adapter_contract_version,
      supportsMcp: value.supports_mcp as boolean,
      verifiedModalities: (value.verified_modalities ?? []) as (
        'image' | 'pdf' | 'audio'
      )[],
      verifiedAttachmentMediaTypes: (value.verified_attachment_media_types ?? []) as string[],
      reason: value.reason,
    };
  }

  async execute(
    request: NodiaAiAdapterRequest,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterReply> {
    const engine = this.engine(request.selection);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        request.attemptId,
      ) ||
      !text(request.canonicalPrompt, 262144) ||
      !/^gemini-profile:[0-9a-f]{64}$/.test(request.resourceKey) ||
      !/^[0-9a-f]{32}$/.test(request.sessionGeneration) ||
      !(request.deadlineAt instanceof Date)
    )
      throw new NodiaAiAdapterError(
        'adapter_invalid_request',
        'not_dispatched',
      );
    const attachments = request.attachments;
    if (
      attachments &&
      (!Array.isArray(attachments) ||
        attachments.length > 4 ||
        attachments.some(
          (file) =>
            !file ||
            typeof file.content_base64 !== 'string' ||
            typeof file.sha256 !== 'string' ||
            typeof file.media_type !== 'string' ||
            !['image', 'pdf', 'audio'].includes(file.kind),
        ))
    )
      throw new NodiaAiAdapterError(
        'adapter_invalid_attachments',
        'not_dispatched',
      );
    let attachmentBytes = 0;
    for (const file of attachments ?? []) {
      const bytes = Buffer.from(file.content_base64, 'base64');
      attachmentBytes += bytes.length;
      if (
        !bytes.length ||
        bytes.length > 20971520 ||
        attachmentBytes > 41943040 ||
        bytes.toString('base64') !== file.content_base64 ||
        createHash('sha256').update(bytes).digest('hex') !== file.sha256
      )
        throw new NodiaAiAdapterError(
          'adapter_invalid_attachments',
          'not_dispatched',
        );
    }
    await this.verifyConfiguration(
      request.selection,
      request.configurationGeneration,
    );
    const remaining = Math.floor(
      (request.deadlineAt.getTime() - Date.now()) / 1000,
    );
    if (!Number.isFinite(remaining) || remaining < 1)
      throw new NodiaAiAdapterError(
        'adapter_deadline_expired',
        'not_dispatched',
      );
    const seconds = Math.min(remaining, 120);
    const timeout = AbortSignal.timeout(seconds * 1000 + 5000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    if (combined.aborted)
      throw new NodiaAiAdapterError(
        'adapter_cancelled_before_dispatch',
        'not_dispatched',
      );
    if (request.tools?.length) {
      if (engine !== 'agentic')
        throw new NodiaAiAdapterError('web_tools_prohibited', 'not_dispatched');
      return this.executeMcp(request, combined, seconds, false);
    }
    const value = record(
      await this.transport.request(
        `/nodia-ai/${engine}/turn`,
        {
          attempt_id: request.attemptId,
          model_id: request.selection.model_id,
          effort_id: request.selection.effort_id,
          canonical_prompt: request.canonicalPrompt,
          resource_key: request.resourceKey,
          session_generation: request.sessionGeneration,
          timeout_seconds: seconds,
          configuration_generation: request.configurationGeneration,
          ...(request.attachments?.length
            ? { attachments: request.attachments }
            : {}),
        },
        combined,
        true,
      ),
    );
    if (!value || !exactKeys(value, ['reply', 'terminal_proof']))
      throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown');
    const reply = record(value.reply);
    const terminalProof = parseNativeTerminalProof(value.terminal_proof, {
      engine,
      attemptId: request.attemptId,
      resourceKey: request.resourceKey,
      sessionGeneration: request.sessionGeneration,
      operationRef: request.attemptId,
    });
    if (terminalProof.outcome !== 'completed')
      throw new NodiaAiAdapterError(
        'adapter_terminal_proof_invalid',
        'unknown',
      );
    if (
      reply?.kind === 'answer' &&
      exactKeys(reply, ['kind', 'text']) &&
      text(reply.text, 32768)
    )
      return { kind: 'answer', text: reply.text, terminalProof };
    if (
      engine === 'web' &&
      reply?.kind === 'delegation_request' &&
      exactKeys(reply, ['kind', 'reason']) &&
      text(reply.reason, 1024)
    )
      return {
        kind: 'delegation_request',
        reason: reply.reason,
        terminalProof,
      };
    throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown');
  }
  /** Explicit operator diagnostic only: never called by health, auth or automatic routing. */
  async probeMcp(
    request: NodiaAiAdapterRequest,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterReply> {
    if (this.engine(request.selection) !== 'agentic')
      throw new NodiaAiAdapterError('web_tools_prohibited', 'not_dispatched');
    await this.verifyConfiguration(
      request.selection,
      request.configurationGeneration,
    );
    const seconds = Math.min(
      120,
      Math.floor((request.deadlineAt.getTime() - Date.now()) / 1000),
    );
    if (seconds < 1)
      throw new NodiaAiAdapterError(
        'adapter_deadline_expired',
        'not_dispatched',
      );
    const timeout = AbortSignal.timeout(seconds * 1000 + 5000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return this.executeMcp(request, combined, seconds, true);
  }
  private async executeMcp(
    request: NodiaAiAdapterRequest,
    signal: AbortSignal,
    seconds: number,
    diagnostic: boolean,
  ): Promise<NodiaAiAdapterReply> {
    const tools = request.tools;
    if (
      !tools?.length ||
      tools.length > NODIA_AI_MCP_CATALOG_LIMITS.tools ||
      new Set(tools.map((tool) => tool.name)).size !== tools.length ||
      !request.onToolCall ||
      !request.onProtocolProgress
    )
      throw new NodiaAiAdapterError(
        'mcp_callback_unconfigured',
        'not_dispatched',
      );
    for (const tool of tools) {
      if (!isNodiaAiMcpToolDescriptorValid(tool))
        throw new NodiaAiAdapterError('mcp_catalog_invalid', 'not_dispatched');
    }
    if (
      nodiaAiMcpCatalogUtf8Bytes(tools) > NODIA_AI_MCP_CATALOG_LIMITS.utf8Bytes
    )
      throw new NodiaAiAdapterError('mcp_catalog_invalid', 'not_dispatched');
    const reference = {
      resource_key: request.resourceKey,
      session_generation: request.sessionGeneration,
      operation_ref: request.attemptId,
    };
    const path = `/nodia-ai/agentic/attempts/${request.attemptId}/mcp`;
    let startRequested = false;
    let finished = false;
    try {
      startRequested = true;
      const start = record(
        await this.transport.request(
          '/nodia-ai/agentic/mcp/start',
          {
            attempt_id: request.attemptId,
            model_id: request.selection.model_id,
            effort_id: request.selection.effort_id,
            canonical_prompt: request.canonicalPrompt,
            resource_key: request.resourceKey,
            session_generation: request.sessionGeneration,
            timeout_seconds: seconds,
            configuration_generation: request.configurationGeneration,
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.inputSchema,
            })),
            diagnostic,
            ...(request.attachments?.length
              ? { attachments: request.attachments }
              : {}),
          },
          signal,
          true,
        ),
      );
      if (
        !start ||
        !exactKeys(start, ['attempt_id', 'state']) ||
        start.attempt_id !== request.attemptId ||
        start.state !== 'running'
      )
        throw new NodiaAiAdapterError('mcp_start_invalid', 'unknown');
      const seenCalls = new Set<string>();
      let cursor = 0,
        rpcMessages = 0,
        unforwardedToolRequests = 0,
        calls = 0;
      while (!signal.aborted) {
        const snapshot = record(
          await this.transport.request(
            path + '/events',
            { ...reference, after: cursor },
            signal,
            true,
          ),
        );
        if (
          !snapshot ||
          !exactKeys(snapshot, [
            'attempt_id',
            'state',
            'events',
            'rpc_messages',
            'unforwarded_tool_requests',
          ]) ||
          snapshot.attempt_id !== request.attemptId ||
          !['running', 'completed', 'unknown'].includes(
            String(snapshot.state),
          ) ||
          !Number.isSafeInteger(snapshot.rpc_messages) ||
          Number(snapshot.rpc_messages) < rpcMessages ||
          Number(snapshot.rpc_messages) > 128 ||
          !Number.isSafeInteger(snapshot.unforwarded_tool_requests) ||
          Number(snapshot.unforwarded_tool_requests) <
            unforwardedToolRequests ||
          Number(snapshot.unforwarded_tool_requests) > 12 ||
          Number(snapshot.unforwarded_tool_requests) + calls > 12 ||
          Number(snapshot.unforwarded_tool_requests) >
            Number(snapshot.rpc_messages) ||
          !Array.isArray(snapshot.events) ||
          snapshot.events.length > 256
        )
          throw new NodiaAiAdapterError('mcp_events_invalid', 'unknown');
        if (
          Number(snapshot.rpc_messages) > rpcMessages ||
          Number(snapshot.unforwarded_tool_requests) > unforwardedToolRequests
        ) {
          rpcMessages = Number(snapshot.rpc_messages);
          unforwardedToolRequests = Number(snapshot.unforwarded_tool_requests);
          await request.onProtocolProgress(
            rpcMessages,
            signal,
            unforwardedToolRequests,
          );
        }
        for (const candidate of snapshot.events) {
          const event = record(candidate);
          if (
            !event ||
            !Number.isSafeInteger(event.seq) ||
            event.seq !== cursor + 1 ||
            Number(event.seq) > 256
          )
            throw new NodiaAiAdapterError('mcp_event_order_invalid', 'unknown');
          cursor++;
          if (event.kind === 'tool_request') {
            if (
              !exactKeys(event, [
                'seq',
                'kind',
                'call_id',
                'name',
                'arguments',
              ]) ||
              typeof event.call_id !== 'string' ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
                event.call_id,
              ) ||
              seenCalls.has(event.call_id) ||
              typeof event.name !== 'string' ||
              !tools.some((tool) => tool.name === event.name) ||
              !record(event.arguments) ||
              Buffer.byteLength(JSON.stringify(event.arguments)) > 65536 ||
              ++calls + unforwardedToolRequests > 12
            )
              throw new NodiaAiAdapterError('mcp_call_invalid', 'unknown');
            seenCalls.add(event.call_id);
            const output = await request.onToolCall(
              {
                callId: event.call_id,
                name: event.name,
                arguments: event.arguments,
              },
              signal,
            );
            if (
              !record(output) ||
              Buffer.byteLength(JSON.stringify(output)) > 65500
            )
              throw new NodiaAiAdapterError('mcp_result_invalid', 'unknown');
            const accepted = record(
              await this.transport.request(
                path + '/results',
                { ...reference, call_id: event.call_id, result: output },
                signal,
                true,
              ),
            );
            if (
              !accepted ||
              !exactKeys(accepted, ['accepted']) ||
              accepted.accepted !== true
            )
              throw new NodiaAiAdapterError('mcp_result_rejected', 'unknown');
          } else if (event.kind === 'answer') {
            if (
              !exactKeys(event, ['seq', 'kind', 'text', 'terminal_proof']) ||
              !text(event.text, 32768) ||
              snapshot.state !== 'completed'
            )
              throw new NodiaAiAdapterError('mcp_answer_invalid', 'unknown');
            const terminalProof = parseNativeTerminalProof(
              event.terminal_proof,
              {
                engine: 'agentic',
                attemptId: request.attemptId,
                resourceKey: request.resourceKey,
                sessionGeneration: request.sessionGeneration,
                operationRef: request.attemptId,
              },
            );
            if (terminalProof.outcome !== 'completed')
              throw new NodiaAiAdapterError(
                'adapter_terminal_proof_invalid',
                'unknown',
              );
            if (diagnostic) {
              const attested = record(
                await this.transport.request(
                  path + '/attest',
                  reference,
                  signal,
                ),
              );
              if (
                !attested ||
                attested.verified !== true ||
                attested.adapter_contract_version !== 'nodia-ai-gemini-chat/1'
              )
                throw new NodiaAiAdapterError(
                  'mcp_probe_unverified',
                  'unknown',
                );
            }
            finished = true;
            return { kind: 'answer', text: event.text, terminalProof };
          } else throw new NodiaAiAdapterError('mcp_result_unknown', 'unknown');
        }
        if (snapshot.state !== 'running')
          throw new NodiaAiAdapterError('mcp_terminal_missing', 'unknown');
        await new Promise<void>((resolve, reject) => {
          const done = () => {
            signal.removeEventListener('abort', abort);
            resolve();
          };
          const timer = setTimeout(done, 100);
          const abort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            reject(new NodiaAiAdapterError('mcp_cancelled', 'unknown'));
          };
          signal.addEventListener('abort', abort, { once: true });
        });
      }
      throw new NodiaAiAdapterError('mcp_cancelled', 'unknown');
    } finally {
      if (startRequested && !finished) {
        await this.transport
          .request(path + '/cancel', reference, AbortSignal.timeout(10000))
          .catch(() => undefined);
      }
    }
  }
}
