import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { SaveAiApiKeyUseCase } from './save-ai-api-key.use-case.js';
import { CreateAiApiKeyDto } from '../dto/create-ai-api-key.dto.js';

@Injectable()
export class CreateAiApiKeyUseCase {
  constructor(private readonly save: SaveAiApiKeyUseCase) {}
  async execute(dto: CreateAiApiKeyDto, actor: ActorReference) {
    return this.save.execute(undefined, dto, actor);
  }
}
