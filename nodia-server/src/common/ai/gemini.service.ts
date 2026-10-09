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
import { GeminiUpstreamException } from './gemini-upstream.exception.js';
import { parseGeminiAgenticLoginJob, type GeminiAgenticLoginJob } from './gemini-agentic-login.js';
import {
  normalizeGeminiEngineStatus,
  isAgenticSessionActive,
  type GeminiDualEngineStatus,
} from './gemini-engine-status.js';
import { envs } from '../../config/envs.config.js';
import { randomUUID } from 'node:crypto';
import type { AnalysisProgress } from './analysis-progress.js';
import { observeGeminiProgress } from './gemini-progress-bridge.js';
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
  ): Promise<GeminiLoginJob> {
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
        headers: this.serviceHeaders(),
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

    if (response.status === 409) {
      throw new ConflictException(
        'Ya hay un inicio de sesión Gemini en curso.',
      );
    }
    if (response.status === 404) {
      throw new NotFoundException('La sesión de login Gemini no existe.');
    }
    if (!response.ok) {
      throw new BadGatewayException(
        'Gemini no pudo gestionar el inicio de sesión.',
      );
    }
    let job: unknown;
    try {
      job = await response.json();
    } catch {
      throw new BadGatewayException(
        'Gemini devolvió un estado de login inválido.',
      );
    }
    if (
      !job ||
      typeof job !== 'object' ||
      !('id' in job) ||
      typeof job.id !== 'string' ||
      !/^[0-9a-f]{32}$/.test(job.id) ||
      !('state' in job) ||
      !['running', 'succeeded', 'failed', 'cancelled'].includes(
        String(job.state),
      )
    ) {
      throw new BadGatewayException(
        'Gemini devolvió un estado de login inválido.',
      );
    }
    return job as GeminiLoginJob;
  }

  startInteractiveLogin(): Promise<GeminiLoginJob> {
    return this.loginRequest('POST', '/auth/login/start');
  }

  getInteractiveLoginStatus(jobId: string): Promise<GeminiLoginJob> {
    return this.loginRequest('GET', `/auth/login/${jobId}`);
  }

  cancelInteractiveLogin(jobId: string): Promise<GeminiLoginJob> {
    return this.loginRequest('POST', `/auth/login/${jobId}/cancel`);
  }

  async agenticLoginRequest(method: 'GET' | 'POST', path: string, actorUserId: string,
    payload?: { code: string }): Promise<GeminiAgenticLoginJob | null> {
    let response: Response;
    try {
      response = await fetch(`${envs.GEMINI_MICROSERVICE_URL}/agentic/auth/login${path}`, {
        method, headers: { ...this.serviceHeaders(), 'X-Nodia-Actor-Id': actorUserId,
          ...(payload ? { 'Content-Type': 'application/json' } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('El microservicio Gemini no está disponible para autenticar Agentic.');
    }
    if (!response.ok) await response.body?.cancel().catch(() => undefined);
    if (response.status === 404) throw new NotFoundException('Intento de login Agentic no encontrado.');
    if (response.status === 409) throw new ConflictException('Agentic está ocupado o el intento no espera un código.');
    if (response.status === 422) {
      if (method === 'POST' && /^\/[0-9a-f]{32}\/code$/.test(path)
        && response.headers.get('X-Nodia-Error-Code') === 'login_invalid_code') {
        throw new UnprocessableEntityException('Código de autorización Agentic inválido.');
      }
      throw new BadGatewayException('El microservicio Gemini rechazó los parámetros internos del login Agentic.');
    }
    if (response.status === 503) throw new ServiceUnavailableException('Configure el CLI Agentic en el servidor antes de iniciar sesión.');
    if (!response.ok) throw new BadGatewayException('No se pudo gestionar el login Agentic de Gemini.');
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
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }
    catch { throw new BadGatewayException('Respuesta de login Agentic inválida.'); }
    if (value === null && method === 'GET' && path === '/current') return null;
    return parseGeminiAgenticLoginJob(value);
  }

  async verifyProvider(engine?: GeminiExecutionEngine): Promise<boolean> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) {
      return false;
    }

    try {
      const endpoint = engine ? `/${engine}/status` : '/auth/status';
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: AbortSignal.timeout(engine === 'agentic' ? 15000 : 5000),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return engine === 'agentic' ? isAgenticSessionActive(data) : data?.authenticated === true;
    } catch (error) {
      this.logger.warn(
        `Gemini microservice verification failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      return false;
    }
  }

  async getDualEngineStatus(): Promise<GeminiDualEngineStatus | null> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) return null;

    try {
      const response = await fetch(`${baseUrl}/engines/status`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        return normalizeGeminiEngineStatus(await response.json());
      }
    } catch (error) {
      this.logger.warn(
        `Gemini getDualEngineStatus failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
    }
    return null;
  }

  async getModelsAndQuota(engine?: GeminiExecutionEngine): Promise<any> {
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
      const endpoint = engine ? `/${engine}/models` : '/models';
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: AbortSignal.timeout(engine === 'agentic' ? 15000 : 6000),
      });

      if (response.ok) {
        const body = await response.json();
        if (engine === 'agentic') {
          if (body?.engine !== 'agentic' || typeof body.available !== 'boolean' ||
            typeof body.authenticated !== 'boolean' || !Array.isArray(body.models) || body.models.length > 512 ||
            body.models.some((model: unknown) => !model || typeof model !== 'object' ||
              !('id' in model) || typeof model.id !== 'string' || !model.id || model.id.length > 128 ||
              !('name' in model) || typeof model.name !== 'string' || !model.name || model.name.length > 256) ||
            new Set(body.models.map((model: { id: string }) => model.id)).size !== body.models.length) {
            throw new BadGatewayException('Catálogo agéntico inválido.');
          }
          const authenticated = body.available && body.authenticated;
          return { engine: 'agentic', available: body.available, authenticated,
            models: authenticated ? body.models.map((model: { id: string; name: string }) => ({ id: model.id, name: model.name })) : [],
            tier: 'UNKNOWN', plan_label: 'Plan no identificado', active_model: null, usage_info: null, quotas: null };
        }
        return body;
      }

      if (engine === 'agentic') throw new BadGatewayException('Descubrimiento agéntico no disponible.');

      // Fallback to status endpoint
      const fallbackEndpoint = engine ? `/${engine}/status` : '/auth/status';
      const fallbackResponse = await fetch(`${baseUrl}${fallbackEndpoint}`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: AbortSignal.timeout(4000),
      });
      if (fallbackResponse.ok) {
        const statusData = await fallbackResponse.json();
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
      this.logger.warn(
        `Gemini getModelsAndQuota failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
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

    const targetEngine = engine || providerFields?.engine || 'web';
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
    if (extendedThinking) {
      formData.append('extended_thinking', 'true');
    }
    if (thinkingLevel) {
      formData.append('thinking_level', thinkingLevel);
    }
    formData.append('engine', targetEngine);

    let response: Response;
    const deadline = AbortSignal.timeout(340000);
    const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
    signal.throwIfAborted();
    const privateId = progress ? randomUUID() : undefined;
    const stopObservation = privateId && progress ? observeGeminiProgress(baseUrl, this.serviceHeaders(), privateId, progress) : undefined;
    try {
      const endpoint = targetEngine === 'agentic' ? '/agentic/analyze-invoice' : '/analyze-invoice';
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { ...this.serviceHeaders(), ...(privateId ? { 'X-Nodia-Analysis-Id': privateId } : {}) },
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
      throw GeminiUpstreamException.fromResponse(response);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
    }
    const body = parsed as Record<string, unknown>;
    if (
      !body.data ||
      typeof body.data !== 'object' ||
      Array.isArray(body.data)
    ) {
      throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
    }
    const data = body.data as Record<string, unknown>;
    const rawItems = data.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new BadGatewayException(
        'Gemini no pudo extraer productos de la imagen.',
      );
    }

    const items = this.normalizeItems(rawItems);
    progress?.emit('response_received');
    const total = this.numericValue(body.total_amount);
    if (body.code != null && typeof body.code !== 'string') {
      throw new BadGatewayException('Gemini devolvió un folio inválido.');
    }
    const issueDate = data.issue_date;
    if (issueDate != null && typeof issueDate !== 'string') {
      throw new BadGatewayException('Gemini devolvió una fecha inválida.');
    }
    return {
      code: typeof body.code === 'string' ? body.code.trim() : '',
      total_amount: total,
      issue_date: typeof issueDate === 'string' ? issueDate : undefined,
      items,
    };
  }

  private numericValue(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BadGatewayException(
        'Gemini devolvió valores numéricos inválidos.',
      );
    }
    return value;
  }

  private normalizeItems(rawItems: unknown[]): ExtractedInvoiceItem[] {
    return rawItems.map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new BadGatewayException('Gemini devolvió un producto inválido.');
      }
      const item = raw as Record<string, unknown>;
      if (
        typeof item.name !== 'string' ||
        !item.name.trim() ||
        (item.code != null && typeof item.code !== 'string')
      ) {
        throw new BadGatewayException('Gemini devolvió un producto inválido.');
      }
      // Python validates the extraction. Preserve missing/zero values here;
      // the review form owns explicitly configured net/gross calculations.
      return {
        code: typeof item.code === 'string' ? item.code.trim() : null,
        name: item.name.trim(),
        quantity: this.numericValue(item.quantity),
        packages: this.numericValue(item.packages),
        units_per_package: this.numericValue(item.units_per_package),
        cost_price: this.numericValue(item.cost_price),
        cost_price_tax: this.numericValue(item.cost_price_tax),
        unit_price: this.numericValue(item.unit_price),
        total_price: this.numericValue(item.total_price),
      };
    });
  }
}
