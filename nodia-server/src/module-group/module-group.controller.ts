import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreateModuleGroupDto } from './dto/create-module-group.dto.js';
import { UpdateModuleGroupDto } from './dto/update-module-group.dto.js';
import { GetModuleGroupsDto } from './dto/get-module-groups.dto.js';
import { GetAllModuleGroupsUseCase } from './use-case/get-all-module-groups.use-case.js';
import { CreateModuleGroupUseCase } from './use-case/create-module-group.use-case.js';
import { UpdateModuleGroupUseCase } from './use-case/update-module-group.use-case.js';
import { DeleteModuleGroupUseCase } from './use-case/delete-module-group.use-case.js';
import { CatalogIdDto } from '../common/dto/catalog-id.dto.js';

@Controller(['module-group', 'module-groups'])
export class ModuleGroupController {
  constructor(
    private readonly getAllModuleGroupsUseCase: GetAllModuleGroupsUseCase,
    private readonly createModuleGroupUseCase: CreateModuleGroupUseCase,
    private readonly updateModuleGroupUseCase: UpdateModuleGroupUseCase,
    private readonly deleteModuleGroupUseCase: DeleteModuleGroupUseCase,
  ) {}

  @Post()
  create(@Body() createModuleGroupDto: CreateModuleGroupDto) {
    return this.createModuleGroupUseCase.execute(createModuleGroupDto);
  }

  @Get()
  findAll(@Query() queryParams: GetModuleGroupsDto) {
    return this.getAllModuleGroupsUseCase.execute(queryParams);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateModuleGroupDto: UpdateModuleGroupDto,
  ) {
    return this.updateModuleGroupUseCase.execute(id, updateModuleGroupDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param() params: CatalogIdDto) {
    return this.deleteModuleGroupUseCase.execute(params.id);
  }
}
