import { Inject, Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import { ReserveNodiaAiRuntimeSlotUseCase } from '../../nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case.js';
import { ReleaseNodiaAiRuntimeSlotUseCase } from '../../nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case.js';
import { CleanupNodiaAiRuntimeProofsUseCase } from '../../nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  NodiaAiKnownPreDispatchError,
  NodiaAiLostLeaseError,
  type NodiaAiClaim,
  type NodiaAiStageContext,
  type NodiaAiStageOutcome,
} from '../../nodia-ai-runtime/types/worker.types.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { appendNodiaAiEvent } from '../../nodia-ai-run/event-journal.js';
import {
  bindObservationReservation,
  observationMatchesManifest,
} from '../../nodia-ai-context/use-case/nodia-ai-observation-identity.js';
import type {
  NodiaAiJsonObject,
  NodiaAiSelection,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import {
  NODIA_AI_INVOICE_OCR_TOOL,
  NodiaAiInvoiceOcrPort,
} from '../types/invoice-ocr-port.js';
import {
  invoiceOcrRequestResult,
  ocrHash,
  ocrObject,
} from '../types/invoice-ocr-state.js';
import { loadInvoiceOcrComparison } from '../compare-invoice-prices.js';
import { formatInvoiceOcrResult } from '../format-invoice-ocr-result.js';
import { SnapshotNodiaAiInvoiceOcrUseCase } from './snapshot-nodia-ai-invoice-ocr.use-case.js';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';

/** OCR owns its generation only after the planner's durable terminal acknowledgement. */
@Injectable()
export class ProcessNodiaAiInvoiceOcrStageUseCase {
  constructor(
    private readonly snapshots: SnapshotNodiaAiInvoiceOcrUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly adapter: NodiaAiAdapterPort,
    private readonly attachments: ManageNodiaAiAttachmentUseCase,
    private readonly reserve: ReserveNodiaAiRuntimeSlotUseCase,
    private readonly release: ReleaseNodiaAiRuntimeSlotUseCase,
    private readonly cleanup: CleanupNodiaAiRuntimeProofsUseCase,
    private readonly port: NodiaAiInvoiceOcrPort,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  loadReferences(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    conversationId: string,
    throughSeq: string,
  ) {
    return this.snapshots.loadReferences(
      manager,
      actor,
      conversationId,
      throughSeq,
    );
  }

  async pending(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
  ): Promise<NodiaAiJsonObject | null> {
    return context.checkpoint(async (manager) => {
      const rows = await manager.getRepository(NodiaAiToolCall).findBy({
        run_id: claim.run.id,
        conversation_id: claim.run.conversation_id,
        tool_name: NODIA_AI_INVOICE_OCR_TOOL,
        state: 'completed',
      });
      const requests = rows.filter(
        (r) =>
          r.public_result?.status === 'requested' &&
          ocrObject(r.scope_manifest.invoice_ocr_snapshot).source_attempt_id ===
            claim.attempt.id,
      );
      if (!requests.length) return null;
      if (requests.length !== 1)
        throw new Error('nodia_ai:invoice_ocr_request_conflict');
      return {
        schema_version: 1,
        analysis_id: requests[0].public_result!.analysis_id,
        request_id: requests[0].id,
        source_attempt_id: claim.attempt.id,
      };
    });
  }
  async execute(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
  ): Promise<NodiaAiStageOutcome> {
    const request = ocrObject(claim.run.context_manifest.invoice_ocr_request);
    if (
      request.schema_version !== 1 ||
      typeof request.analysis_id !== 'string' ||
      typeof request.request_id !== 'string' ||
      typeof request.source_attempt_id !== 'string'
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:invoice_ocr_invalid');
    const pending = await context.checkpoint(async (manager) => {
      const source = await manager
        .getRepository(NodiaAiJobAttempt)
        .findOneBy({ id: String(request.source_attempt_id) });
      if (
        !source ||
        source.job_id !== claim.job.id ||
        source.phase !== 'completed' ||
        !source.ended_at ||
        !['inference', 'delegated_inference'].includes(source.stage_key) ||
        !['agentic', 'api_key'].includes(
          String(source.selection_snapshot?.mode),
        )
      )
        throw new NodiaAiKnownPreDispatchError('nodia_ai:invoice_ocr_invalid');
      const rows: { id: string }[] = await manager.query(
        'SELECT id FROM nodia_ai_jobs WHERE dedup_key=$1',
        ['ack:' + source.id],
      );
      return { source, acknowledgementId: rows[0]?.id };
    });
    if (pending.acknowledgementId)
      await this.cleanup.execute(pending.acknowledgementId);
    const remaining = await context.checkpoint(
      (manager) =>
        manager.query('SELECT id FROM nodia_ai_jobs WHERE dedup_key=$1', [
          'ack:' + pending.source.id,
        ]) as Promise<{ id: string }[]>,
    );
    if (remaining.length)
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:invoice_ocr_ack_pending',
        true,
      );
    const loaded = await context.checkpoint((manager) =>
      this.load(manager, claim, String(request.request_id)),
    );
    if (
      loaded.snapshot.preparation_id !== request.analysis_id ||
      loaded.snapshot.source_attempt_id !== pending.source.id ||
      loaded.receipt.scope_manifest.invoice_ocr_result
    )
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:invoice_ocr_request_conflict',
      );
    const snapshot = loaded.snapshot,
      source = ocrObject(snapshot.source),
      selection = snapshot.selection as unknown as NodiaAiSelection;
    const observation = await this.adapter.observe(selection, context.signal);
    if (
      !observation.available ||
      !observation.resourceKey ||
      observation.resourceKey !== snapshot.resource_key ||
      observation.configurationGeneration !==
        snapshot.configuration_generation ||
      observation.sessionGeneration !== snapshot.session_generation ||
      !observationMatchesManifest(
        selection,
        observation,
        claim.run.context_manifest,
      )
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    this.port.assertSupported(selection, observation);
    const file = await this.attachments.content(
      claim.identity,
      String(source.attachment_id),
      context.signal,
    );
    if (
      file.buffer.byteLength !== source.byte_count ||
      file.media_type !== source.media_type ||
      createHash('sha256').update(file.buffer).digest('hex') !==
        source.content_hash
    )
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:invoice_ocr_source_changed',
      );
    const reservation = bindObservationReservation(
      selection,
      observation,
      await this.reserve.execute(
        claim,
        observation.resourceKey,
        claim.attempt.id,
      ),
      claim.attempt.id,
    );
    const revalidate = async (manager: EntityManager) => {
      const fresh = await this.load(manager, claim, loaded.receipt.id);
      if (
        ocrHash(fresh.snapshot) !== ocrHash(snapshot) ||
        fresh.receipt.scope_manifest.invoice_ocr_result
      )
        throw new NodiaAiKnownPreDispatchError(
          'nodia_ai:invoice_ocr_request_conflict',
        );
    };
    const deadlineAt = await context.armDispatch(
      selection,
      reservation,
      revalidate,
    );
    const assertLease = async (signal: AbortSignal) => {
      if (signal.aborted || context.signal.aborted)
        throw new NodiaAiLostLeaseError();
      await context.checkpoint(async (manager) => {
        await revalidate(manager);
        const rows: { resource_key: string }[] = await manager.query(
          "SELECT resource_key FROM nodia_ai_runtime_slots WHERE resource_key=$1 AND state='held' AND job_id=$2 AND holder_worker_id=$3 AND fence=$4 AND external_operation_ref=$5 AND lease_until>clock_timestamp() FOR SHARE",
          [
            reservation.resourceKey,
            claim.job.id,
            claim.attempt.worker_id,
            reservation.fence,
            reservation.operationRef,
          ],
        );
        if (rows.length !== 1) throw new NodiaAiLostLeaseError();
      });
      if (signal.aborted || context.signal.aborted)
        throw new NodiaAiLostLeaseError();
    };
    // Exactly one call after the durable dispatch reservation. Errors remain unknown; never replay here.
    const response = await this.port.execute({
      claim,
      input: {
        analysis_id: String(snapshot.preparation_id),
        business_id: String(snapshot.business_id),
        provider_id: snapshot.provider_id as string | null,
        attachment_id: String(source.attachment_id),
        compare_prices: snapshot.compare_prices === true,
      },
      sources: [
        {
          attachment_id: String(source.attachment_id),
          kind: source.kind as 'image' | 'pdf',
          media_type: String(source.media_type),
          byte_count: Number(source.byte_count),
          content_hash: String(source.content_hash),
          file_name: String(source.file_name),
          buffer: file.buffer,
        },
      ],
      commercial: {
        providerFields: snapshot.provider_fields as NodiaAiJsonObject | null,
        tax: snapshot.tax as number | null,
      },
      selection,
      observation,
      deadlineAt,
      signal: context.signal,
      assertLease,
    });
    const failed = (): NodiaAiStageOutcome => ({
      status: 'failed',
      errorCode: 'nodia_ai:invoice_ocr_invalid_result',
      terminalProof: response.terminalProof,
      persist: (manager) =>
        this.release.execute(
          claim,
          reservation,
          response.terminalProof,
          manager,
        ),
    });
    if (response.terminalProof.outcome !== 'completed')
      return { status: 'unknown', errorCode: 'nodia_ai:invoice_ocr_unknown' };
    let result: NodiaAiJsonObject, text: string;
    try {
      const extraction = response.extraction;
      if (
        extraction.business_id !== snapshot.business_id ||
        extraction.provider_id !== snapshot.provider_id
      )
        return failed();
      const canonical = {
        code: extraction.code,
        total_amount: extraction.total_amount,
        data: {
          issue_date: extraction.data.issue_date ?? null,
          items: extraction.data.items.map((item) => ({
            name: item.name,
            code: item.code ?? null,
            quantity: item.quantity ?? null,
            packages: item.packages ?? null,
            units_per_package: item.units_per_package ?? null,
            cost_price: item.cost_price ?? null,
            cost_price_tax: item.cost_price_tax ?? null,
            unit_price: item.unit_price ?? null,
            total_price: item.total_price ?? null,
          })),
        },
      };
      let comparisonObservedAt: string | null = null;
      const comparison =
        snapshot.compare_prices === true
          ? await context.checkpoint(async (manager) => {
              await revalidate(manager);
              const compared = await loadInvoiceOcrComparison(
                manager,
                String(snapshot.business_id),
                canonical.data.items,
                Math.min(100, this.policy.results.json_collection_items),
              );
              comparisonObservedAt = new Date().toISOString();
              return compared;
            })
          : null;
      result = {
        extraction: canonical as unknown as NodiaAiJsonObject,
        comparison: comparison as unknown as NodiaAiJsonObject[] | null,
        comparison_observed_at: comparisonObservedAt,
      };
      const publicResult = {
        ...invoiceOcrRequestResult(loaded.receipt.id, snapshot),
        status: 'analyzed',
        ...result,
      };
      const sourceJson = readFileSync(
        new URL('../contracts/invoice-ocr.json', import.meta.url),
        'utf8',
      );
      if (
        !compileNodiaAiToolSchema({
          sourceJson,
          definition: 'InvoiceOcrResult',
          sha256: createHash('sha256').update(sourceJson).digest('hex'),
        }).validate(publicResult) ||
        Buffer.byteLength(
          JSON.stringify({
            ...loaded.receipt.scope_manifest,
            invoice_ocr_result: result,
            invoice_ocr_result_hash: ocrHash(result),
            invoice_ocr_attempt_id: claim.attempt.id,
          }),
          'utf8',
        ) > Math.min(65536, this.policy.results.tool_result_utf8_bytes)
      )
        return failed();
      text = formatInvoiceOcrResult(publicResult);
      if (
        Buffer.byteLength(text, 'utf8') >
        this.policy.results.assistant_text_utf8_bytes
      )
        return failed();
    } catch {
      return failed();
    }
    return {
      status: 'completed',
      terminalProof: response.terminalProof,
      persist: async (manager) => {
        await revalidate(manager);
        const storage = await this.attachments.usageForAdmission(
          manager,
          claim.run.conversation_id,
          claim.identity.userId,
          new Date(),
          claim.run.id,
        );
        const bytes = BigInt(
          Buffer.byteLength(text, 'utf8') +
            Buffer.byteLength(JSON.stringify(result), 'utf8'),
        );
        if (
          BigInt(storage.chat_bytes) + bytes >
            BigInt(this.policy.admission.chat_storage_bytes) ||
          BigInt(storage.owner_bytes) + bytes >
            BigInt(this.policy.admission.owner_storage_bytes)
        )
          throw new Error('nodia_ai:storage_limit');
        await this.release.execute(
          claim,
          reservation,
          response.terminalProof,
          manager,
        );
        const receipt = await manager
          .getRepository(NodiaAiToolCall)
          .findOneByOrFail({ id: loaded.receipt.id });
        receipt.scope_manifest = {
          ...receipt.scope_manifest,
          invoice_ocr_result: result,
          invoice_ocr_result_hash: ocrHash(result),
          invoice_ocr_attempt_id: claim.attempt.id,
        };
        await manager.getRepository(NodiaAiToolCall).save(receipt);
        await this.seal(manager, claim, text);
      },
    };
  }
  private async load(manager: EntityManager, claim: NodiaAiClaim, id: string) {
    const actor = await this.authorize.execute(claim.identity, {}, manager);
    const context: NodiaAiToolHandlerContext = {
      manager,
      actor,
      moduleRoutes: actor.modules.map((m) => m.route),
      conversationId: claim.run.conversation_id,
      runId: claim.run.id,
      toolCallId: id,
    };
    const receipt = await this.snapshots.anchor(id, context);
    if (receipt.run_id !== claim.run.id)
      throw new NodiaAiKnownPreDispatchError('nodia_ai:invoice_ocr_invalid');
    return {
      receipt,
      snapshot: await this.snapshots.current(receipt, context),
    };
  }
  private async seal(
    manager: EntityManager,
    claim: NodiaAiClaim,
    text: string,
  ) {
    const messageId = randomUUID();
    const rows: { seq: string }[] = await manager.query(
      'WITH changed AS (UPDATE nodia_ai_conversations SET next_message_seq=next_message_seq+1,updated_at=clock_timestamp() WHERE id=$1 AND next_message_seq<9223372036854775807 RETURNING next_message_seq::text AS seq) SELECT seq FROM changed',
      [claim.run.conversation_id],
    );
    if (rows.length !== 1) throw new Error('nodia_ai:execution_limit');
    const scope = { schema_version: 1, module_routes: ['/business'] };
    await manager.query(
      "INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,status,source_scope_manifest,created_at,sealed_at) VALUES($1,$2,$3,'assistant',NULL,'sealed',$4::jsonb,clock_timestamp(),clock_timestamp())",
      [
        messageId,
        claim.run.conversation_id,
        rows[0].seq,
        JSON.stringify(scope),
      ],
    );
    await manager.query(
      "INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text) VALUES($1,$2,0,'text',$3)",
      [messageId, claim.run.conversation_id, text],
    );
    await manager.query(
      'UPDATE nodia_ai_runs SET assistant_message_id=$2 WHERE id=$1',
      [claim.run.id, messageId],
    );
    await appendNodiaAiEvent(manager, {
      conversationId: claim.run.conversation_id,
      runId: claim.run.id,
      eventKey: `message:${messageId}:sealed`,
      kind: 'message_sealed',
      payload: { message_id: messageId, status: 'sealed' },
      moduleRoutes: ['/business'],
      maxEvents: this.policy.results.outbox_events_per_activity,
      terminal: true,
    });
  }
}
