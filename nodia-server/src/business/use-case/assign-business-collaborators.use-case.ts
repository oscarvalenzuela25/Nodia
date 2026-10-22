import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { AssignCollaboratorsDto } from '../dto/assign-collaborators.dto.js';
import { BusinessService } from '../business.service.js';

@Injectable()
export class AssignBusinessCollaboratorsUseCase {
  constructor(private readonly businessService: BusinessService) {}

  async execute(businessId: string, userId: string, dto: AssignCollaboratorsDto, manager?: EntityManager) {
    return manager ? this.businessService.assignCollaborators(businessId, userId, dto, manager) : this.businessService.assignCollaborators(businessId, userId, dto);
  }
}
