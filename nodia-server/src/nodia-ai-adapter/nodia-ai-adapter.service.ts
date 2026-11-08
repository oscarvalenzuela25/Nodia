import { Injectable } from '@nestjs/common';
import { nativeDispatchRejection } from '../nodia-ai-runtime/types/native-dispatch-rejection.js';
import { envs } from '../config/envs.config.js';
import { NodiaAiAdapterError } from './types/nodia-ai-adapter.types.js';

@Injectable()
export class NodiaAiAdapterTransport {
  async request(
    path: string,
    payload: object,
    signal: AbortSignal,
    dispatch = false,
    onRejected?: (body: unknown, status: number) => void,
  ): Promise<unknown> {
    if (
      !/^[0-9a-fA-F]{64}$/.test(envs.GEMINI_SERVICE_TOKEN) ||
      !envs.GEMINI_MICROSERVICE_URL
    ) {
      throw new NodiaAiAdapterError('adapter_unconfigured', 'not_dispatched');
    }
    const requestBytes = JSON.stringify(payload);
    let response: Response;
    try {
      response = await fetch(new URL(path, envs.GEMINI_MICROSERVICE_URL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nodia-Service-Token': envs.GEMINI_SERVICE_TOKEN,
        },
        body: requestBytes,
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
    const maximumResponseBytes = dispatch && response.ok && path === '/nodia-ai/agentic/image/turn'
      ? Math.ceil(16777216 / 3) * 4 + 65536
      : /^\/teacher\/agentic-text\/(start|status|reconcile)$/.test(path) ? 262144 : 131072;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > maximumResponseBytes) throw new Error('Response limit');
        chunks.push(item.value);
      }
      const data: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
      );
      if (!response.ok) {
        // Private consumers may validate their own bound exclusion proof. Never log
        // or attach the response body to the shared public error contract.
        onRejected?.(data, response.status);
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
        const rejectionProof = dispatch ? nativeDispatchRejection({
          route: path, payload, requestBytes, responseBytes: Buffer.concat(chunks),
          body: data, status: response.status, requestIdHeader: response.headers.get('x-request-id'),
          contentType: response.headers.get('content-type'), redirected: response.redirected,
        }) : undefined;
        throw new NodiaAiAdapterError(
          beforeDispatch.has(code) ? code : 'adapter_result_unknown',
          dispatch && (!beforeDispatch.has(code) || (code === 'runtime_busy' && !rejectionProof))
            ? 'unknown' : 'not_dispatched',
          rejectionProof,
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
