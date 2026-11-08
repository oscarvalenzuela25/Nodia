import { Injectable, Inject } from '@nestjs/common';
import { Business } from '../../business/entities/business.entity.js';
import { BusinessCollaborator } from '../../business/entities/business-collaborator.entity.js';
import { Provider } from '../../provider/entities/provider.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { NodiaAiMessage } from '../../nodia-ai-conversation/entities/nodia-ai-message.entity.js';
import { NodiaAiMessagePart } from '../../nodia-ai-conversation/entities/nodia-ai-message-part.entity.js';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';
import { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NODIA_AI_INVOICE_OCR_TOOL } from '../types/invoice-ocr-port.js';
import {
  invoiceOcrProviderFields,
  invoiceOcrRequestResult,
  ocrHash,
  ocrInvalid,
  ocrObject,
} from '../types/invoice-ocr-state.js';
import {
  loadInvoiceOcrComparison,
  type InvoiceOcrComparableItem,
} from '../compare-invoice-prices.js';
import type { EntityManager } from 'typeorm';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { isNodiaAiScopeVisible } from '../../nodia-ai-context/use-case/build-nodia-ai-context.use-case.js';
import type {
  NodiaAiInvoiceOcrReference,
  NodiaAiInvoiceOcrReferences,
} from '../types/invoice-ocr-references.js';

/** SQL authority and immutable source/commercial selection. No storage/provider I/O. */
@Injectable()
export class SnapshotNodiaAiInvoiceOcrUseCase {
  constructor(
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly adapter: NodiaAiAdapterPort,
  ) {}

