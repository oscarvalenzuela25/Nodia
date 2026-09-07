import { Injectable } from '@nestjs/common';
import { CreateActionDto } from '../dto/create-action.dto.js';
import { ActionService } from '../action.service.js';

@Injectable()
export class CreateActionUseCase {
  constructor(private readonly actionService: ActionService) {}

  async execute(dto: CreateActionDto) {
    return this.actionService.create(dto);
  }
}
