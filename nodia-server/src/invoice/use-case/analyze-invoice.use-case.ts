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

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

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

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Supported formats: PDF, PNG, JPEG, WEBP.`,
      );
    }

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
      if (!configuredAiProvider) {
        const allProvidersRes = await this.aiProviderService.findAllProviders({
          all: true,
        });
        const allProviders = allProvidersRes.data || [];
        configuredAiProvider =
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

    const selectedModel = configuredAiProvider?.fields?.selected_model;

    // Validate extended thinking capability and permission
    if (dto.extended_thinking) {
      const availableModels =
        configuredAiProvider?.fields?.available_models || [];
      const modelDef = availableModels.find(
        (m: any) => m.id === selectedModel,
      );
      const supportsReasoning = Boolean(
        modelDef?.capabilities?.includes('reasoning'),
      );
      const isEnabledInConfig = Boolean(
        configuredAiProvider?.fields?.enable_extended_thinking,
      );

      if (!supportsReasoning || !isEnabledInConfig) {
        throw new BadRequestException(
          'El razonamiento extendido no está habilitado para el modelo configurado en este proveedor.',
        );
      }
    }

    const aiService =
      engineKey === 'mistral' ? this.mistralService : this.geminiService;

    const extractedData =
      selectedModel !== undefined || dto.extended_thinking !== undefined
        ? await aiService.extractInvoiceData(
            file.buffer,
            file.mimetype,
            providerFields,
            providerTax,
            selectedModel,
            dto.extended_thinking,
          )
        : await aiService.extractInvoiceData(
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
