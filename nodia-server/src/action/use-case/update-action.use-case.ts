import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { UpdateActionDto } from '../dto/update-action.dto.js';
import { SaveActionUseCase } from './save-action.use-case.js';
@Injectable()
export class UpdateActionUseCase {
  constructor(private readonly save: SaveActionUseCase) {}
  execute(id: string, dto: UpdateActionDto, actor: ActorReference) {
    return this.save.execute(id, dto, actor);
  }
}
