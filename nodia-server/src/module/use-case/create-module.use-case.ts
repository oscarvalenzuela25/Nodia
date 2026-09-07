import { Injectable } from '@nestjs/common';
import { CreateModuleDto } from '../dto/create-module.dto.js';
import { ModuleService } from '../module.service.js';

@Injectable()
export class CreateModuleUseCase {
  constructor(private readonly moduleService: ModuleService) {}

  async execute(dto: CreateModuleDto) {
    return this.moduleService.create(dto);
  }
}
