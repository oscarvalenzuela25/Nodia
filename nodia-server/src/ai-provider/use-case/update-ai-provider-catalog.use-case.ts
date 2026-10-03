import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { UpdateAiProviderCatalogDto } from '../dto/update-ai-provider-catalog.dto.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';

@Injectable()
export class UpdateAiProviderCatalogUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(
    id: string,
    dto: UpdateAiProviderCatalogDto,
  ): Promise<AiProviderCatalog> {
    return this.aiProviderService.updateCatalog(id, dto);
  }
}
