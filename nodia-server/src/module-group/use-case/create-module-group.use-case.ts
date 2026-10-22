import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CreateModuleGroupDto } from '../dto/create-module-group.dto.js';
import { SaveModuleGroupUseCase } from './save-module-group.use-case.js';
@Injectable()
export class CreateModuleGroupUseCase {
  constructor(private readonly save: SaveModuleGroupUseCase) {}
  execute(dto: CreateModuleGroupDto, actor: ActorReference) {
    return this.save.execute(undefined, dto, actor);
  }
}
