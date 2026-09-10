import { Injectable } from '@nestjs/common';
import { ModuleGroupService } from '../module-group.service.js';
import { UpdateModuleGroupDto } from '../dto/update-module-group.dto.js';

@Injectable()
export class UpdateModuleGroupUseCase {
  constructor(private readonly moduleGroupService: ModuleGroupService) {}

  async execute(id: string, dto: UpdateModuleGroupDto) {
    return this.moduleGroupService.update(id, dto);
  }
}
