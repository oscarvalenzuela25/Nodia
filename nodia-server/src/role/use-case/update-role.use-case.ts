import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { SaveRoleUseCase } from './save-role.use-case.js';
@Injectable()
export class UpdateRoleUseCase {
  constructor(private readonly save: SaveRoleUseCase) {}
  execute(id: string, dto: UpdateRoleDto, actor: ActorReference) {
    return this.save.execute(id, dto, actor);
  }
}
