import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { SaveAiApiKeyUseCase } from './save-ai-api-key.use-case.js';
import { UpdateAiApiKeyDto } from '../dto/update-ai-api-key.dto.js';

@Injectable()
export class UpdateAiApiKeyUseCase {
  constructor(private readonly save: SaveAiApiKeyUseCase) {}
  async execute(id: string, dto: UpdateAiApiKeyDto, actor: ActorReference) {
    return this.save.execute(id, dto, actor);
  }
}
