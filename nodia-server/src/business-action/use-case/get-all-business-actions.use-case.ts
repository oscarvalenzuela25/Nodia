import { Injectable } from '@nestjs/common';
import { GetBusinessActionsDto } from '../dto/get-business-actions.dto.js';
import { BusinessActionService } from '../business-action.service.js';

@Injectable()
export class GetAllBusinessActionsUseCase {
  constructor(private readonly businessActionService: BusinessActionService) {}

  async execute(queryParams: GetBusinessActionsDto) {
    return this.businessActionService.findAll(queryParams);
  }
}
