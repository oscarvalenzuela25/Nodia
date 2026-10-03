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
import { envs } from '../../config/envs.config.js';
import {
  type ExtractedInvoiceData,
  type ExtractedInvoiceItem,
  type GeminiExecutionEngine,
} from './ai.types.js';

export type { ExtractedInvoiceData, ExtractedInvoiceItem, GeminiExecutionEngine };

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
      throw new ServiceUnavailableException('El microservicio de Gemini no está configurado.');
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
      throw new ServiceUnavailableException('El microservicio de Gemini no está disponible.');
    }

    if (response.status === 409) {
      throw new ConflictException('Ya hay un inicio de sesión Gemini en curso.');
    }
    if (response.status === 404) {
      throw new NotFoundException('La sesión de login Gemini no existe.');
    }
    if (!response.ok) {
      throw new BadGatewayException('Gemini no pudo gestionar el inicio de sesión.');
    }
    let job: unknown;
    try {
      job = await response.json();
    } catch {
      throw new BadGatewayException('Gemini devolvió un estado de login inválido.');
    }
    if (
      !job ||
      typeof job !== 'object' ||
      !('id' in job) ||
      typeof job.id !== 'string' ||
      !/^[0-9a-f]{32}$/.test(job.id) ||
      !('state' in job) ||
      !['running', 'succeeded', 'failed', 'cancelled'].includes(String(job.state))
    ) {
      throw new BadGatewayException('Gemini devolvió un estado de login inválido.');
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
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return Boolean(data?.authenticated || (data?.available && data?.has_active_session));
    } catch (error) {
      this.logger.warn(
        `Gemini microservice verification failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      return false;
    }
  }

  async getDualEngineStatus(): Promise<{
    active_engine: GeminiExecutionEngine;
    agentic: any;
    web: any;
  } | null> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) return null;

    try {
      const response = await fetch(`${baseUrl}/engines/status`, {
        method: 'GET',
        headers: this.serviceHeaders(),
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        return await response.json();
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
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const body = await response.json();
        if (engine === 'agentic' && body && typeof body.authenticated === 'undefined') {
          body.authenticated = Boolean(body.available && body.has_active_session);
        }
        return body;
      }

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
          authenticated: Boolean(statusData?.authenticated ?? (statusData?.available && statusData?.has_active_session)),
          tier: statusData?.tier || 'UNKNOWN',
          plan_label:
            statusData?.plan_label ||
            (statusData?.tier ? `Plan ${statusData.tier}` : 'Google AI Premium'),
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
  ): Promise<ExtractedInvoiceData> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'El microservicio de Gemini no está configurado.',
      );
    }

    const targetEngine = engine || providerFields?.engine || 'web';
    if (!selectedModel?.trim()) {
      throw new UnprocessableEntityException('Configure un modelo antes de analizar.');
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
    try {
      response = await fetch(`${baseUrl}/analyze-invoice`, {
        method: 'POST',
        headers: this.serviceHeaders(),
        body: formData,
        signal: AbortSignal.timeout(140000),
      });
    } catch (error) {
      this.logger.warn(
        `Gemini microservice request failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
        throw new GatewayTimeoutException('Tiempo de respuesta de Gemini agotado.');
      }
      throw new ServiceUnavailableException('No se pudo conectar con el microservicio de Gemini.');
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
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
    }
    const data = body.data as Record<string, unknown>;
    const rawItems = data.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new BadGatewayException('Gemini no pudo extraer productos de la imagen.');
    }

    const items = this.normalizeItems(rawItems);
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
      throw new BadGatewayException('Gemini devolvió valores numéricos inválidos.');
    }
    return value;
  }

  private normalizeItems(rawItems: unknown[]): ExtractedInvoiceItem[] {
    return rawItems.map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new BadGatewayException('Gemini devolvió un producto inválido.');
      }
      const item = raw as Record<string, unknown>;
      if (typeof item.name !== 'string' || !item.name.trim() ||
          (item.code != null && typeof item.code !== 'string')) {
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
