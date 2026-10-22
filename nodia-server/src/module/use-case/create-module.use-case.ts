import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CreateModuleDto } from '../dto/create-module.dto.js';
import { SaveModuleUseCase } from './save-module.use-case.js';
@Injectable()
export class CreateModuleUseCase {
  constructor(private readonly save: SaveModuleUseCase) {}
  execute(dto: CreateModuleDto, actor: ActorReference) {
    return this.save.execute(undefined, dto, actor);
  }
}
