import { Injectable } from '@nestjs/common';
import { UpdateActionDto } from '../dto/update-action.dto.js';
import { ActionService } from '../action.service.js';

@Injectable()
export class UpdateActionUseCase {
  constructor(private readonly actionService: ActionService) {}

  async execute(id: string, dto: UpdateActionDto) {
    return this.actionService.update(id, dto);
  }
}
