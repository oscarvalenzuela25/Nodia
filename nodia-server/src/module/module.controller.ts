import { Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ModuleService } from './module.service.js';
import { CreateModuleDto } from './dto/create-module.dto.js';
import { UpdateModuleDto } from './dto/update-module.dto.js';
import { GetModulesDto } from './dto/get-modules.dto.js';
import { GetAllModulesUseCase } from './use-case/get-all-modules.use-case.js';
import { CreateModuleUseCase } from './use-case/create-module.use-case.js';
import { UpdateModuleUseCase } from './use-case/update-module.use-case.js';
import { DeleteModuleUseCase } from './use-case/delete-module.use-case.js';
import { CatalogIdDto } from '../common/dto/catalog-id.dto.js';

@Controller(['module', 'modules'])
export class ModuleController {
  constructor(
    private readonly moduleService: ModuleService,
    private readonly getAllModulesUseCase: GetAllModulesUseCase,
    private readonly createModuleUseCase: CreateModuleUseCase,
    private readonly updateModuleUseCase: UpdateModuleUseCase,
    private readonly deleteModuleUseCase: DeleteModuleUseCase,
  ) {}

  @Post()
  create(
    @Body() createModuleDto: CreateModuleDto,
    @Req() request: AuthRequest,
  ) {
    return this.createModuleUseCase.execute(
      createModuleDto,
      actorReference(request.auth),
    );
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
  update(
    @Param('id') id: string,
    @Body() updateModuleDto: UpdateModuleDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateModuleUseCase.execute(
      id,
      updateModuleDto,
      actorReference(request.auth),
    );
  }

  @Patch(':id')
  updatePatch(
    @Param('id') id: string,
    @Body() updateModuleDto: UpdateModuleDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateModuleUseCase.execute(
      id,
      updateModuleDto,
      actorReference(request.auth),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param() params: CatalogIdDto, @Req() request: AuthRequest) {
    return this.deleteModuleUseCase.execute(
      params.id,
      actorReference(request.auth),
    );
  }
}
