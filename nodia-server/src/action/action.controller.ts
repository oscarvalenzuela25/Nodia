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
} from '@nestjs/common';
import { ActionService } from './action.service.js';
import { CreateActionDto } from './dto/create-action.dto.js';
import { UpdateActionDto } from './dto/update-action.dto.js';
import { GetActionsDto } from './dto/get-actions.dto.js';
import { GetAllActionsUseCase } from './use-case/get-all-actions.use-case.js';
import { CreateActionUseCase } from './use-case/create-action.use-case.js';
import { UpdateActionUseCase } from './use-case/update-action.use-case.js';
import { DeleteActionUseCase } from './use-case/delete-action.use-case.js';
import { ActionIdDto } from './dto/action-id.dto.js';

@Controller(['action', 'actions'])
export class ActionController {
  constructor(
    private readonly actionService: ActionService,
    private readonly getAllActionsUseCase: GetAllActionsUseCase,
    private readonly createActionUseCase: CreateActionUseCase,
    private readonly updateActionUseCase: UpdateActionUseCase,
    private readonly deleteActionUseCase: DeleteActionUseCase,
  ) {}

  @Post()
  create(
    @Body() createActionDto: CreateActionDto,
    @Req() request: AuthRequest,
  ) {
    return this.createActionUseCase.execute(
      createActionDto,
      actorReference(request.auth),
    );
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
  update(
    @Param('id') id: string,
    @Body() updateActionDto: UpdateActionDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateActionUseCase.execute(
      id,
      updateActionDto,
      actorReference(request.auth),
    );
  }

  @Patch(':id')
  updatePatch(
    @Param('id') id: string,
    @Body() updateActionDto: UpdateActionDto,
    @Req() request: AuthRequest,
  ) {
    return this.updateActionUseCase.execute(
      id,
      updateActionDto,
      actorReference(request.auth),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param() { id }: ActionIdDto, @Req() request: AuthRequest) {
    return this.deleteActionUseCase.execute(id, actorReference(request.auth));
  }
}
