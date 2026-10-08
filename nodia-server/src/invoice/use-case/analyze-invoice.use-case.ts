import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ExecuteApiInvoiceUseCase } from '../../ai-provider/use-case/execute-api-invoice.use-case.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { MistralService } from '../../common/ai/mistral.service.js';
import { ProviderService } from '../../provider/provider.service.js';
import { AiProviderService } from '../../ai-provider/ai-provider.service.js';
import { AnalyzeInvoiceDto } from '../dto/analyze-invoice.dto.js';
import { AnalyzeInvoiceResponse } from '../types/invoice.types.js';
import { canUseGemini, canUseMistral } from '../../config/envs.config.js';
import { validateInvoiceFile } from '../invoice-file-validation.js';
import type { GeminiExecutionEngine } from '../../common/ai/ai.types.js';

@Injectable()
export class AnalyzeInvoiceUseCase {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly mistralService: MistralService,
    private readonly providerService: ProviderService,
    @Optional() private readonly aiProviderService?: AiProviderService,
    @Optional() private readonly executeApiInvoice?: ExecuteApiInvoiceUseCase,
  ) {}

  async execute(
    file: Express.Multer.File | undefined,
    dto: AnalyzeInvoiceDto,
  ): Promise<AnalyzeInvoiceResponse> {
    // Also validate legacy query options after the controller merges query/body.
    // They must never silently override a validated mode or be ignored.
    for (const [key, allowed] of Object.entries({
      mode: ['api_key', 'token_plan_web', 'token_plan_agentic'],
      engine: ['web', 'agentic'], model_type: ['default', 'ocr'],
      thinking_level: ['low', 'medium', 'high'],
    })) {
      const value = dto[key as keyof AnalyzeInvoiceDto];
      if (value !== undefined && (typeof value !== 'string' || !allowed.includes(value))) {
        throw new BadRequestException('Opciones de análisis inválidas.');
      }
    }
    if (dto.model !== undefined && (typeof dto.model !== 'string' || !dto.model.trim() || dto.model.length > 128)) {
      throw new BadRequestException('Modelo de análisis inválido.');
    }
    const thinking = dto.extended_thinking as unknown;
    if (thinking !== undefined && ![true, false, 'true', 'false'].includes(thinking as boolean | string)) {
      throw new BadRequestException('Opción de razonamiento inválida.');
    }
    dto = { ...dto, ...(thinking !== undefined ? { extended_thinking: thinking === true || thinking === 'true' } : {}) };
    if (dto.mode && dto.engine && dto.engine !== (dto.mode === 'token_plan_agentic' ? 'agentic' : 'web')) {
      throw new BadRequestException('El motor solicitado no corresponde al modo de sesión.');
    }
    if (!file || !file.buffer) {
      throw new BadRequestException('No invoice file uploaded');
    }

    validateInvoiceFile(file);

    let providerFields: Record<string, any> | undefined;
    let providerTax = 19;

    if (dto.provider_id && dto.provider_id.trim().length > 0) {
      const provider = await this.providerService.findOne(dto.provider_id);
      if (provider.business_id !== dto.business_id) {
        throw new BadRequestException(
          'Provider does not belong to the specified business',
        );
      }
      providerFields = provider.fields;
      providerTax =
        provider.tax !== undefined && provider.tax !== null
          ? Number(provider.tax)
          : 19;
    }

    // Resolve configured AI connection
    let configuredAiProvider: any = null;
    if (this.aiProviderService) {
      if (dto.ai_provider_id) {
        configuredAiProvider = await this.aiProviderService.findProviderById(dto.ai_provider_id);
        if (!configuredAiProvider) throw new BadRequestException('La conexión IA elegida no existe.');
      }
      if (!configuredAiProvider && dto.ai_provider) {
          const allProvidersRes = await this.aiProviderService.findAllProviders({
            all: true,
            includes: true,
          });
          const allProviders = allProvidersRes.data || [];
          configuredAiProvider = allProviders.find(
            (p: any) =>
              p.key?.toLowerCase() === dto.ai_provider?.toLowerCase() &&
              p.is_active,
          );
          if (!configuredAiProvider) throw new BadRequestException('El proveedor elegido no tiene una conexión activa configurada.');
      }
      if (!configuredAiProvider) {
        const allProvidersRes = await this.aiProviderService.findAllProviders({
          all: true,
          includes: true,
        });
        const allProviders = allProvidersRes.data || [];
        configuredAiProvider =
          allProviders.find((p: any) => p.is_active && p.is_default) ||
          allProviders.find(
            (p: any) => p.is_active && p.fields?.is_default_for_invoices,
          ) || allProviders.find((p: any) => p.is_active);
      }
    }

    const engineKey = (
      configuredAiProvider?.catalog?.key ||
      configuredAiProvider?.key ||
      dto.ai_provider ||
      (canUseGemini() ? 'gemini' : 'mistral')
    ).toLowerCase();
    if (!['gemini', 'mistral', 'openai'].includes(engineKey)) throw new BadRequestException('Este proveedor no tiene un adaptador de facturas implementado.');

    if (engineKey === 'mistral') {
      if (!canUseMistral()) {
        throw new BadRequestException(
          'El servicio de Mistral AI no está disponible o no está configurado.',
        );
      }
    }

    if (configuredAiProvider?.is_active === false || configuredAiProvider?.catalog?.is_active === false) {
      throw new BadRequestException('La conexión IA elegida está inactiva.');
    }

    // Resolve connection mode
    let effectiveMode: 'api_key' | 'token_plan_web' | 'token_plan_agentic' | null =
      dto.mode || null;

    if (!effectiveMode && dto.engine) {
      effectiveMode = dto.engine === 'agentic' ? 'token_plan_agentic' : 'token_plan_web';
    }

    if (!effectiveMode && configuredAiProvider) {
      if (configuredAiProvider.default_mode) {
        effectiveMode = configuredAiProvider.default_mode;
      } else if (configuredAiProvider.use_token_plan_agentic) {
        effectiveMode = 'token_plan_agentic';
      } else if (configuredAiProvider.use_token_plan_web) {
        effectiveMode = 'token_plan_web';
      } else if (configuredAiProvider.use_api_key) {
        effectiveMode = 'api_key';
      } else if (configuredAiProvider.mode === 'web_session') {
        effectiveMode = 'token_plan_web';
      } else if (configuredAiProvider.mode === 'api_key') {
        effectiveMode = 'api_key';
      } else if (configuredAiProvider.fields?.engine === 'agentic') {
        effectiveMode = 'token_plan_agentic';
      } else if (configuredAiProvider.fields?.engine === 'web') {
        effectiveMode = 'token_plan_web';
      }
    }

    if (engineKey === 'gemini' && effectiveMode !== 'api_key' && !canUseGemini()) {
      throw new BadRequestException('El servicio de Gemini AI no está disponible o no está configurado.');
    }
    if (configuredAiProvider && effectiveMode &&
      (configuredAiProvider[`use_${effectiveMode}`] === false || configuredAiProvider.catalog?.[`can_use_${effectiveMode}`] === false)) {
      throw new BadRequestException('La conexión IA no permite el modo solicitado.');
    }
    if (effectiveMode === 'token_plan_agentic' && dto.extended_thinking === true) {
      throw new BadRequestException('El modo agéntico admite nivel de esfuerzo, no extended thinking Web.');
    }

    // Scoped modes never inherit another channel's historical root preferences.
    const storedFields = configuredAiProvider?.fields ?? {};
    const hasScoped = Boolean(storedFields.token_plan_web || storedFields.token_plan_agentic || storedFields.api_key);
    const modeFields = (effectiveMode ? storedFields[effectiveMode] : undefined) ?? (hasScoped ? {} : storedFields);

    const defaultModel =
      modeFields?.selected_model ||
      modeFields?.default_model;
    const ocrModel =
      modeFields?.ocr_focus_model ||
      modeFields?.ocr_model;

    // Use explicit model from DTO if provided; otherwise if ocr_model is configured, prefer it, else default model
    const effectiveModel =
      dto.model ||
      (dto.model_type === 'ocr'
        ? (ocrModel || defaultModel)
        : (ocrModel && typeof ocrModel === 'string' && ocrModel.trim() !== ''
            ? ocrModel
            : defaultModel));

    // Extended thinking toggle is only supported in token_plan_web
    const effectiveExtendedThinking =
      effectiveMode === 'token_plan_agentic'
        ? undefined
        : dto.extended_thinking ?? (effectiveMode === 'token_plan_web'
          ? (typeof modeFields?.enable_extended_thinking === 'boolean' ? modeFields.enable_extended_thinking : undefined)
          : undefined);

    // The Web adapter validates its installed SDK option; never infer support from names.
    const effectiveThinkingLevel: 'low' | 'medium' | 'high' | undefined =
      dto.thinking_level || (effectiveMode === 'token_plan_agentic'
        ? modeFields?.thinking_levels?.[effectiveModel] || modeFields?.thinking_level
        : undefined);

    let targetGeminiEngine: GeminiExecutionEngine | undefined = dto.engine;
    if (!targetGeminiEngine) {
      if (effectiveMode === 'token_plan_agentic') {
        targetGeminiEngine = 'agentic';
      } else if (effectiveMode === 'token_plan_web') {
        targetGeminiEngine = 'web';
      } else if (configuredAiProvider?.fields?.engine) {
        targetGeminiEngine = configuredAiProvider.fields.engine as GeminiExecutionEngine;
      }
    }

    if (engineKey === 'openai' && effectiveMode !== 'api_key') throw new BadRequestException('OpenAI admite únicamente el canal API.');
    if (effectiveMode === 'api_key' && dto.engine) throw new BadRequestException('Un canal API no admite un motor de sesión.');
    if (effectiveMode === 'api_key' && (!configuredAiProvider?.id || !this.executeApiInvoice)) throw new BadRequestException('Debe seleccionar una conexión API configurada.');
    const extractedData =
      effectiveMode === 'api_key'
        ? await this.executeApiInvoice!.execute(configuredAiProvider.id, dto.model, file, providerFields, providerTax, dto.thinking_level)
        : engineKey === 'mistral'
        ? effectiveModel !== undefined || ocrModel !== undefined
          ? await this.mistralService.extractInvoiceData(
              file.buffer,
              file.mimetype,
              providerFields,
              providerTax,
              effectiveModel,
              ocrModel || undefined,
            )
          : await this.mistralService.extractInvoiceData(
              file.buffer,
              file.mimetype,
              providerFields,
              providerTax,
            )
        : effectiveModel !== undefined ||
            dto.extended_thinking !== undefined ||
            targetGeminiEngine !== undefined ||
            dto.thinking_level !== undefined ||
            dto.mode !== undefined
          ? effectiveThinkingLevel !== undefined
            ? await this.geminiService.extractInvoiceData(
                file.buffer,
                file.mimetype,
                providerFields,
                providerTax,
                effectiveModel,
                effectiveExtendedThinking,
                targetGeminiEngine,
                effectiveThinkingLevel,
              )
            : await this.geminiService.extractInvoiceData(
                file.buffer,
                file.mimetype,
                providerFields,
                providerTax,
                effectiveModel,
                effectiveExtendedThinking,
                targetGeminiEngine,
              )
          : await this.geminiService.extractInvoiceData(
              file.buffer,
              file.mimetype,
              providerFields,
              providerTax,
            );

    return {
      business_id: dto.business_id,
      provider_id: dto.provider_id ?? null,
      code: extractedData.code,
      total_amount: extractedData.total_amount,
      data: {
        issue_date: extractedData.issue_date,
        items: extractedData.items,
        ...extractedData.raw_data,
      },
    };
  }
}
