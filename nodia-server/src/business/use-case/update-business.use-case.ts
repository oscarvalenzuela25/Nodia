import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { UpdateBusinessDto } from '../dto/update-business.dto.js';
import { BusinessService } from '../business.service.js';

@Injectable()
export class UpdateBusinessUseCase {
  constructor(private readonly businessService: BusinessService) {}

  async execute(id: string, userId: string, dto: UpdateBusinessDto, manager?: EntityManager) {
    return manager ? this.businessService.update(id, userId, dto, manager) : this.businessService.update(id, userId, dto);
  }
}
