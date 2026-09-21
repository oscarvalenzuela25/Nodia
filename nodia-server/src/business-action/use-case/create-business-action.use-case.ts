import { Injectable } from '@nestjs/common';
import { CreateBusinessActionDto } from '../dto/create-business-action.dto.js';
import { BusinessActionService } from '../business-action.service.js';

@Injectable()
export class CreateBusinessActionUseCase {
  constructor(private readonly businessActionService: BusinessActionService) {}

  async execute(dto: CreateBusinessActionDto) {
    return this.businessActionService.create(dto);
  }
}
