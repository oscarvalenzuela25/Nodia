import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { ApiProviderService } from '../../common/ai/api-provider.service.js';
import type { ApiThinkingLevel } from '../../common/ai/api-provider.service.js';
import { validateInvoiceFile } from '../../invoice/invoice-file-validation.js';
import type { AnalysisProgress } from '../../common/ai/analysis-progress.js';

@Injectable()
export class ExecuteApiInvoiceUseCase {
  constructor(
    private readonly providers: AiProviderService,
    private readonly api: ApiProviderService,
  ) {}

  async execute(
    providerId: string,
    model: string | undefined,
    file: Express.Multer.File,
    fields?: Record<string, unknown>,
    tax = 19,
    thinkingLevel?: ApiThinkingLevel,
    callerSignal?: AbortSignal,
    progress?: AnalysisProgress,
  ) {
    validateInvoiceFile(file);
    const provider = await this.providers.findProviderById(providerId);
    if (
      !provider.is_active ||
      !provider.use_api_key ||
      provider.catalog?.can_use_api_key !== true ||
      provider.catalog.is_active === false
    ) {
      throw new BadRequestException(
        'El canal API no está habilitado en esta conexión.',
      );
    }
    const key = provider.catalog.key;
    const scoped = provider.fields?.api_key;
    const hasScoped =
      provider.fields?.token_plan_web ||
      provider.fields?.token_plan_agentic ||
      scoped;
    const modeFields = scoped ?? (hasScoped ? {} : (provider.fields ?? {}));
    const configured = model ?? modeFields.selected_model;
    if (typeof configured !== 'string' || !configured.trim())
      throw new BadRequestException('Sin modelo asignado para API.');
    if (
      !Array.isArray(modeFields.available_models) ||
      !modeFields.available_models.some(
        (value: unknown) =>
          value &&
          typeof value === 'object' &&
          'id' in value &&
          value.id === configured,
      )
    ) {
      throw new BadRequestException(
        'El modelo solicitado no está configurado para el canal API de esta conexión.',
      );
    }
    const level: unknown = thinkingLevel !== undefined
      ? thinkingLevel
      : modeFields.thinking_levels?.[configured] ?? modeFields.thinking_level ?? undefined;
    if (level !== undefined && level !== 'low' && level !== 'medium' && level !== 'high') {
      throw new BadRequestException('El nivel de razonamiento API debe ser low, medium o high.');
    }
    const credentials = await this.providers.getEligibleApiKeySecrets(
      providerId,
      provider.auto_rotate_api_keys,
    );
    if (!credentials.length)
      throw new BadRequestException(
        'Debe agregar y seleccionar una API key activa para esta conexión.',
      );
    progress?.resolve({ providerId, provider: key, mode: 'api_key', model: configured });
    progress?.emit('model_checked');
    const timeout = AbortSignal.timeout(90000);
    const deadline = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
    for (let index = 0; index < credentials.length; index++) {
      try {
        deadline.throwIfAborted();
        const result = await this.api.extractInvoice(
          key,
          credentials[index],
          configured,
          file.buffer,
          file.mimetype,
          fields,
          tax,
          deadline,
          level,
          ...(progress ? [progress] : []),
        );
        return result;
      } catch (error) {
        const response =
          error instanceof HttpException ? error.getResponse() : null;
        const status =
          response &&
          typeof response === 'object' &&
          'upstream_status' in response
            ? response.upstream_status
            : null;
        if (
          deadline.aborted ||
          ![401, 403, 429].includes(Number(status)) ||
          index === credentials.length - 1
        )
          throw error;
      }
    }
    throw new BadRequestException('No hay API keys elegibles.');
  }
}
