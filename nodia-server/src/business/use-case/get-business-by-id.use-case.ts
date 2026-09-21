import { Injectable } from '@nestjs/common';
import { BusinessService } from '../business.service.js';

@Injectable()
export class GetBusinessByIdUseCase {
  constructor(private readonly businessService: BusinessService) {}

  async execute(id: string, userId: string) {
    return this.businessService.findOne(id, userId);
  }
}
