import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { GetModulesDto } from '../dto/get-modules.dto.js';
import { ModuleService } from '../module.service.js';

@Injectable()
export class GetAllModulesUseCase {
  constructor(private readonly moduleService: ModuleService) {}

  async execute(dto: GetModulesDto, manager?: EntityManager) {
    return manager
      ? this.moduleService.findAll(dto, manager)
      : this.moduleService.findAll(dto);
  }
}
