import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CreateActionDto } from '../dto/create-action.dto.js';
import { SaveActionUseCase } from './save-action.use-case.js';
@Injectable()
export class CreateActionUseCase {
  constructor(private readonly save: SaveActionUseCase) {}
  execute(dto: CreateActionDto, actor: ActorReference) {
    return this.save.execute(undefined, dto, actor);
  }
}
