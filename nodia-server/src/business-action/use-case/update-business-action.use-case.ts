import { Injectable } from '@nestjs/common';
import { UpdateBusinessActionDto } from '../dto/update-business-action.dto.js';
import { SaveBusinessActionUseCase } from './save-business-action.use-case.js';
import type { ActorReference } from '../../authorization/authority-transaction.js';

@Injectable()
export class UpdateBusinessActionUseCase {
  constructor(private readonly writer: SaveBusinessActionUseCase) {}

  async execute(
    id: string,
    dto: UpdateBusinessActionDto,
    actor: ActorReference,
  ) {
    return this.writer.execute(id, dto, actor);
  }
}
