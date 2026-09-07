import { Controller, Get, Post, Put, Patch, Body, Param, Delete, Query } from '@nestjs/common';
import { ModuleService } from './module.service.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { GetModulesDto } from './dto/get-modules.dto.js';
import { GetAllModulesUseCase } from './use-case/get-all-modules.use-case.js';
import { CreateModuleUseCase } from './use-case/create-module.use-case.js';
import { UpdateModuleUseCase } from './use-case/update-module.use-case.js';

@Controller(['module', 'modules'])
export class ModuleController {
  constructor(
    private readonly moduleService: ModuleService,
    private readonly getAllModulesUseCase: GetAllModulesUseCase,
    private readonly createModuleUseCase: CreateModuleUseCase,
    private readonly updateModuleUseCase: UpdateModuleUseCase,
  ) {}

  @Post()
  create(@Body() createModuleDto: CreateModuleDto) {
    return this.createModuleUseCase.execute(createModuleDto);
  }

  @Get()
  findAll(@Query() queryParams: GetModulesDto) {
    return this.getAllModulesUseCase.execute(queryParams);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.moduleService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateModuleDto: UpdateModuleDto) {
    return this.updateModuleUseCase.execute(id, updateModuleDto);
  }

  @Patch(':id')
  updatePatch(@Param('id') id: string, @Body() updateModuleDto: UpdateModuleDto) {
    return this.updateModuleUseCase.execute(id, updateModuleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.moduleService.remove(+id);
  }
}
