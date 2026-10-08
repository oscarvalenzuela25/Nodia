import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import { getSupportedProviderByKey } from '../helpers/supported-providers.helper.js';

@Injectable()
export class GetAiProviderCatalogUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(): Promise<AiProviderCatalog[]> {
    const catalogs = await this.aiProviderService.findAllCatalogs();
    return catalogs.filter((catalog) => catalog.is_active !== false && getSupportedProviderByKey(catalog.key));
  }
}
