import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { UpdateModuleGroupDto } from '../dto/update-module-group.dto.js';
import { SaveModuleGroupUseCase } from './save-module-group.use-case.js';
@Injectable()
export class UpdateModuleGroupUseCase {
  constructor(private readonly save: SaveModuleGroupUseCase) {}
  execute(id: string, dto: UpdateModuleGroupDto, actor: ActorReference) {
    return this.save.execute(id, dto, actor);
  }
}
