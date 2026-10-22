import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import { SaveUserUseCase } from './save-user.use-case.js';
@Injectable()
export class UpdateUserUseCase {
  constructor(private readonly save: SaveUserUseCase) {}
  execute(id: string, dto: UpdateUserDto, actor: ActorReference) {
    return this.save.execute(id, dto, actor);
  }
}
