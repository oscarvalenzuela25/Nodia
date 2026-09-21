import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { MistralService } from '../../common/ai/mistral.service.js';
import { ProviderService } from '../../provider/provider.service.js';
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

    if (dto.provider_id && dto.provider_id.trim().length > 0) {
      const provider = await this.providerService.findOne(dto.provider_id);
      if (provider.business_id !== dto.business_id) {
        throw new BadRequestException(
          'Provider does not belong to the specified business',
        );
      }
      providerFields = provider.fields;
    }

    const selectedProvider =
      dto.ai_provider || (canUseGemini() ? 'gemini' : 'mistral');

    if (selectedProvider === 'mistral') {
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

    const aiService =
      selectedProvider === 'mistral' ? this.mistralService : this.geminiService;

    const extractedData = await aiService.extractInvoiceData(
      file.buffer,
      file.mimetype,
      providerFields,
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
