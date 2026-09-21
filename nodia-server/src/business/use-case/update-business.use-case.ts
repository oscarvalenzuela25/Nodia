import { Injectable } from '@nestjs/common';
import { UpdateBusinessDto } from '../dto/update-business.dto.js';
import { BusinessService } from '../business.service.js';

@Injectable()
export class UpdateBusinessUseCase {
  constructor(private readonly businessService: BusinessService) {}

  async execute(id: string, userId: string, dto: UpdateBusinessDto) {
    return this.businessService.update(id, userId, dto);
  }
}
