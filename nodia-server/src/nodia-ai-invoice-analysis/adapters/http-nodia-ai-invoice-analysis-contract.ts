import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { envs } from '../../config/envs.config.js';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NodiaAiInvoiceAnalysisContract,
  NODIA_AI_INVOICE_ANALYSIS_CONTRACT_VERSION,
  type InvoiceAnalysisContractInput,
} from '../types/invoice-analysis-contract.types.js';

function unavailable(): never {
  throw new ServiceUnavailableException(
    'nodia_ai:invoice_analysis_contract_unavailable',
  );
}
@Injectable()
export class HttpNodiaAiInvoiceAnalysisContract extends NodiaAiInvoiceAnalysisContract {
  async prepare(input: InvoiceAnalysisContractInput) {
    const response = await this.request('prepare', input);
    if (
      Object.keys(response).sort().join(',') !==
        'contract_version,instructions' ||
      typeof response.instructions !== 'string' ||
      !response.instructions.trim() ||
      Buffer.byteLength(response.instructions, 'utf8') > 32768
    )
      unavailable();
    return { instructions: response.instructions };
  }
  async normalize(
    input: InvoiceAnalysisContractInput & { extraction: NodiaAiJsonObject },
  ) {
    const response = await this.request('normalize', input, input.extraction);
    if (
      Object.keys(response).sort().join(',') !==
        'contract_version,extraction' ||
      !response.extraction ||
      typeof response.extraction !== 'object' ||
      Array.isArray(response.extraction)
    )
      unavailable();
    return { extraction: response.extraction };
  }
  private async request(
    action: 'prepare' | 'normalize',
    input: InvoiceAnalysisContractInput,
    extraction?: NodiaAiJsonObject,
  ): Promise<NodiaAiJsonObject> {
    if (
      !envs.GEMINI_MICROSERVICE_URL ||
      !/^[0-9a-fA-F]{64}$/.test(envs.GEMINI_SERVICE_TOKEN)
    )
      unavailable();
    const remaining = Math.min(10000, input.deadlineAt - Date.now());
    if (remaining <= 0 || input.signal.aborted) unavailable();
    const signal = AbortSignal.any([
      input.signal,
      AbortSignal.timeout(remaining),
    ]);
    const body = JSON.stringify({
      action,
      provider_fields: input.providerFields,
      tax: input.tax,
      ...(extraction ? { extraction } : {}),
    });
    if (Buffer.byteLength(body, 'utf8') > 65536) unavailable();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(
        new URL(
          '/nodia-ai/invoice-analysis/contract',
          envs.GEMINI_MICROSERVICE_URL,
        ),
        {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Nodia-Service-Token': envs.GEMINI_SERVICE_TOKEN,
          },
          body,
        },
      );
      reader = response.body?.getReader();
      if (!response.ok || !reader) unavailable();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 131072) unavailable();
        chunks.push(part.value);
      }
      const value = parseNodiaAiStrictJson(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
      );
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        !('contract_version' in value) ||
        value.contract_version !== NODIA_AI_INVOICE_ANALYSIS_CONTRACT_VERSION
      )
        unavailable();
      return value as NodiaAiJsonObject;
    } catch {
      return unavailable();
    } finally {
      if (reader) {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }
  }
}
