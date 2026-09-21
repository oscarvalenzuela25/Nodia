import { Injectable } from '@nestjs/common';
import { CreateBusinessDto } from '../dto/create-business.dto.js';
import { BusinessService } from '../business.service.js';

@Injectable()
export class CreateBusinessUseCase {
  constructor(private readonly businessService: BusinessService) {}

  async execute(userId: string, dto: CreateBusinessDto) {
    return this.businessService.create(userId, dto);
  }
}
