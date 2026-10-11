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
} from '@nestjs/common';
import { RoleService } from './role.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { GetRolesDto } from './dto/get-roles.dto.js';
import { GetAllRolesUseCase } from './use-case/get-all-roles.use-case.js';
import { CreateRoleUseCase } from './use-case/create-role.use-case.js';
import { UpdateRoleUseCase } from './use-case/update-role.use-case.js';
import { DeleteRoleUseCase } from './use-case/delete-role.use-case.js';
import { RoleIdDto } from './dto/role-id.dto.js';

@Controller(['role', 'roles'])
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly getAllRolesUseCase: GetAllRolesUseCase,
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
  ) {}

  @Post()
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.createRoleUseCase.execute(createRoleDto);
  }

  @Get()
  findAll(@Query() queryParams: GetRolesDto) {
    return this.getAllRolesUseCase.execute(queryParams);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.updateRoleUseCase.execute(id, updateRoleDto);
  }

  @Patch(':id')
  updatePatch(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.updateRoleUseCase.execute(id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param() params: RoleIdDto) {
    return this.deleteRoleUseCase.execute(params.id);
  }
}
