import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';

@Injectable()
export class GetAiProviderCatalogUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(): Promise<AiProviderCatalog[]> {
    return this.aiProviderService.findAllCatalogs();
  }
}
