import { Injectable } from '@nestjs/common';
import { ModuleGroupService } from '../module-group.service.js';
import { GetModuleGroupsDto } from '../dto/get-module-groups.dto.js';
import { GetModuleGroupsResponse } from '../types/module-group.types.js';

@Injectable()
export class GetAllModuleGroupsUseCase {
  constructor(private readonly moduleGroupService: ModuleGroupService) {}

  async execute(dto: GetModuleGroupsDto): Promise<GetModuleGroupsResponse> {
    return this.moduleGroupService.findAll(dto);
  }
}
