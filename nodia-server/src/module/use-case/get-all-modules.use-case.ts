import { Injectable } from '@nestjs/common';
import { GetModulesDto } from '../dto/get-modules.dto.js';
import { ModuleService } from '../module.service.js';

@Injectable()
export class GetAllModulesUseCase {
  constructor(private readonly moduleService: ModuleService) {}

  async execute(dto: GetModulesDto) {
    return this.moduleService.findAll(dto);
  }
}