  async capture(
    input: NodiaAiJsonObject,
    context: NodiaAiToolHandlerContext,
    settled = false,
    verifyConfiguration = true,
  ): Promise<NodiaAiJsonObject> {
    if (
      !context.manager.queryRunner?.isTransactionActive ||
      !context.actor.modules.some((m) => m.route === '/business') ||
      !context.runId ||
      !context.conversationId ||
      !context.attemptId
    )
      ocrInvalid();
    const manager = context.manager;
    let preparation: NodiaAiToolCall | null = null,
      original: NodiaAiJsonObject | null = null;
    if (input.action === 'request') {
      preparation = await this.preparation(
        String(input.analysis_id),
        context,
        true,
      );
      original = ocrObject(preparation.scope_manifest.invoice_ocr_snapshot);
      const consumed = preparation.scope_manifest.invoice_ocr_consumed_by;
      if (
        typeof input.provider_id !== 'string' ||
        (consumed && consumed !== context.toolCallId)
      )
        ocrInvalid('invoice_ocr_already_requested');
      input = {
        ...input,
        business_id: original.business_id,
        attachment_id: ocrObject(original.source).attachment_id,
        compare_prices: original.compare_prices,
      };
    } else if (input.action !== 'prepare') ocrInvalid('invalid_tool_input');
    if (input.action === 'request' && !settled) {
      const existing: { id: string }[] = await manager.query(
        "SELECT id FROM nodia_ai_tool_calls WHERE run_id=$1 AND conversation_id=$2 AND tool_name=$3 AND state='completed' AND public_result->>'status'='requested' AND id<>$4 LIMIT 1",
        [
          context.runId,
          context.conversationId,
          NODIA_AI_INVOICE_OCR_TOOL,
          context.toolCallId,
        ],
      );
      if (existing.length) ocrInvalid('invoice_ocr_request_conflict');
    }
    if (
      input.provider_id !== undefined &&
      (typeof input.provider_id !== 'string' ||
        !/^[1-9][0-9]{0,18}$/.test(input.provider_id) ||
        BigInt(input.provider_id) > 9223372036854775807n)
    )
      ocrInvalid();
    const run = await manager
      .getRepository(NodiaAiRun)
      .findOneBy({ id: context.runId });
    const attempt = await manager
      .getRepository(NodiaAiJobAttempt)
      .findOneBy({ id: context.attemptId });
    const chat = await manager
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
      !chat ||
      run.conversation_id !== chat.id ||
      job.run_id !== run.id ||
      job.conversation_id !== chat.id ||
      (run.actor_id !== context.actor.actorId &&
        !(settled && context.actor.isSuperAdmin)) ||
      !['inference', 'delegated_inference'].includes(attempt.stage_key) ||
      !attempt.selection_snapshot ||
      (!settled &&
        (attempt.phase !== 'dispatch_armed' ||
          attempt.ended_at !== null ||
          run.state !== 'running' ||
          run.deadline_at.getTime() <= Date.now())) ||
      chat.lifecycle !== 'active' ||
      chat.expires_at.getTime() <= Date.now() ||
      chat.retention_epoch !== run.retention_epoch
    )
      ocrInvalid();
    const selection = attempt.selection_snapshot;
    const delegated = attempt.stage_key === 'delegated_inference';
    const configuration = delegated
      ? run.routing_snapshot.target?.configuration_generation
      : run.context_manifest.configuration_generation;
    const session = delegated
      ? run.routing_snapshot.target?.session_generation
      : run.context_manifest.session_generation;
    const expected = delegated
      ? run.routing_snapshot.target?.selection
      : run.selection_snapshot;
    if (
      !['agentic', 'api_key'].includes(selection.mode) ||
      !selection.model_id ||
      ocrHash(selection) !== ocrHash(expected) ||
      typeof configuration !== 'string' ||
      typeof session !== 'string' ||
      !attempt.runtime_resource_key
    )
      ocrInvalid();
    if (verifyConfiguration)
      await this.adapter.verifyConfiguration(selection, configuration, manager);
    const sourceMessageId = original
      ? String(original.source_user_message_id)
      : run.user_message_id;
    const message = await manager
      .getRepository(NodiaAiMessage)
      .findOneBy({ id: sourceMessageId, conversation_id: chat.id });
    const part = await manager.getRepository(NodiaAiMessagePart).findOneBy({
      message_id: sourceMessageId,
      conversation_id: chat.id,
      attachment_id: String(input.attachment_id),
    });
    const attachment = await manager.getRepository(NodiaAiAttachment).findOne({
      where: { id: String(input.attachment_id), conversation_id: chat.id },
      lock: { mode: 'pessimistic_read' },
    });
    // Ready originals follow chat retention; attachment.expires_at only bounds the upload intent.
    if (
      !message ||
      message.role !== 'user' ||
      message.author_id !== run.actor_id ||
      message.status !== 'sealed' ||
      !isNodiaAiScopeVisible(
        message.source_scope_manifest,
        new Set(context.moduleRoutes),
      ) ||
      (original
        ? BigInt(message.seq) > BigInt(run.input_through_seq)
        : message.seq !== run.input_through_seq) ||
      !part ||
      part.text !== null ||
      !attachment ||
      attachment.state !== 'ready' ||
      attachment.retention_epoch !== run.retention_epoch ||
      part.kind !== attachment.kind ||
      !['image', 'pdf'].includes(attachment.kind) ||
      !attachment.content_hash ||
      !/^[a-f0-9]{64}$/.test(attachment.content_hash) ||
      !attachment.byte_count ||
      !/^[1-9][0-9]*$/.test(attachment.byte_count) ||
      !attachment.media_type ||
      !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
        attachment.media_type,
      )
    )
      ocrInvalid();
    const bytes = Number(attachment.byte_count);
    if (
      !Number.isSafeInteger(bytes) ||
      bytes > Math.min(10 * 1024 * 1024, this.policy.admission.file_bytes) ||
      (attachment.kind === 'pdf'
        ? attachment.media_type !== 'application/pdf' ||
          !Number.isInteger(attachment.page_count) ||
          attachment.page_count! < 1 ||
          attachment.page_count! >
            Math.min(100, this.policy.admission.pdf_pages)
        : attachment.media_type === 'application/pdf' ||
          attachment.page_count !== null)
    )
      ocrInvalid();
    if (
      original &&
      (ocrHash(original.source) !==
        ocrHash({
          attachment_id: attachment.id,
          generation: attachment.generation,
          kind: attachment.kind,
          media_type: attachment.media_type,
          byte_count: bytes,
          content_hash: attachment.content_hash,
          file_name: attachment.file_name,
          retention_epoch: attachment.retention_epoch,
        }) ||
        original.conversation_id !== chat.id ||
        original.retention_epoch !== run.retention_epoch)
    )
      ocrInvalid('request_conflict');
    const business = await manager.getRepository(Business).findOne({
      where: { id: String(input.business_id) },
      lock: { mode: 'pessimistic_read' },
    });
    if (!business) ocrInvalid();
    if (
      !context.actor.isSuperAdmin &&
      business.owner_id !== context.actor.actorId
    ) {
      const member = await manager.getRepository(BusinessCollaborator).findOne({
        where: {
          business_id: business.id,
          user_id: context.actor.actorId,
          is_active: true,
        },
        lock: { mode: 'pessimistic_read' },
      });
      if (!member) ocrInvalid('business_scope_not_allowed');
    }
    const providerId =
      typeof input.provider_id === 'string' ? input.provider_id : null;
    const provider = providerId
      ? await manager.getRepository(Provider).findOne({
          where: { id: providerId, business_id: business.id },
          lock: { mode: 'pessimistic_read' },
        })
      : null;
    if (
      (providerId && !provider) ||
      (provider &&
        (!Number.isInteger(provider.tax) ||
          provider.tax < 0 ||
          provider.tax > 100))
    )
      ocrInvalid();
    return {
      schema_version: 1,
      preparation_id: preparation?.id ?? null,
      source_user_message_id: sourceMessageId,
      run_id: run.id,
      conversation_id: chat.id,
      actor_id: run.actor_id,
      source_attempt_id: attempt.id,
      user_message_id: run.user_message_id,
      input_through_seq: run.input_through_seq,
      retention_epoch: run.retention_epoch,
      business_id: business.id,
      provider_id: providerId,
      provider_fields: provider
        ? invoiceOcrProviderFields(provider.fields)
        : null,
      tax: provider ? provider.tax : null,
      compare_prices: input.compare_prices === true,
      selection: { ...selection },
      configuration_generation: configuration,
      session_generation: session,
      resource_key: attempt.runtime_resource_key,
      source: {
        attachment_id: attachment.id,
        generation: attachment.generation,
        kind: attachment.kind,
        media_type: attachment.media_type,
        byte_count: bytes,
        content_hash: attachment.content_hash,
        file_name: attachment.file_name,
        retention_epoch: attachment.retention_epoch,
      },
    };
  }
  async anchor(id: string, context: NodiaAiToolHandlerContext) {
    const receipt = await context.manager
      .getRepository(NodiaAiToolCall)
      .findOneBy({
        id,
        conversation_id: context.conversationId,
        tool_name: NODIA_AI_INVOICE_OCR_TOOL,
      });
    if (
      !receipt ||
      receipt.state !== 'completed' ||
      receipt.public_result?.status !== 'requested' ||
      receipt.public_result.request_id !== receipt.id ||
      !receipt.scope_manifest.invoice_ocr_snapshot ||
      ocrHash(receipt.public_result) !==
        receipt.scope_manifest.invoice_ocr_request_hash
    )
      ocrInvalid();
    return receipt;
  }
  async current(
    receipt: NodiaAiToolCall,
    context: NodiaAiToolHandlerContext,
    fresh = true,
  ) {
    const snapshot = ocrObject(receipt.scope_manifest.invoice_ocr_snapshot);
    const current = await this.capture(
      receipt.arguments,
      {
        ...context,
        runId: receipt.run_id,
        attemptId: String(snapshot.source_attempt_id),
        toolCallId: receipt.id,
      },
      true,
      fresh,
    );
    if (
      fresh
        ? ocrHash(current) !== ocrHash(snapshot)
        : ocrHash(current.source) !== ocrHash(snapshot.source)
    )
      ocrInvalid('request_conflict');
    return snapshot;
  }
  async preparation(
    id: string,
    context: NodiaAiToolHandlerContext,
    lock = false,
  ) {
    const receipt = await context.manager
      .getRepository(NodiaAiToolCall)
      .findOne({
        where: {
          id,
          conversation_id: context.conversationId,
          tool_name: NODIA_AI_INVOICE_OCR_TOOL,
        },
        ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
    if (
      !receipt ||
      receipt.state !== 'completed' ||
      receipt.public_result?.status !== 'awaiting_supplier' ||
      receipt.public_result.analysis_id !== receipt.id ||
      receipt.scope_manifest.invoice_ocr_request_hash !==
        ocrHash(receipt.public_result)
    )
      ocrInvalid();
    return receipt;
  }
  async read(
    id: string,
    context: NodiaAiToolHandlerContext,
    comparePrices = false,
  ): Promise<NodiaAiJsonObject> {
    const prep = await this.preparation(id, context);
    const snapshot = await this.current(prep, context, false);
    const consumed = prep.scope_manifest.invoice_ocr_consumed_by;
    if (!consumed) return invoiceOcrRequestResult(id, snapshot);
    if (typeof consumed !== 'string') ocrInvalid();
    const receipt = await this.anchor(consumed, context),
      requestSnapshot = await this.current(receipt, context, false);
    if (requestSnapshot.preparation_id !== id) ocrInvalid();
    const completed = receipt.scope_manifest.invoice_ocr_result;
    if (!completed) return invoiceOcrRequestResult(receipt.id, requestSnapshot);
    if (ocrHash(completed) !== receipt.scope_manifest.invoice_ocr_result_hash)
      ocrInvalid('invalid_persisted_state');
    const result = ocrObject(completed);
    const comparison = comparePrices
      ? await loadInvoiceOcrComparison(
          context.manager,
          String(requestSnapshot.business_id),
          ocrObject(ocrObject(result.extraction).data)
            .items as unknown as InvoiceOcrComparableItem[],
          Math.min(100, this.policy.results.json_collection_items),
        )
      : result.comparison;
    return {
      ...invoiceOcrRequestResult(receipt.id, requestSnapshot),
      status: 'analyzed',
      ...result,
      ...(comparePrices
        ? {
            compare_prices: true,
            comparison: comparison as unknown as NodiaAiJsonObject[],
            comparison_observed_at: new Date().toISOString(),
          }
        : {}),
    };
  }

  /** One bounded SQL read; no extraction, native observation, storage I/O or per-row lookup. */
  async loadReferences(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    conversationId: string,
    throughSeq: string,
  ): Promise<NodiaAiInvoiceOcrReferences> {
    if (!manager.queryRunner?.isTransactionActive)
      ocrInvalid('transaction_required');
    if (
      !/^[1-9][0-9]{0,18}$/.test(throughSeq) ||
      BigInt(throughSeq) > 9223372036854775807n
    )
      ocrInvalid('context_invalid');
    if (!actor.modules.some((m) => m.route === '/business'))
      return { schema_version: 1, references: [], more: false };
    const limit = Math.min(
      50,
      this.policy.results.list_default_rows,
      this.policy.results.json_collection_items,
    );
    type Row = NodiaAiInvoiceOcrReference & {
      preparation_result: NodiaAiJsonObject;
      preparation_hash: string;
      request_result: NodiaAiJsonObject | null;
      request_hash: string | null;
    };
    const rows: Row[] = await manager.query(
      `
      SELECT p.id::text AS analysis_id,b.id::text AS business_id,a.id::text AS attachment_id,
        m.seq::text AS source_message_seq,v.id::text AS provider_id,
        CASE WHEN q.id IS NULL THEN 'awaiting_supplier'
          WHEN qr.state IN ('unknown','failed','cancelled') THEN qr.state
          WHEN jsonb_typeof(q.scope_manifest->'invoice_ocr_result')='object'
            AND q.scope_manifest->>'invoice_ocr_result_hash' ~ '^[a-f0-9]{64}$' THEN 'stored_result'
          ELSE 'requested' END AS state_hint,
        p.public_result AS preparation_result,p.scope_manifest->>'invoice_ocr_request_hash' AS preparation_hash,
        q.public_result AS request_result,q.scope_manifest->>'invoice_ocr_request_hash' AS request_hash
      FROM nodia_ai_tool_calls p
      JOIN nodia_ai_runs r ON r.id=p.run_id AND r.actor_id=$2
      JOIN nodia_ai_conversations c ON c.id=p.conversation_id AND c.id=r.conversation_id
        AND c.owner_id=$2 AND c.lifecycle='active' AND c.expires_at>statement_timestamp()
        AND c.retention_epoch=r.retention_epoch
      JOIN businesses b ON b.id::text=p.scope_manifest->'invoice_ocr_snapshot'->>'business_id'
      JOIN nodia_ai_messages m ON m.id=r.user_message_id AND m.conversation_id=c.id
        AND m.author_id=$2 AND m.role='user' AND m.status='sealed' AND m.seq=r.input_through_seq
      JOIN nodia_ai_attachments a ON a.conversation_id=c.id
        AND a.id::text=p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'attachment_id'
        AND a.state='ready' AND a.retention_epoch=c.retention_epoch
        AND a.kind IN ('image','pdf') AND a.byte_count BETWEEN 1 AND $5
        AND a.media_type IN ('application/pdf','image/png','image/jpeg','image/webp')
        AND ((a.kind='pdf' AND a.media_type='application/pdf' AND a.page_count BETWEEN 1 AND $6)
          OR (a.kind='image' AND a.media_type<>'application/pdf' AND a.page_count IS NULL))
      LEFT JOIN nodia_ai_tool_calls q ON q.id::text=p.scope_manifest->>'invoice_ocr_consumed_by'
        AND q.conversation_id=c.id AND q.tool_name=$4 AND q.state='completed'
        AND q.arguments->>'action'='request' AND q.arguments->>'analysis_id'=p.id::text
        AND q.public_result->>'status'='requested' AND q.public_result->>'analysis_id'=p.id::text
        AND q.public_result->>'request_id'=q.id::text
        AND q.scope_manifest->'invoice_ocr_snapshot'->>'preparation_id'=p.id::text
        AND q.scope_manifest->'invoice_ocr_snapshot'->>'business_id'=b.id::text
        AND q.scope_manifest->'invoice_ocr_snapshot'->'source'=p.scope_manifest->'invoice_ocr_snapshot'->'source'
      LEFT JOIN nodia_ai_runs qr ON qr.id=q.run_id AND qr.conversation_id=c.id
        AND qr.actor_id=$2 AND qr.retention_epoch=c.retention_epoch
      LEFT JOIN providers v ON v.id::text=q.scope_manifest->'invoice_ocr_snapshot'->>'provider_id' AND v.business_id=b.id
      WHERE p.conversation_id=$1 AND p.tool_name=$4 AND p.state='completed'
        AND p.arguments->>'action'='prepare' AND p.public_result->>'status'='awaiting_supplier'
        AND p.public_result->>'analysis_id'=p.id::text
        AND p.public_result->>'business_id'=b.id::text AND p.public_result->>'attachment_id'=a.id::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->>'schema_version'='1'
        AND p.scope_manifest->'invoice_ocr_snapshot'->>'run_id'=r.id::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->>'conversation_id'=c.id::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->>'actor_id'=$2::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->>'retention_epoch'=c.retention_epoch::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->>'source_user_message_id'=m.id::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'generation'=a.generation::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'content_hash'=a.content_hash
        AND p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'kind'=a.kind
        AND p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'media_type'=a.media_type
        AND p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'byte_count'=a.byte_count::text
        AND p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'file_name'=a.file_name
        AND p.scope_manifest->'invoice_ocr_snapshot'->'source'->>'retention_epoch'=c.retention_epoch::text
        AND (p.scope_manifest->>'invoice_ocr_consumed_by' IS NULL OR (q.id IS NOT NULL AND qr.id IS NOT NULL AND v.id IS NOT NULL))
        AND ($3 OR b.owner_id=$2 OR EXISTS(SELECT 1 FROM business_collaborators bc
          WHERE bc.business_id=b.id AND bc.user_id=$2 AND bc.is_active=true))
        AND m.source_scope_manifest ?& ARRAY['schema_version','module_routes']
        AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(m.source_scope_manifest) AS keys(scope_key)
          WHERE scope_key NOT IN ('schema_version','module_routes'))
        AND m.source_scope_manifest->'schema_version'='1'::jsonb
        AND jsonb_typeof(m.source_scope_manifest->'module_routes')='array'
        AND jsonb_array_length(m.source_scope_manifest->'module_routes')<=64
        AND m.source_scope_manifest->'module_routes' <@ $7::jsonb
        AND EXISTS(SELECT 1 FROM nodia_ai_message_parts mp WHERE mp.message_id=m.id AND mp.conversation_id=c.id
          AND mp.attachment_id=a.id AND mp.kind=a.kind AND mp.text IS NULL)
        AND m.seq<=$9::bigint AND (q.id IS NULL OR qr.input_through_seq<=$9::bigint)
      ORDER BY p.created_at DESC,p.id DESC LIMIT $8`,
      [
        conversationId,
        actor.actorId,
        actor.isSuperAdmin,
        NODIA_AI_INVOICE_OCR_TOOL,
        Math.min(10 * 1024 * 1024, this.policy.admission.file_bytes),
        Math.min(100, this.policy.admission.pdf_pages),
        JSON.stringify(actor.modules.map((m) => m.route)),
        limit + 1,
        throughSeq,
      ],
    );
    if (!Array.isArray(rows) || rows.length > limit + 1)
      ocrInvalid('invalid_persisted_state');
    const references = rows.slice(0, limit).map((row) => {
      if (
        !row ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.analysis_id) ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.business_id) ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
          row.attachment_id,
        ) ||
        !/^[1-9][0-9]*$/.test(row.source_message_seq) ||
        (row.provider_id !== null &&
          !/^[1-9][0-9]{0,18}$/.test(row.provider_id)) ||
        ![
          'awaiting_supplier',
          'requested',
          'stored_result',
          'unknown',
          'failed',
          'cancelled',
        ].includes(row.state_hint) ||
        ocrHash(row.preparation_result) !== row.preparation_hash ||
        (row.request_result !== null &&
          ocrHash(row.request_result) !== row.request_hash)
      )
        ocrInvalid('invalid_persisted_state');
      return {
        analysis_id: row.analysis_id,
        business_id: row.business_id,
        attachment_id: row.attachment_id,
        source_message_seq: row.source_message_seq,
        provider_id: row.provider_id,
        state_hint: row.state_hint,
      };
    });
    const result: NodiaAiInvoiceOcrReferences = {
      schema_version: 1,
      references,
      more: rows.length > limit,
    };
    if (
      Buffer.byteLength(JSON.stringify(result), 'utf8') >
      Math.min(16384, this.policy.results.tool_result_utf8_bytes)
    )
      ocrInvalid('context_limit');
    return result;
  }
}
