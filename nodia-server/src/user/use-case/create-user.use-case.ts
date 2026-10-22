import { Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { SaveUserUseCase } from './save-user.use-case.js';
@Injectable()
export class CreateUserUseCase {
  constructor(private readonly save: SaveUserUseCase) {}
  execute(dto: CreateUserDto, actor: ActorReference) {
    return this.save.execute(undefined, dto, actor);
  }
}
