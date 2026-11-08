import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { Business } from '../../business/entities/business.entity.js';
import { Provider } from '../../provider/entities/provider.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';
import { NodiaAiMessage } from '../../nodia-ai-conversation/entities/nodia-ai-message.entity.js';
import { NodiaAiMessagePart } from '../../nodia-ai-conversation/entities/nodia-ai-message-part.entity.js';
import { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { MAX_INVOICE_FILE_BYTES } from '../../invoice/invoice-file-validation.js';
import {
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { NODIA_AI_INVOICE_ANALYSIS_TOOL } from '../types/invoice-analysis-contract.types.js';

export function invoiceAnalysisInvalid(code = 'tool_not_available'): never {
  if (code === 'tool_not_available')
    throw new ForbiddenException('nodia_ai:tool_not_available');
  throw new Error(`nodia_ai:${code}`);
}
export function analysisObject(value: unknown): NodiaAiJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invoiceAnalysisInvalid();
  return value as NodiaAiJsonObject;
}
export function analysisHash(value: unknown): string {
  return knowledgeHash(
    value === undefined ? 'undefined' : canonicalKnowledge(value),
  );
}
const templateKeys = [
  'code',
  'cost_price',
  'cost_price_tax',
  'packages',
  'units_per_package',
] as const;
function publicProviderFields(value: unknown): NodiaAiJsonObject | null {
  if (value === null || value === undefined) return null;
  const raw = analysisObject(value),
    output: NodiaAiJsonObject = {};
  for (const key of templateKeys) {
    const item = raw[key];
    if (item === undefined) continue;
    if (item === null || typeof item === 'string') {
      if (typeof item === 'string' && item.length > 4096)
        invoiceAnalysisInvalid();
      output[key] = item;
      continue;
    }
    const nested = analysisObject(item);
    if (Object.keys(nested).some((k) => !['value', 'instructions'].includes(k)))
      invoiceAnalysisInvalid();
    for (const field of Object.values(nested))
      if (!(
        field === null ||
        (typeof field === 'string' && field.length <= 4096)
      ))
        invoiceAnalysisInvalid();
    output[key] = nested;
  }
  return output;
}
/** Current generation provenance. No URL, storage key, AI connection or actor can be selected by MCP. */
@Injectable()
export class SnapshotNodiaAiInvoiceAnalysisUseCase {
  constructor(
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly adapter: NodiaAiAdapterPort,
  ) {}
  async execute(
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiJsonObject> {
    context.signal?.throwIfAborted();
    if (
      !context.manager.queryRunner?.isTransactionActive ||
      !context.runId ||
      !context.conversationId ||
      !context.toolCallId ||
      !context.moduleRoutes.includes('/business') ||
      !context.moduleRoutes.includes('/nodia-ai')
    )
      invoiceAnalysisInvalid();
    const historical = !context.attemptId;
    let attemptId = context.attemptId;
    if (historical) {
      const stored = await context.manager
        .getRepository(NodiaAiToolCall)
        .findOneBy({
          id: context.toolCallId,
          run_id: context.runId,
          conversation_id: context.conversationId,
        });
      if (
        !stored ||
        stored.state !== 'completed' ||
        stored.tool_name !== NODIA_AI_INVOICE_ANALYSIS_TOOL ||
        analysisHash(stored.arguments) !== analysisHash(input)
      )
        invoiceAnalysisInvalid();
      const origin =
        input.action === 'complete'
          ? await this.anchor(String(input.analysis_id), context)
          : stored;
      const frozen = analysisObject(
        origin.scope_manifest.invoice_analysis_snapshot,
      );
      if (typeof frozen.attempt_id !== 'string') invoiceAnalysisInvalid();
      attemptId = frozen.attempt_id;
    }
    let command = input;
    if (input.action === 'complete') {
      const anchor = await this.anchor(String(input.analysis_id), context);
      command = anchor.arguments;
    }
    if (
      typeof command.business_id !== 'string' ||
      typeof command.attachment_id !== 'string'
    )
      invoiceAnalysisInvalid();
    if (
      command.provider_id !== undefined &&
      (typeof command.provider_id !== 'string' ||
        !/^[1-9][0-9]{0,18}$/.test(command.provider_id) ||
        BigInt(command.provider_id) > 9223372036854775807n)
    )
      invoiceAnalysisInvalid('invalid_tool_arguments');
    const manager = context.manager;
    const run = await manager
      .getRepository(NodiaAiRun)
      .findOneBy({ id: context.runId });
    const attempt = await manager
      .getRepository(NodiaAiJobAttempt)
      .findOneBy({ id: attemptId });
    const conversation = await manager
      .getRepository(NodiaAiConversation)
      .findOneBy({ id: context.conversationId });
    const job = attempt
      ? await manager
          .getRepository(NodiaAiJob)
          .findOneBy({ id: attempt.job_id })
      : null;
    if (
      !run ||
      !attempt ||
      !job ||
      !conversation ||
      run.conversation_id !== context.conversationId ||
      (run.actor_id !== context.actor.actorId &&
        !(historical && context.actor.isSuperAdmin)) ||
      job.run_id !== run.id ||
      job.conversation_id !== context.conversationId ||
      (!historical &&
        (attempt.phase !== 'dispatch_armed' || attempt.ended_at !== null)) ||
      !['inference', 'delegated_inference'].includes(attempt.stage_key) ||
      (!historical && run.state !== 'running') ||
      conversation.lifecycle !== 'active' ||
      conversation.expires_at.getTime() <= Date.now() ||
      run.retention_epoch !== conversation.retention_epoch ||
      (!historical && run.deadline_at.getTime() <= Date.now())
    )
      invoiceAnalysisInvalid();
    const selection = attempt.selection_snapshot;
    if (
      !selection ||
      !['agentic', 'api_key'].includes(selection.mode) ||
      !selection.connection_id ||
      !selection.model_id
    )
      invoiceAnalysisInvalid();
    const delegated = attempt.stage_key === 'delegated_inference';
    const expectedSelection = delegated
      ? run.routing_snapshot.target?.selection
      : run.selection_snapshot;
    const configurationGeneration = delegated
      ? run.routing_snapshot.target?.configuration_generation
      : run.context_manifest.configuration_generation;
    if (
      analysisHash(selection) !== analysisHash(expectedSelection) ||
      typeof configurationGeneration !== 'string'
    )
      invoiceAnalysisInvalid();
    try {
      await this.adapter.verifyConfiguration(
        selection,
        configurationGeneration,
        manager,
      );
    } catch {
      invoiceAnalysisInvalid();
    }
    const stages = analysisObject(run.context_manifest.stage_contexts),
      stage = analysisObject(stages[attempt.id]);
    if (
      stage.user_message_id !== run.user_message_id ||
      stage.input_through_seq !== run.input_through_seq ||
      !Array.isArray(stage.invoice_analysis_sources)
    )
      invoiceAnalysisInvalid();
    const message = await manager.getRepository(NodiaAiMessage).findOneBy({
      id: run.user_message_id,
      conversation_id: run.conversation_id,
    });
    const part = await manager.getRepository(NodiaAiMessagePart).findOneBy({
      message_id: run.user_message_id,
      conversation_id: run.conversation_id,
      attachment_id: command.attachment_id,
    });
    const attachment = await manager.getRepository(NodiaAiAttachment).findOne({
      where: {
        id: command.attachment_id,
        conversation_id: run.conversation_id,
      },
      lock: { mode: 'pessimistic_read' },
    });
    if (
      !message ||
      message.role !== 'user' ||
      message.author_id !== run.actor_id ||
      message.seq !== run.input_through_seq ||
      !part ||
      part.text !== null ||
      !attachment ||
      attachment.state !== 'ready' ||
      attachment.retention_epoch !== run.retention_epoch ||
      attachment.expires_at.getTime() <= Date.now() ||
      !['pdf', 'image'].includes(attachment.kind) ||
      part.kind !== attachment.kind ||
      !attachment.content_hash ||
      !/^[a-f0-9]{64}$/.test(attachment.content_hash) ||
      !attachment.byte_count ||
      !/^[1-9][0-9]*$/.test(attachment.byte_count)
    )
      invoiceAnalysisInvalid();
    const bytes = Number(attachment.byte_count);
    if (
      !Number.isSafeInteger(bytes) ||
      bytes >
        Math.min(MAX_INVOICE_FILE_BYTES, this.policy.admission.file_bytes) ||
      !attachment.media_type ||
      !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
        attachment.media_type,
      ) ||
      (attachment.kind === 'pdf'
        ? attachment.media_type !== 'application/pdf' ||
          !Number.isInteger(attachment.page_count) ||
          attachment.page_count! < 1 ||
          attachment.page_count! >
            Math.min(100, this.policy.admission.pdf_pages)
        : attachment.media_type === 'application/pdf' ||
          attachment.page_count !== null)
    )
      invoiceAnalysisInvalid();
    const frozenSource: NodiaAiJsonObject = {
      attachment_id: attachment.id,
      generation: attachment.generation,
      content_hash: attachment.content_hash,
      byte_count: bytes,
      media_type: attachment.media_type,
      kind: attachment.kind,
      retention_epoch: attachment.retention_epoch,
    };
    if (
      !stage.invoice_analysis_sources.some(
        (source) => analysisHash(source) === analysisHash(frozenSource),
      )
    )
      invoiceAnalysisInvalid();
    const business = await manager.getRepository(Business).findOne({
      where: { id: command.business_id },
      lock: { mode: 'pessimistic_read' },
    });
    if (!business) invoiceAnalysisInvalid();
    const providerId =
      typeof command.provider_id === 'string' ? command.provider_id : null;
    const provider = providerId
      ? await manager.getRepository(Provider).findOne({
          where: { id: providerId, business_id: business.id },
          lock: { mode: 'pessimistic_read' },
        })
      : null;
    if (providerId && !provider) invoiceAnalysisInvalid();
    if (
      provider &&
      (!Number.isInteger(provider.tax) ||
        provider.tax < 0 ||
        provider.tax > 100)
    )
      invoiceAnalysisInvalid();
    const source = { ...frozenSource };
    delete source.retention_epoch;
    const snapshot: NodiaAiJsonObject = {
      schema_version: 1,
      conversation_id: run.conversation_id,
      run_id: run.id,
      attempt_id: attempt.id,
      actor_id: run.actor_id,
      user_message_id: run.user_message_id,
      input_through_seq: run.input_through_seq,
      retention_epoch: run.retention_epoch,
      business_id: business.id,
      provider_id: providerId,
      provider_fields: provider ? publicProviderFields(provider.fields) : null,
      tax: provider?.tax ?? null,
      source,
      selection: { ...selection },
    };
    if (input.action === 'complete') {
      const anchor = await this.anchor(String(input.analysis_id), context);
      if (
        analysisHash(anchor.scope_manifest.invoice_analysis_snapshot) !==
        analysisHash(snapshot)
      )
        invoiceAnalysisInvalid('request_conflict');
    }
    return snapshot;
  }
  async anchor(
    id: string,
    context: NodiaAiToolHandlerContext,
  ): Promise<NodiaAiToolCall> {
    const anchor = await context.manager
      .getRepository(NodiaAiToolCall)
      .findOne({
        where: {
          id,
          conversation_id: context.conversationId,
          run_id: context.runId,
          tool_name: NODIA_AI_INVOICE_ANALYSIS_TOOL,
        },
        lock: { mode: 'pessimistic_write' },
      });
    if (
      !anchor ||
      anchor.state !== 'completed' ||
      anchor.arguments.action !== 'prepare' ||
      anchor.public_result?.status !== 'prepared' ||
      anchor.public_result.analysis_id !== anchor.id ||
      !anchor.scope_manifest.invoice_analysis_snapshot ||
      anchor.scope_manifest.invoice_analysis_result_hash !==
        analysisHash(anchor.public_result)
    )
      invoiceAnalysisInvalid();
    const completion = anchor.scope_manifest.invoice_analysis_completion;
    if (completion !== undefined && completion !== context.toolCallId)
      invoiceAnalysisInvalid('request_conflict');
    return anchor;
  }
  async verifyResult(
    input: NodiaAiJsonObject,
    result: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
  ): Promise<void> {
    const snapshot = await this.execute(input, context);
    const privateSource = analysisObject(snapshot.source);
    const source: NodiaAiJsonObject = {
      attachment_id: privateSource.attachment_id,
      kind: privateSource.kind,
      media_type: privateSource.media_type,
      byte_count: privateSource.byte_count,
    };
    const expected: NodiaAiJsonObject = {
      status: input.action === 'prepare' ? 'prepared' : 'analyzed',
      analysis_id:
        input.action === 'prepare' ? context.toolCallId! : input.analysis_id,
      review_required: true,
      extraction_source: analysisObject(snapshot.selection).mode === 'api_key' ? 'active_api_generation' : 'active_agentic_generation',
      business_id: snapshot.business_id,
      provider_id: snapshot.provider_id,
      attachment_id: source.attachment_id,
      source,
      selection: snapshot.selection,
    };
    for (const key of Object.keys(expected))
      if (analysisHash(expected[key]) !== analysisHash(result[key]))
        invoiceAnalysisInvalid('invalid_tool_output');
    const repo = context.manager.getRepository(NodiaAiToolCall);
    const receipt = await repo.findOne({
      where: {
        id: context.toolCallId,
        run_id: context.runId,
        conversation_id: context.conversationId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !receipt ||
      receipt.tool_name !== NODIA_AI_INVOICE_ANALYSIS_TOOL ||
      !['validated', 'completed'].includes(receipt.state) ||
      analysisHash(receipt.arguments) !== analysisHash(input)
    )
      invoiceAnalysisInvalid();
    if (receipt.state === 'completed') {
      if (
        receipt.scope_manifest.invoice_analysis_result_hash !==
          analysisHash(result) ||
        analysisHash(receipt.public_result) !== analysisHash(result)
      )
        invoiceAnalysisInvalid('invalid_tool_output');
      if (
        input.action === 'prepare' &&
        analysisHash(receipt.scope_manifest.invoice_analysis_snapshot) !==
          analysisHash(snapshot)
      )
        invoiceAnalysisInvalid('request_conflict');
      return;
    }
    receipt.scope_manifest = {
      ...receipt.scope_manifest,
      invoice_analysis_result_hash: analysisHash(result),
    };
    if (input.action === 'prepare') {
      receipt.scope_manifest = {
        ...receipt.scope_manifest,
        invoice_analysis_snapshot: snapshot,
      };
      await repo.save(receipt);
    } else {
      const anchor = await this.anchor(String(input.analysis_id), context);
      anchor.scope_manifest = {
        ...anchor.scope_manifest,
        invoice_analysis_completion: context.toolCallId!,
      };
      await repo.save(anchor);
      await repo.save(receipt);
    }
  }
}
