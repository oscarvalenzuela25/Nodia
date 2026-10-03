import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { CreateAiProviderCatalogDto } from '../dto/create-ai-provider-catalog.dto.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';

@Injectable()
export class CreateAiProviderCatalogUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(dto: CreateAiProviderCatalogDto): Promise<AiProviderCatalog> {
    return this.aiProviderService.createCatalog(dto);
  }
}
