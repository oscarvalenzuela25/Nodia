import { Injectable } from '@nestjs/common';
import { UpdateBusinessActionDto } from '../dto/update-business-action.dto.js';
import { BusinessActionService } from '../business-action.service.js';

@Injectable()
export class UpdateBusinessActionUseCase {
  constructor(private readonly businessActionService: BusinessActionService) {}

  async execute(id: string, dto: UpdateBusinessActionDto) {
    return this.businessActionService.update(id, dto);
  }
}
