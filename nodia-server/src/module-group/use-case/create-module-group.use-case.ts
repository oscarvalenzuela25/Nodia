import { Injectable } from '@nestjs/common';
import { ModuleGroupService } from '../module-group.service.js';
import { CreateModuleGroupDto } from '../dto/create-module-group.dto.js';

@Injectable()
export class CreateModuleGroupUseCase {
  constructor(private readonly moduleGroupService: ModuleGroupService) {}

  async execute(dto: CreateModuleGroupDto) {
    return this.moduleGroupService.create(dto);
  }
}
