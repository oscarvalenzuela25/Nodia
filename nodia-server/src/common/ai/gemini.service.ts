import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  GatewayTimeoutException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  GeminiUpstreamException,
  geminiAdmissionReason,
} from './gemini-upstream.exception.js';
import {
  parseGeminiAgenticLoginJob,
  type GeminiAgenticLoginJob,
} from './gemini-agentic-login.js';

import {
  normalizeGeminiEngineStatus,
  isAgenticSessionActive,
  type GeminiDualEngineStatus,
} from './gemini-engine-status.js';
import { envs } from '../../config/envs.config.js';
import { randomUUID } from 'node:crypto';
import type { AnalysisProgress } from './analysis-progress.js';
import { observeGeminiProgress } from './gemini-progress-bridge.js';
import { parseGeminiInvoiceExtraction } from './invoice-extraction.js';
import {
  type ExtractedInvoiceData,
  type ExtractedInvoiceItem,
  type GeminiExecutionEngine,
} from './ai.types.js';

export type {
  ExtractedInvoiceData,
  ExtractedInvoiceItem,
  GeminiExecutionEngine,
};

export type GeminiLoginJob = {
  id: string;
  state: 'running' | 'succeeded' | 'failed' | 'cancelled';
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  private serviceHeaders(): Record<string, string> {
    if (!/^[0-9a-fA-F]{64}$/.test(envs.GEMINI_SERVICE_TOKEN)) {
      throw new ServiceUnavailableException(
        'La autenticación del microservicio de Gemini no está configurada.',
      );
    }
    return { 'X-Nodia-Service-Token': envs.GEMINI_SERVICE_TOKEN };
  }

  private async loginRequest(
    method: 'GET' | 'POST',
    path: string,
    actor: string,
    payload?: Record<string, unknown>,
    providerId?: string,
    expiresAt?: string,
  ): Promise<unknown> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'El microservicio de Gemini no está configurado.',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...this.serviceHeaders(),
          'X-Nodia-Actor-Id': actor,
          ...(providerId ? { 'X-Nodia-Provider-Id': providerId } : {}),
          ...(expiresAt ? { 'X-Nodia-Login-Expires-At': expiresAt } : {}),
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      this.logger.warn(
        `Gemini login request failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      throw new ServiceUnavailableException(
        'El microservicio de Gemini no está disponible.',
      );
    }

    if (!response.ok) await response.body?.cancel().catch(() => undefined);
    if (response.status === 409)
      throw new ConflictException(
        'El inicio de sesión Agentic está ocupado. Revisa el intento vigente antes de continuar.',
      );
    if (response.status === 404) {
      throw new NotFoundException('La sesión de login Gemini no existe.');
    }
    if (response.status === 503 || response.status === 504)
      throw new ServiceUnavailableException(
        'No se pudo confirmar la operación de inicio de sesión Agentic.',
      );
    if (!response.ok) {
      throw new BadGatewayException(
        'Gemini no pudo gestionar el inicio de sesión.',
      );
    }
    let job: unknown;
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty login response');
      const chunks: Uint8Array[] = [];
      let size = 0;
      const limit = 16_384;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > limit) throw new Error('Login response limit');
          chunks.push(chunk.value);
        }
        job = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(
            Buffer.concat(chunks),
          ),
        );
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } catch {
      throw new BadGatewayException(
        'Gemini devolvió un estado de login inválido.',
      );
    }
    return job;
  }

  /** Private durable login protocol. Request identity is persisted by the caller before IO. */
  async durableLoginRequest(
    engine: 'agentic',
    action: 'start' | 'status' | 'cancel',
    requestId: string,
    providerId: string,
    actor: string,
    expiresAt?: string,
  ): Promise<GeminiLoginJob | GeminiAgenticLoginJob> {
    if (
      !['agentic'].includes(engine) ||
      !['start', 'status', 'cancel'].includes(action) ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId) ||
      !/^[1-9][0-9]*$/.test(providerId) ||
      !/^[1-9][0-9]*$/.test(actor)
    ) {
      throw new ConflictException('ai_provider:invalid_login_request');
    }
    if (
      action === 'start' &&
      (typeof expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(expiresAt)) ||
        Date.parse(expiresAt) <= Date.now() ||
        Date.parse(expiresAt) > Date.now() + 300_000)
    ) {
      throw new ConflictException('ai_provider:invalid_login_deadline');
    }
    const prefix = '/agentic/auth/login';
    const path = `${prefix}/requests/${requestId.toLowerCase()}${action === 'cancel' ? '/cancel' : ''}`;
    const value = await this.loginRequest(
      action === 'status' ? 'GET' : 'POST',
      path,
      actor,
      undefined,
      providerId,
      expiresAt,
    );
    if (
      value &&
      typeof value === 'object' &&
      'state' in value &&
      value.state === 'unknown'
    ) {
      throw new ConflictException('ai_provider:login_unknown');
    }
    const job = parseGeminiAgenticLoginJob(value);
    if (job.id !== requestId.toLowerCase().replaceAll('-', '')) {
      throw new BadGatewayException('ai_provider:invalid_login_observation');
    }
    return job;
  }

  /** ACK retires a proof already settled in SQL; absence is an idempotent no-op, not a login result. */
  async acknowledgeLoginRequest(
    engine: 'agentic',
    requestId: string,
    providerId: string,
    actor: string,
  ): Promise<void> {
    if (
      !['agentic'].includes(engine) ||
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId) ||
      !/^[1-9][0-9]*$/.test(providerId) ||
      !/^[1-9][0-9]*$/.test(actor)
    )
      throw new ConflictException('ai_provider:invalid_login_request');
    const prefix = '/agentic/auth/login';
    const result = await this.loginRequest(
      'POST',
      `${prefix}/requests/${requestId.toLowerCase()}/ack`,
      actor,
      undefined,
      providerId,
    );
    if (
      !result ||
      typeof result !== 'object' ||
      Object.keys(result).join(',') !== 'acknowledged' ||
      !('acknowledged' in result) ||
      result.acknowledged !== true
    )
      throw new BadGatewayException(
        'ai_provider:invalid_login_acknowledgement',
      );
  }

  async agenticLoginRequest(
    method: 'GET' | 'POST',
    path: string,
    actorUserId: string,
    payload?: { code: string },
  ): Promise<GeminiAgenticLoginJob | null> {
    let response: Response;
    try {
      response = await fetch(
        `${envs.GEMINI_MICROSERVICE_URL}/agentic/auth/login${path}`,
        {
          method,
          headers: {
            ...this.serviceHeaders(),
            'X-Nodia-Actor-Id': actorUserId,
            ...(payload ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
          signal: AbortSignal.timeout(5000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'El microservicio Gemini no está disponible para autenticar Agentic.',
      );
    }
    if (!response.ok) await response.body?.cancel().catch(() => undefined);
    if (response.status === 404)
      throw new NotFoundException('Intento de login Agentic no encontrado.');
    if (response.status === 409)
      throw new ConflictException(
        'Agentic está ocupado o el intento no espera un código.',
      );
    if (response.status === 422) {
      if (
        method === 'POST' &&
        /^\/[0-9a-f]{32}\/code$/.test(path) &&
        response.headers.get('X-Nodia-Error-Code') === 'login_invalid_code'
      ) {
        throw new UnprocessableEntityException(
          'Código de autorización Agentic inválido.',
        );
      }
      throw new BadGatewayException(
        'El microservicio Gemini rechazó los parámetros internos del login Agentic.',
      );
    }
    if (response.status === 503)
      throw new ServiceUnavailableException(
        'Configure el CLI Agentic en el servidor antes de iniciar sesión.',
      );
    if (!response.ok)
      throw new BadGatewayException(
        'No se pudo gestionar el login Agentic de Gemini.',
      );
    let value: unknown;
    try {
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty login response');
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 16_384) throw new Error('Login response limit');
          chunks.push(chunk.value);
        }
        value = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(
            Buffer.concat(chunks),
          ),
        );
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } catch {
      throw new BadGatewayException('Respuesta de login Agentic inválida.');
    }
    if (value === null && method === 'GET' && path === '/current') return null;
    return parseGeminiAgenticLoginJob(value);
  }

  async verifyProvider(engine?: GeminiExecutionEngine): Promise<boolean> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) {
      return false;
    }

    try {
      const endpoint = '/agentic/status';
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: AbortSignal.timeout(engine === 'agentic' ? 15000 : 5000),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return engine === 'agentic'
        ? isAgenticSessionActive(data)
        : data?.authenticated === true;
    } catch (error) {
      this.logger.warn(
        `Gemini microservice verification failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      return false;
    }
  }

  /** Chat observations bound remote bytes before decoding; ordinary consumers retain compatibility. */
  private async observationJson(
    response: Response,
    signal?: AbortSignal,
  ): Promise<any> {
    if (!signal) return response.json();
    signal.throwIfAborted();
    const reader = response.body?.getReader();
    if (!reader)
      throw new BadGatewayException('Respuesta de observación vacía.');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 262144)
          throw new BadGatewayException('Observación demasiado grande.');
        chunks.push(chunk.value);
      }
      return JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
      );
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  async getDualEngineStatus(
    callerSignal?: AbortSignal,
  ): Promise<GeminiDualEngineStatus | null> {
    callerSignal?.throwIfAborted();
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) return null;

    try {
      const response = await fetch(`${baseUrl}/engines/status`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: callerSignal
          ? AbortSignal.any([callerSignal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      });

      if (response.ok) {
        return normalizeGeminiEngineStatus(
          await this.observationJson(response, callerSignal),
        );
      }
    } catch (error) {
      callerSignal?.throwIfAborted();
      this.logger.warn(
        `Gemini getDualEngineStatus failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
    }
    return null;
  }

  async getModelsAndQuota(
    engine?: GeminiExecutionEngine,
    callerSignal?: AbortSignal,
  ): Promise<any> {
    callerSignal?.throwIfAborted();
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;

    if (!baseUrl) {
      return {
        authenticated: false,
        tier: 'UNKNOWN',
        plan_label: 'Microservicio no configurado',
        active_model: null,
        models: [],
        usage_info: null,
        quotas: null,
      };
    }

    try {
      const endpoint = '/agentic/models';
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: callerSignal
          ? AbortSignal.any([
              callerSignal,
              AbortSignal.timeout(engine === 'agentic' ? 15000 : 6000),
            ])
          : AbortSignal.timeout(engine === 'agentic' ? 15000 : 6000),
      });

      if (response.ok) {
        const body = await this.observationJson(response, callerSignal);
        if (engine === 'agentic') {
          if (
            body?.engine !== 'agentic' ||
            typeof body.available !== 'boolean' ||
            typeof body.authenticated !== 'boolean' ||
            !Array.isArray(body.models) ||
            body.models.length > 512 ||
            body.models.some(
              (model: unknown) =>
                !model ||
                typeof model !== 'object' ||
                !('id' in model) ||
                typeof model.id !== 'string' ||
                !model.id ||
                model.id.length > 128 ||
                !('name' in model) ||
                typeof model.name !== 'string' ||
                !model.name ||
                model.name.length > 256,
            ) ||
            new Set(body.models.map((model: { id: string }) => model.id))
              .size !== body.models.length
          ) {
            throw new BadGatewayException('Catálogo agéntico inválido.');
          }
          const authenticated = body.available && body.authenticated;
          return {
            engine: 'agentic',
            available: body.available,
            reason: geminiAdmissionReason(body.reason),
            authenticated,
            models: authenticated
              ? body.models.map((model: { id: string; name: string }) => ({
                  id: model.id,
                  name: model.name,
                }))
              : [],
            tier: 'UNKNOWN',
            plan_label: 'Plan no identificado',
            active_model: null,
            usage_info: null,
            quotas: null,
          };
        }
        return body;
      }

      if (engine === 'agentic') {
        await response.body?.cancel().catch(() => undefined);
        throw GeminiUpstreamException.fromResponse(response);
      }

      // Fallback to status endpoint
      const fallbackEndpoint = engine ? `/${engine}/status` : '/auth/status';
      const fallbackResponse = await fetch(`${baseUrl}${fallbackEndpoint}`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: callerSignal
          ? AbortSignal.any([callerSignal, AbortSignal.timeout(4000)])
          : AbortSignal.timeout(4000),
      });
      if (fallbackResponse.ok) {
        const statusData = await this.observationJson(
          fallbackResponse,
          callerSignal,
        );
        return {
          authenticated: Boolean(
            statusData?.authenticated ??
            (statusData?.available && statusData?.has_active_session),
          ),
          tier: statusData?.tier || 'UNKNOWN',
          plan_label:
            statusData?.plan_label ||
            (statusData?.tier
              ? `Plan ${statusData.tier}`
              : 'Plan no identificado'),
          active_model: statusData?.active_model || statusData?.model || null,
          models: statusData?.models || [],
          usage_info: null,
          quotas: null,
        };
      }
    } catch (error) {
      callerSignal?.throwIfAborted();
      this.logger.warn(
        `Gemini getModelsAndQuota failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      if (engine === 'agentic' && error instanceof GeminiUpstreamException) {
        const reason = geminiAdmissionReason(error.upstreamErrorCode);
        if (reason)
          return {
            engine: 'agentic',
            available: false,
            authenticated: false,
            reason,
            models: [],
            active_model: null,
            usage_info: null,
            quotas: null,
          };
      }
    }

    return {
      authenticated: false,
      tier: 'UNKNOWN',
      plan_label: 'Microservicio no disponible',
      active_model: null,
      models: [],
      usage_info: null,
      quotas: null,
    };
  }

  async extractInvoiceData(
    buffer: Buffer,
    mimeType: string,
    providerFields?: Record<string, any>,
    providerTax: number = 19,
    selectedModel?: string,
    extendedThinking?: boolean,
    engine?: GeminiExecutionEngine,
    thinkingLevel?: 'low' | 'medium' | 'high',
    callerSignal?: AbortSignal,
    progress?: AnalysisProgress,
  ): Promise<ExtractedInvoiceData> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'El microservicio de Gemini no está configurado.',
      );
    }

    const targetEngine = engine ?? 'agentic';
    if (targetEngine !== 'agentic')
      throw new UnprocessableEntityException('ai_provider:retired_mode');
    if (!selectedModel?.trim()) {
      throw new UnprocessableEntityException(
        'Configure un modelo antes de analizar.',
      );
    }

    const formData = new FormData();
    const extension =
      mimeType === 'application/pdf'
        ? 'pdf'
        : mimeType.replace('image/', '') || 'jpg';
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('file', blob, `invoice.${extension}`);
    formData.append(
      'provider_fields',
      JSON.stringify({ ...providerFields, tax: providerTax }),
    );
    formData.append('provider_tax', String(providerTax));
    if (selectedModel) {
      formData.append('model', selectedModel);
    }
    if (extendedThinking !== undefined) {
      formData.append('extended_thinking', String(extendedThinking));
    }
    if (thinkingLevel) {
      formData.append('thinking_level', thinkingLevel);
    }
    formData.append('engine', targetEngine);

    let response: Response;
    const deadline = AbortSignal.timeout(340000);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, deadline])
      : deadline;
    signal.throwIfAborted();
    const privateId = progress ? randomUUID() : undefined;
    const stopObservation =
      privateId && progress
        ? observeGeminiProgress(
            baseUrl,
            this.serviceHeaders(),
            privateId,
            progress,
          )
        : undefined;
    try {
      const endpoint = '/agentic/analyze-invoice';
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          ...this.serviceHeaders(),
          ...(privateId ? { 'X-Nodia-Analysis-Id': privateId } : {}),
        },
        body: formData,
        // Includes microservice upload (30s), analysis (300s) and cleanup margin.
        signal,
      });
    } catch (error) {
      this.logger.warn(
        `Gemini microservice request failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      if (
        error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name)
      ) {
        throw new GatewayTimeoutException(
          'Tiempo de respuesta de Gemini agotado.',
        );
      }
      throw new ServiceUnavailableException(
        'No se pudo conectar con el microservicio de Gemini.',
      );
    } finally {
      await stopObservation?.(!signal.aborted);
    }

    if (!response.ok) {
      this.logger.warn(`Gemini microservice returned HTTP ${response.status}`);
      await response.body?.cancel().catch(() => undefined);
      throw GeminiUpstreamException.fromResponse(response);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
    }
    const extraction = parseGeminiInvoiceExtraction(parsed);
    progress?.emit('response_received');
    return extraction;
  }
}
