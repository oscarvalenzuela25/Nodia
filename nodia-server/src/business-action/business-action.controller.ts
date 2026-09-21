import { Controller, Get, Post, Put, Body, Param, Delete, Query } from '@nestjs/common';
import { BusinessActionService } from './business-action.service.js';
import { CreateBusinessActionDto } from './dto/create-business-action.dto.js';
import { UpdateBusinessActionDto } from './dto/update-business-action.dto.js';
import { GetBusinessActionsDto } from './dto/get-business-actions.dto.js';
import { GetAllBusinessActionsUseCase } from './use-case/get-all-business-actions.use-case.js';
import { CreateBusinessActionUseCase } from './use-case/create-business-action.use-case.js';
import { UpdateBusinessActionUseCase } from './use-case/update-business-action.use-case.js';
import { DeleteBusinessActionUseCase } from './use-case/delete-business-action.use-case.js';

@Controller(['business-action', 'business-actions'])
export class BusinessActionController {
  constructor(
    private readonly businessActionService: BusinessActionService,
    private readonly getAllBusinessActionsUseCase: GetAllBusinessActionsUseCase,
    private readonly createBusinessActionUseCase: CreateBusinessActionUseCase,
    private readonly updateBusinessActionUseCase: UpdateBusinessActionUseCase,
    private readonly deleteBusinessActionUseCase: DeleteBusinessActionUseCase,
  ) {}

  @Post()
  create(@Body() createBusinessActionDto: CreateBusinessActionDto) {
    return this.createBusinessActionUseCase.execute(createBusinessActionDto);
  }

  @Get()
  findAll(@Query() queryParams: GetBusinessActionsDto) {
    return this.getAllBusinessActionsUseCase.execute(queryParams);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessActionService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateBusinessActionDto: UpdateBusinessActionDto,
  ) {
    return this.updateBusinessActionUseCase.execute(id, updateBusinessActionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deleteBusinessActionUseCase.execute(id);
  }
}
