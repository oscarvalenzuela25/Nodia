import { Injectable } from '@nestjs/common';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { CreateAiProviderDto } from '../dto/create-ai-provider.dto.js';
import { SaveAiProviderConfigurationUseCase } from './save-ai-provider-configuration.use-case.js';

@Injectable()
export class CreateAiProviderUseCase {
  constructor(private readonly writer: SaveAiProviderConfigurationUseCase) {}
  async execute(dto: CreateAiProviderDto, actor: ActorReference) {
    return this.writer.execute(undefined, dto, actor);
  }
}
