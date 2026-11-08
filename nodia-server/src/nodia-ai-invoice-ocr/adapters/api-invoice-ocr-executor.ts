import { Injectable } from '@nestjs/common';
import { ApiProviderService, type ApiThinkingLevel } from '../../common/ai/api-provider.service.js';
import { invoicePrompt } from '../../common/ai/api-invoice-contract.js';
import { ApiNodiaAiCredentialsService } from '../../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import { ApiNodiaAiRuntimeService } from '../../nodia-ai-adapter/api-nodia-ai-runtime.service.js';
import { NodiaAiAdapterError, type NodiaAiAdapterRequest } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { invoiceAnalysisResponse } from '../../invoice/invoice-analysis-response.js';
import type { NodiaAiInvoiceOcrExecution, NodiaAiInvoiceOcrSource } from '../types/invoice-ocr-port.js';

/** Same strict API OCR core as Products; chat adds its existing authority, fence and durable receipt. */
@Injectable()
export class ApiInvoiceOcrExecutor {
  constructor(
    private readonly credentials: ApiNodiaAiCredentialsService,
    private readonly runtime: ApiNodiaAiRuntimeService,
    private readonly api: ApiProviderService,
  ) {}

  async execute(input: NodiaAiInvoiceOcrExecution, source: NodiaAiInvoiceOcrSource) {
    const configuration = await this.credentials.configuration(input.selection);
    const observation = input.observation;
    if (configuration.configurationGeneration !== observation.configurationGeneration ||
        configuration.sessionGeneration !== observation.sessionGeneration ||
        configuration.resourceKey !== observation.resourceKey)
      throw new NodiaAiAdapterError('adapter_configuration_changed', 'not_dispatched');
    // No credential rotation or fallback: this run owns one exact selected key and model.
    const secret = await this.credentials.secret(input.selection, configuration);
    const fields = input.commercial.providerFields ? { ...input.commercial.providerFields } : undefined;
    const request: NodiaAiAdapterRequest = {
      attemptId: input.claim.attempt.id, selection: { ...input.selection },
      canonicalPrompt: invoicePrompt(fields, input.commercial.tax),
      deadlineAt: input.deadlineAt, resourceKey: configuration.resourceKey,
      configurationGeneration: configuration.configurationGeneration,
      sessionGeneration: configuration.sessionGeneration,
      attachments: [{ kind: source.kind, media_type: source.media_type,
        sha256: source.content_hash, content_base64: source.buffer.toString('base64') }],
    };
    const controller = new AbortController();
    const signal = AbortSignal.any([input.signal, controller.signal,
      AbortSignal.timeout(Math.max(1, input.deadlineAt.getTime() - Date.now()))]);
    await input.assertLease(signal);
    await this.runtime.start(request);
    let closed = false;
    try {
      signal.throwIfAborted();
      await input.assertLease(signal);
      await this.runtime.reserveExchange(request);
      const extraction = await this.api.extractInvoice(configuration.providerKey, secret,
        input.selection.model_id, source.buffer, source.media_type, fields,
        input.commercial.tax, signal, (input.selection.effort_id ?? undefined) as ApiThinkingLevel | undefined);
      // extractInvoice has awaited/cancelled its reader. No callbacks remain at this point.
      closed = true;
      const terminalProof = await this.runtime.finish(request, 'completed');
      if (extraction.items.length > 100)
        throw new NodiaAiAdapterError('adapter_invalid_reply', 'unknown');
      await input.assertLease(signal);
      const current = await this.credentials.configuration(input.selection);
      if (current.configurationGeneration !== configuration.configurationGeneration)
        throw new NodiaAiAdapterError('adapter_configuration_changed', 'unknown');
      return {
        extraction: invoiceAnalysisResponse(input.input.business_id, input.input.provider_id, extraction),
        terminalProof,
      };
    } catch (error: unknown) {
      controller.abort();
      if (!closed) await this.runtime.finish(request, 'unknown');
      if (error instanceof NodiaAiAdapterError) throw error;
      throw new NodiaAiAdapterError('api_invoice_ocr_failed', 'unknown');
    } finally { controller.abort(); }
  }
}
