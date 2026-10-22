import { Injectable } from '@nestjs/common';
import { envs } from '../config/envs.config.js';
import { NodiaAiAdapterError } from './types/nodia-ai-adapter.types.js';

@Injectable()
export class NodiaAiAdapterTransport {
  async request(
    path: string,
    payload: object,
    signal: AbortSignal,
    dispatch = false,
  ): Promise<unknown> {
    if (
      !/^[0-9a-fA-F]{64}$/.test(envs.GEMINI_SERVICE_TOKEN) ||
      !envs.GEMINI_MICROSERVICE_URL
    ) {
      throw new NodiaAiAdapterError('adapter_unconfigured', 'not_dispatched');
    }
    let response: Response;
    try {
      response = await fetch(new URL(path, envs.GEMINI_MICROSERVICE_URL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nodia-Service-Token': envs.GEMINI_SERVICE_TOKEN,
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch {
      throw new NodiaAiAdapterError(
        'adapter_transport_unavailable',
        dispatch ? 'unknown' : 'not_dispatched',
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new NodiaAiAdapterError(
        'adapter_invalid_response',
        dispatch ? 'unknown' : 'not_dispatched',
      );
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > 131072) throw new Error('Response limit');
        chunks.push(item.value);
      }
      const data: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
      );
      if (!response.ok) {
        const code =
          typeof data === 'object' &&
          data !== null &&
          'code' in data &&
          typeof data.code === 'string'
            ? data.code
            : 'adapter_rejected';
        const beforeDispatch = new Set([
          'mcp_adapter_unverified',
          'runtime_busy',
          'runtime_unconfigured',
          'runtime_generation_changed',
          'model_unavailable',
          'session_required',
          'agentic_unavailable',
          'thinking_level_unsupported',
          'adapter_admission_capacity',
          'invalid_request',
          'invalid_engine',
          'service_unauthorized',
          'body_too_large',
          'upload_timeout',
          'context_limit',
          'web_tools_prohibited',
        ]);
        throw new NodiaAiAdapterError(
          beforeDispatch.has(code) ? code : 'adapter_result_unknown',
          dispatch && !beforeDispatch.has(code) ? 'unknown' : 'not_dispatched',
        );
      }
      return data;
    } catch (error) {
      if (error instanceof NodiaAiAdapterError) throw error;
      throw new NodiaAiAdapterError(
        'adapter_invalid_response',
        dispatch ? 'unknown' : 'not_dispatched',
      );
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }
}
