import { Req } from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { Controller, Get, Post, Body, Put, Param, Query } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { GetUsersDto } from './dto/get-users.dto.js';
import { GetAllUsersUseCase } from './use-case/get-all-users.use-case.js';
import { CreateUserUseCase } from './use-case/create-user.use-case.js';
import { UpdateUserUseCase } from './use-case/update-user.use-case.js';

@Controller(['user', 'users'])
export class UserController {
  constructor(
    private readonly getAllUsersUseCase: GetAllUsersUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetUsersDto) {
    return this.getAllUsersUseCase.execute(queryParams);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto, @Req() request: AuthRequest) {
    return this.createUserUseCase.execute(
      createUserDto,
      actorReference(request.auth),
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateUserUseCase.execute(
      id,
      updateUserDto,
      actorReference(request.auth),
    );
  }
}
