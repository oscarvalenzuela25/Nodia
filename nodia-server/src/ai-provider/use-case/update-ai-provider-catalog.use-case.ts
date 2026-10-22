import { Injectable } from '@nestjs/common';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { UpdateAiProviderCatalogDto } from '../dto/update-ai-provider-catalog.dto.js';
import { SaveAiProviderCatalogUseCase } from './save-ai-provider-catalog.use-case.js';

@Injectable()
export class UpdateAiProviderCatalogUseCase {
  constructor(private readonly writer: SaveAiProviderCatalogUseCase) {}
  async execute(
    id: string,
    dto: UpdateAiProviderCatalogDto,
    actor: ActorReference,
  ) {
    return this.writer.execute(id, dto, actor);
  }
}
