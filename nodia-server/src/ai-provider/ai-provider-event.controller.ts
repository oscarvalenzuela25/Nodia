import { Controller, Get, Query } from '@nestjs/common';
import { GetAiProviderEventsDto } from './dto/get-ai-provider-events.dto.js';
import { GetAllAiProviderEventsUseCase } from './use-case/get-all-ai-provider-events.use-case.js';
import { RequireAction } from '../authorization/action-permission.guard.js';

@RequireAction('ai:manage')
@Controller(['ai-provider-event', 'ai-provider-events'])
export class AiProviderEventController {
  constructor(
    private readonly getAllAiProviderEventsUseCase: GetAllAiProviderEventsUseCase,
  ) {}

  @Get()
  findAll(@Query() queryParams: GetAiProviderEventsDto) {
    return this.getAllAiProviderEventsUseCase.execute(queryParams);
  }
}
