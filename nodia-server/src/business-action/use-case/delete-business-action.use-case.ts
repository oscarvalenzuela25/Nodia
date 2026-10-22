import { Injectable } from '@nestjs/common';
import { SaveBusinessActionUseCase } from './save-business-action.use-case.js';
import type { ActorReference } from '../../authorization/authority-transaction.js';

@Injectable()
export class DeleteBusinessActionUseCase {
  constructor(private readonly writer: SaveBusinessActionUseCase) {}

  async execute(id: string, actor: ActorReference) {
    await this.writer.execute(id, { is_active: false }, actor);
    return {
      message: `BusinessAction with ID "${id}" has been deactivated successfully`,
    };
  }
}
