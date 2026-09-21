import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { GetProvidersDto } from './dto/get-providers.dto.js';
import { GetAllProvidersUseCase } from './use-case/get-all-providers.use-case.js';
import { GetProviderByIdUseCase } from './use-case/get-provider-by-id.use-case.js';
import { CreateProviderUseCase } from './use-case/create-provider.use-case.js';
import { UpdateProviderUseCase } from './use-case/update-provider.use-case.js';

@Controller(['provider', 'providers'])
export class ProviderController {
  constructor(
    private readonly getAllProvidersUseCase: GetAllProvidersUseCase,
    private readonly getProviderByIdUseCase: GetProviderByIdUseCase,
    private readonly createProviderUseCase: CreateProviderUseCase,
    private readonly updateProviderUseCase: UpdateProviderUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetProvidersDto) {
    return this.getAllProvidersUseCase.execute(queryParams);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.getProviderByIdUseCase.execute(id);
  }

  @Post()
  create(@Body() createProviderDto: CreateProviderDto) {
    return this.createProviderUseCase.execute(createProviderDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateProviderDto: UpdateProviderDto) {
    return this.updateProviderUseCase.execute(id, updateProviderDto);
  }
}
