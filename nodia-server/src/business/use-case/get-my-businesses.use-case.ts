import { Injectable } from '@nestjs/common';
import { GetBusinessesDto } from '../dto/get-businesses.dto.js';
import { BusinessService } from '../business.service.js';

@Injectable()
export class GetMyBusinessesUseCase {
  constructor(private readonly businessService: BusinessService) {}

  async execute(userId: string, queryParams: GetBusinessesDto, includeSummary?: boolean) {
    return includeSummary === undefined
      ? this.businessService.findMyBusinesses(userId, queryParams)
      : this.businessService.findMyBusinesses(userId, queryParams, includeSummary);
  }
}
