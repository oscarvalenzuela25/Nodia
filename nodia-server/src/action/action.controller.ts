import { Controller, Get, Post, Put, Patch, Body, Param, Delete, Query } from '@nestjs/common';
import { ActionService } from './action.service.js';
import { CreateActionDto } from './dto/create-action.dto.js';
import { UpdateActionDto } from './dto/update-action.dto.js';
import { GetActionsDto } from './dto/get-actions.dto.js';
import { GetAllActionsUseCase } from './use-case/get-all-actions.use-case.js';
import { CreateActionUseCase } from './use-case/create-action.use-case.js';
import { UpdateActionUseCase } from './use-case/update-action.use-case.js';

@Controller(['action', 'actions'])
export class ActionController {
  constructor(
    private readonly actionService: ActionService,
    private readonly getAllActionsUseCase: GetAllActionsUseCase,
    private readonly createActionUseCase: CreateActionUseCase,
    private readonly updateActionUseCase: UpdateActionUseCase,
  ) {}

  @Post()
  create(@Body() createActionDto: CreateActionDto) {
    return this.createActionUseCase.execute(createActionDto);
  }

  @Get()
  findAll(@Query() queryParams: GetActionsDto) {
    return this.getAllActionsUseCase.execute(queryParams);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.actionService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateActionDto: UpdateActionDto) {
    return this.updateActionUseCase.execute(id, updateActionDto);
  }

  @Patch(':id')
  updatePatch(@Param('id') id: string, @Body() updateActionDto: UpdateActionDto) {
    return this.updateActionUseCase.execute(id, updateActionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.actionService.remove(+id);
  }
}
