import { Injectable } from '@nestjs/common';
import { UpdateModuleDto } from '../dto/update-module.dto.js';
import { ModuleService } from '../module.service.js';

@Injectable()
export class UpdateModuleUseCase {
  constructor(private readonly moduleService: ModuleService) {}

  async execute(id: string, dto: UpdateModuleDto) {
    return this.moduleService.update(id, dto);
  }
}
