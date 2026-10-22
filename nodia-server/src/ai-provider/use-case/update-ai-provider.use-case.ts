import { Injectable } from '@nestjs/common';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { UpdateAiProviderDto } from '../dto/update-ai-provider.dto.js';
import { SaveAiProviderConfigurationUseCase } from './save-ai-provider-configuration.use-case.js';

@Injectable()
export class UpdateAiProviderUseCase {
  constructor(private readonly writer: SaveAiProviderConfigurationUseCase) {}
  async execute(id: string, dto: UpdateAiProviderDto, actor: ActorReference) {
    return this.writer.execute(id, dto, actor);
  }
}
