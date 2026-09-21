import { Injectable } from '@nestjs/common';
import { GetBusinessesDto } from '../dto/get-businesses.dto.js';
import { BusinessService } from '../business.service.js';

@Injectable()
export class GetMyBusinessesUseCase {
  constructor(private readonly businessService: BusinessService) {}

  async execute(userId: string, queryParams: GetBusinessesDto) {
    return this.businessService.findMyBusinesses(userId, queryParams);
  }
}
