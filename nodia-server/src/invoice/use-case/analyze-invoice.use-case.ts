import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';
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
  ) {}

  async execute(
    file: Express.Multer.File | undefined,
    dto: AnalyzeInvoiceDto,
  ): Promise<AnalyzeInvoiceResponse> {
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
        try {
          configuredAiProvider = await this.aiProviderService.findProviderById(
            dto.ai_provider_id,
          );
        } catch {
          // ignore not found and fallback
        }
      }
      if (!configuredAiProvider && dto.ai_provider) {
        try {
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
        } catch {
          // ignore not found and fallback
        }
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

    if (engineKey === 'mistral') {
      if (!canUseMistral()) {
        throw new BadRequestException(
          'El servicio de Mistral AI no está disponible o no está configurado.',
        );
      }
    } else {
      if (!canUseGemini()) {
        throw new BadRequestException(
          'El servicio de Gemini AI no está disponible o no está configurado.',
        );
      }
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
      } else {
        effectiveMode = 'api_key';
      }
    }

    // Resolve mode-specific fields if available
    const modeFields = effectiveMode ? configuredAiProvider?.fields?.[effectiveMode] : null;

    const defaultModel =
      modeFields?.selected_model ||
      modeFields?.default_model ||
      configuredAiProvider?.fields?.selected_model;
    const ocrModel =
      modeFields?.ocr_focus_model ||
      modeFields?.ocr_model ||
      configuredAiProvider?.fields?.ocr_focus_model ||
      configuredAiProvider?.fields?.ocr_model;

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
        : dto.extended_thinking;

    // Validate extended thinking capability and permission
    if (effectiveExtendedThinking) {
      const availableModels =
        modeFields?.available_models ||
        configuredAiProvider?.fields?.available_models || [];
      const modelDef = availableModels.find(
        (m: any) => m.id === effectiveModel || m.id === defaultModel,
      );
      const supportsReasoning = Boolean(
        modelDef?.capabilities?.includes('reasoning') ||
        modelDef?.id?.toLowerCase().includes('thinking') ||
        effectiveModel?.toLowerCase().includes('thinking') ||
        defaultModel?.toLowerCase().includes('thinking') ||
        (engineKey === 'gemini' &&
          !effectiveModel?.toLowerCase().includes('lite')),
      );
      const isEnabledInConfig = Boolean(
        modeFields?.enable_extended_thinking ??
        configuredAiProvider?.fields?.enable_extended_thinking,
      );

      if (!supportsReasoning && !isEnabledInConfig) {
        throw new BadRequestException(
          'El razonamiento extendido no está habilitado para el modelo configurado en este proveedor.',
        );
      }
    }

    const effectiveThinkingLevel: 'low' | 'medium' | 'high' =
      dto.thinking_level ||
      modeFields?.thinking_levels?.[effectiveModel] ||
      modeFields?.thinking_level ||
      configuredAiProvider?.fields?.thinking_levels?.[effectiveModel] ||
      configuredAiProvider?.fields?.thinking_level ||
      'medium';

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

    const extractedData =
      engineKey === 'mistral'
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
          ? dto.thinking_level !== undefined
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
