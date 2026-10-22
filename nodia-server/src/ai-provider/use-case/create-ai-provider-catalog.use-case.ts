import { Injectable } from '@nestjs/common';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { CreateAiProviderCatalogDto } from '../dto/create-ai-provider-catalog.dto.js';
import { SaveAiProviderCatalogUseCase } from './save-ai-provider-catalog.use-case.js';

@Injectable()
export class CreateAiProviderCatalogUseCase {
  constructor(private readonly writer: SaveAiProviderCatalogUseCase) {}
  async execute(dto: CreateAiProviderCatalogDto, actor: ActorReference) {
    return this.writer.execute(undefined, dto, actor);
  }
}
