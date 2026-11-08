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
import { MoveModuleGroupOrderDto } from './dto/move-module-group-order.dto.js';
import { MoveModuleGroupOrderUseCase } from './use-case/move-module-group-order.use-case.js';

@Controller(['module-group', 'module-groups'])
export class ModuleGroupController {
  constructor(
    private readonly getAllModuleGroupsUseCase: GetAllModuleGroupsUseCase,
    private readonly createModuleGroupUseCase: CreateModuleGroupUseCase,
    private readonly updateModuleGroupUseCase: UpdateModuleGroupUseCase,
    private readonly deleteModuleGroupUseCase: DeleteModuleGroupUseCase,
    private readonly moveModuleGroupOrderUseCase: MoveModuleGroupOrderUseCase,
  ) {}

  @Post()
  create(
    @Body() createModuleGroupDto: CreateModuleGroupDto,
    @Req() request: AuthRequest,
  ) {
    return this.createModuleGroupUseCase.execute(
      createModuleGroupDto,
      actorReference(request.auth),
    );
  }

  @Get()
  findAll(@Query() queryParams: GetModuleGroupsDto) {
    return this.getAllModuleGroupsUseCase.execute(queryParams);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateModuleGroupDto: UpdateModuleGroupDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateModuleGroupUseCase.execute(
      id,
      updateModuleGroupDto,
      actorReference(request.auth),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param() params: CatalogIdDto, @Req() request: AuthRequest) {
    return this.deleteModuleGroupUseCase.execute(
      params.id,
      actorReference(request.auth),
    );
  }

  @Patch(':id/order')
  moveOrder(
    @Param() params: CatalogIdDto,
    @Body() command: MoveModuleGroupOrderDto,
    @Req() request: AuthRequest,
  ) {
    return this.moveModuleGroupOrderUseCase.execute(
      params.id,
      command,
      actorReference(request.auth),
    );
  }
}
