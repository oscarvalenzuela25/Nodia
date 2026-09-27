import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateAiProviderEventDto } from './dto/create-ai-provider-event.dto.js';
import { GetAiProviderEventsDto } from './dto/get-ai-provider-events.dto.js';
import { GetAllAiProviderEventsUseCase } from './use-case/get-all-ai-provider-events.use-case.js';
import { CreateAiProviderEventUseCase } from './use-case/create-ai-provider-event.use-case.js';

@Controller(['ai-provider-event', 'ai-provider-events'])
export class AiProviderEventController {
  constructor(
    private readonly getAllAiProviderEventsUseCase: GetAllAiProviderEventsUseCase,
    private readonly createAiProviderEventUseCase: CreateAiProviderEventUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetAiProviderEventsDto) {
    return this.getAllAiProviderEventsUseCase.execute(queryParams);
  }

  @Post()
  create(@Body() createDto: CreateAiProviderEventDto) {
    return this.createAiProviderEventUseCase.execute(createDto);
  }
}
