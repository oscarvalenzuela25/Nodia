import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';
import { AiProviderCatalog } from '../entities/ai-provider-catalog.entity.js';
import { getSupportedProviderByKey } from '../helpers/supported-providers.helper.js';

@Injectable()
export class GetAiProviderCatalogUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(maxRows?: number): Promise<AiProviderCatalog[]> {
    if (maxRows !== undefined && (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 100))
      throw new Error('nodia_ai:invalid_tool_input');
    const catalogs = maxRows === undefined
      ? await this.aiProviderService.findAllCatalogs()
      : await this.aiProviderService.findAllCatalogs(maxRows);
    if (maxRows !== undefined && catalogs.length > maxRows)
      throw new Error('nodia_ai:context_limit');
    return catalogs.filter((catalog) => catalog.is_active !== false && getSupportedProviderByKey(catalog.key));
  }
}
