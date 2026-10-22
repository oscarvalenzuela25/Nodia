import { Injectable } from '@nestjs/common';
import { CreateBusinessActionDto } from '../dto/create-business-action.dto.js';
import { SaveBusinessActionUseCase } from './save-business-action.use-case.js';
import type { ActorReference } from '../../authorization/authority-transaction.js';

@Injectable()
export class CreateBusinessActionUseCase {
  constructor(private readonly writer: SaveBusinessActionUseCase) {}

  async execute(dto: CreateBusinessActionDto, actor: ActorReference) {
    return this.writer.execute(undefined, dto, actor);
  }
}
