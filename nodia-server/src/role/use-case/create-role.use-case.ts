import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CreateRoleDto } from '../dto/create-role.dto.js';
import { SaveRoleUseCase } from './save-role.use-case.js';
@Injectable()
export class CreateRoleUseCase {
  constructor(private readonly save: SaveRoleUseCase) {}
  execute(dto: CreateRoleDto, actor: ActorReference) {
    return this.save.execute(undefined, dto, actor);
  }
}
