import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { UpdateModuleDto } from '../dto/update-module.dto.js';
import { SaveModuleUseCase } from './save-module.use-case.js';
@Injectable()
export class UpdateModuleUseCase {
  constructor(private readonly save: SaveModuleUseCase) {}
  execute(id: string, dto: UpdateModuleDto, actor: ActorReference) {
    return this.save.execute(id, dto, actor);
  }
}
