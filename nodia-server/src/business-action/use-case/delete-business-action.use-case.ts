import { Injectable } from '@nestjs/common';
import { BusinessActionService } from '../business-action.service.js';

@Injectable()
export class DeleteBusinessActionUseCase {
  constructor(private readonly businessActionService: BusinessActionService) {}

  async execute(id: string) {
    return this.businessActionService.remove(id);
  }
}
