import { Injectable } from '@nestjs/common';
import { GetActionsDto } from '../dto/get-actions.dto.js';
import { ActionService } from '../action.service.js';

@Injectable()
export class GetAllActionsUseCase {
  constructor(private readonly actionService: ActionService) {}

  async execute(dto: GetActionsDto) {
    return this.actionService.findAll(dto);
  }
}
