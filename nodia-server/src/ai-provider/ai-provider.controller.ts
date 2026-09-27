import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto.js';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto.js';
import { GetAiProvidersDto } from './dto/get-ai-providers.dto.js';
import { GetSelectableModelsDto } from './dto/get-selectable-models.dto.js';
import { GetAllAiProvidersUseCase } from './use-case/get-all-ai-providers.use-case.js';
import { CreateAiProviderUseCase } from './use-case/create-ai-provider.use-case.js';
import { UpdateAiProviderUseCase } from './use-case/update-ai-provider.use-case.js';
import { GetSelectableModelsUseCase } from './use-case/get-selectable-models.use-case.js';
import { GetAiProvidersHealthUseCase } from './use-case/get-ai-providers-health.use-case.js';
import { GetEnabledWebAiProvidersUseCase } from './use-case/get-enabled-web-ai-providers.use-case.js';
import { GetSupportedAiProvidersUseCase } from './use-case/get-supported-ai-providers.use-case.js';

@Controller(['ai-provider', 'ai-providers'])
export class AiProviderController {
  constructor(
    private readonly getAllAiProvidersUseCase: GetAllAiProvidersUseCase,
    private readonly createAiProviderUseCase: CreateAiProviderUseCase,
    private readonly updateAiProviderUseCase: UpdateAiProviderUseCase,
    private readonly getSelectableModelsUseCase: GetSelectableModelsUseCase,
    private readonly getAiProvidersHealthUseCase: GetAiProvidersHealthUseCase,
    private readonly getEnabledWebAiProvidersUseCase: GetEnabledWebAiProvidersUseCase,
    private readonly getSupportedAiProvidersUseCase: GetSupportedAiProvidersUseCase,
  ) {}

  @Get(['catalog', 'supported', 'supported-providers'])
  getSupportedProviders() {
    return this.getSupportedAiProvidersUseCase.execute();
  }

  @Get(['web-enabled', 'enabled-web', 'enabled-web-providers'])
  getEnabledWebProviders() {
    return this.getEnabledWebAiProvidersUseCase.execute();
  }

  @Get(['health', 'health-check', 'verify-all'])
  getHealth() {
    return this.getAiProvidersHealthUseCase.execute();
  }

  @Get(['models', 'selectable-models'])
  getSelectableModels(@Query() queryParams: GetSelectableModelsDto) {
    return this.getSelectableModelsUseCase.execute(queryParams);
  }

  @Get()
  findAll(@Query() queryParams: GetAiProvidersDto) {
    return this.getAllAiProvidersUseCase.execute(queryParams);
  }

  @Post()
  create(@Body() createDto: CreateAiProviderDto) {
    return this.createAiProviderUseCase.execute(createDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAiProviderDto,
  ) {
    return this.updateAiProviderUseCase.execute(id, updateDto);
  }
}
