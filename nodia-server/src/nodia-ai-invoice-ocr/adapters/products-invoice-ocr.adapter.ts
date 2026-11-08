import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { parseGeminiInvoiceExtraction } from '../../common/ai/invoice-extraction.js';
import { invoiceAnalysisResponse } from '../../invoice/invoice-analysis-response.js';
import { MAX_INVOICE_FILE_BYTES, validateInvoiceFile } from '../../invoice/invoice-file-validation.js';
import { parseNativeTerminalProof } from '../../nodia-ai-adapter/native-terminal-proof.js';
import { NodiaAiAdapterTransport } from '../../nodia-ai-adapter/nodia-ai-adapter.service.js';
import { NodiaAiAdapterError, NodiaAiAdapterPort, type NodiaAiAdapterObservation } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';
import { NodiaAiInvoiceOcrPort, type NodiaAiInvoiceOcrExecution } from '../types/invoice-ocr-port.js';
import { ExecuteCodexInvoiceUseCase } from '../../ai-provider/use-case/execute-codex-invoice.use-case.js';
import { ApiInvoiceOcrExecutor } from './api-invoice-ocr-executor.js';

function fail(): never { throw new NodiaAiKnownPreDispatchError('nodia_ai:invoice_ocr_input_invalid'); }

/** Private transport to the Products OCR core, with the worker's exact native identity. */
@Injectable()
export class ProductsInvoiceOcrAdapter extends NodiaAiInvoiceOcrPort {
  constructor(
    private readonly transport: NodiaAiAdapterTransport,
    private readonly adapters: NodiaAiAdapterPort,
    @Optional() private readonly codex?: ExecuteCodexInvoiceUseCase,
    @Optional() private readonly api?: ApiInvoiceOcrExecutor,
  ) { super(); }

  assertSupported(selection: NodiaAiSelection, observation: NodiaAiAdapterObservation): void {
    if (selection.mode === 'api_key' && this.api && observation.source === 'api_configuration_and_catalog' &&
        observation.adapterIdentity.connectionId === selection.connection_id) return;
    if (selection.mode !== 'api_key' && observation.source === 'gemini_live_session_and_catalog' && !observation.adapterIdentity) return;
    if (selection.mode === 'agentic' && observation.source === 'codex_live_session_and_catalog' && this.codex &&
        observation.adapterIdentity?.providerKey === 'openai' && observation.adapterIdentity.connectionId === selection.connection_id) return;
    throw new NodiaAiKnownPreDispatchError('nodia_ai:invoice_ocr_mode_unavailable');
  }

