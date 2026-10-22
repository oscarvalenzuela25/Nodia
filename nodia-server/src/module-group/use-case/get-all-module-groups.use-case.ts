import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ModuleGroupService } from '../module-group.service.js';
import { GetModuleGroupsDto } from '../dto/get-module-groups.dto.js';
import { GetModuleGroupsResponse } from '../types/module-group.types.js';

@Injectable()
export class GetAllModuleGroupsUseCase {
  constructor(private readonly moduleGroupService: ModuleGroupService) {}

  async execute(
    dto: GetModuleGroupsDto,
    manager?: EntityManager,
  ): Promise<GetModuleGroupsResponse> {
    return manager
      ? this.moduleGroupService.findAll(dto, manager)
      : this.moduleGroupService.findAll(dto);
  }
}
