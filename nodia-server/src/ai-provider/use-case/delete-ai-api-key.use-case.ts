import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { SaveAiApiKeyUseCase } from './save-ai-api-key.use-case.js';

@Injectable()
export class DeleteAiApiKeyUseCase {
  constructor(private readonly save: SaveAiApiKeyUseCase) {}
  async execute(id: string, actor: ActorReference) {
    return this.save.remove(id, actor);
  }
}