  async execute(request: NodiaAiInvoiceOcrExecution) {
    const input: NodiaAiInvoiceOcrExecution = {
      ...request, input: structuredClone(request.input), selection: structuredClone(request.selection),
      observation: structuredClone(request.observation), commercial: structuredClone(request.commercial),
      sources: request.sources.map(source => ({ ...source, buffer: Buffer.from(source.buffer) })),
      deadlineAt: new Date(request.deadlineAt),
    };
    const attemptId = request.claim.attempt.id;
    input.signal.throwIfAborted();
    this.assertSupported(input.selection, input.observation);
    if (typeof input.input.provider_id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(input.input.provider_id) ||
        BigInt(input.input.provider_id) > 9223372036854775807n)
      throw new NodiaAiKnownPreDispatchError('nodia_ai:invoice_ocr_supplier_required');
    const engine = 'agentic';
    const source = input.sources.length === 1 ? input.sources[0] : undefined;
    if (!source || source.attachment_id !== input.input.attachment_id ||
        !['image', 'pdf'].includes(source.kind) || source.buffer.length !== source.byte_count ||
        source.byte_count < 1 || source.byte_count > MAX_INVOICE_FILE_BYTES ||
        createHash('sha256').update(source.buffer).digest('hex') !== source.content_hash ||
        (source.kind === 'pdf') !== (source.media_type === 'application/pdf')) fail();
    validateInvoiceFile({ buffer: source.buffer, mimetype: source.media_type } as Express.Multer.File);
    const observation = input.observation;
    if (!observation.resourceKey || !observation.sessionGeneration ||
        !/^[a-f0-9]{64}$/.test(observation.configurationGeneration) ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(attemptId) ||
        typeof input.selection.model_id !== 'string' || !input.selection.model_id.trim() || input.selection.model_id.length > 128) fail();
    const model = input.selection.model_id;
    await this.adapters.verifyConfiguration(input.selection, observation.configurationGeneration);
    const seconds = Math.min(120, Math.floor((input.deadlineAt.getTime() - Date.now()) / 1000));
    if (seconds < 1)
      throw new NodiaAiKnownPreDispatchError('nodia_ai:deadline_exceeded');
    const signal = AbortSignal.any([input.signal, AbortSignal.timeout(seconds * 1000 + 5000)]);
    await input.assertLease(signal);
    if (input.selection.mode === 'api_key' && this.api) return this.api.execute(input, source);
    if (observation.source === 'codex_live_session_and_catalog' && this.codex) {
      const result = await this.codex.executeNative({
        identity: { engine: 'agentic', attemptId, resourceKey: observation.resourceKey,
          sessionGeneration: observation.sessionGeneration, operationRef: attemptId,
          adapterIdentity: observation.adapterIdentity },
        modelId: model, effortId: input.selection.effort_id, configurationGeneration: observation.configurationGeneration,
        file: { buffer: source.buffer, mimetype: source.media_type, originalname: source.file_name, size: source.byte_count } as Express.Multer.File,
        fields: input.commercial.providerFields ?? undefined, tax: input.commercial.tax,
        deadlineAt: input.deadlineAt, signal, assertLease: input.assertLease,
      });
      await this.verifyAfterDispatch(input.selection, observation.configurationGeneration);
      return { extraction: invoiceAnalysisResponse(input.input.business_id, input.input.provider_id, result.extraction),
        terminalProof: result.terminalProof };
    }
    const value = await this.transport.request(`/nodia-ai/${engine}/invoice/turn`, {
      attempt_id: attemptId,
      resource_key: observation.resourceKey,
      session_generation: observation.sessionGeneration,
      configuration_generation: observation.configurationGeneration,
      model_id: model,
      effort_id: input.selection.effort_id,
      timeout_seconds: seconds,
      provider_fields: input.commercial.providerFields,
      tax: input.commercial.tax,
      attachment: {
        kind: source.kind, media_type: source.media_type, sha256: source.content_hash,
        content_base64: source.buffer.toString('base64'),
      },
    }, signal, true);
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== 2 || !('extraction' in value) || !('native' in value) ||
        Buffer.byteLength(JSON.stringify(value), 'utf8') > 65536)
      throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown');
    const terminalProof = parseNativeTerminalProof(value.native, {
      engine, attemptId, resourceKey: observation.resourceKey,
      sessionGeneration: observation.sessionGeneration, operationRef: attemptId,
    });
    if (terminalProof.outcome !== 'completed')
      throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown');
    let extraction: ReturnType<typeof parseGeminiInvoiceExtraction>;
    try { extraction = parseGeminiInvoiceExtraction(value.extraction); }
    catch { throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown'); }
    if (extraction.items.length > 100)
      throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown');
    await this.verifyAfterDispatch(input.selection, observation.configurationGeneration);
    return {
      extraction: invoiceAnalysisResponse(input.input.business_id, input.input.provider_id, extraction),
      terminalProof,
    };
  }

  private async verifyAfterDispatch(selection: NodiaAiSelection, generation: string): Promise<void> {
    try { await this.adapters.verifyConfiguration(selection, generation); }
    catch { throw new NodiaAiAdapterError('adapter_configuration_changed', 'unknown'); }
  }
}
