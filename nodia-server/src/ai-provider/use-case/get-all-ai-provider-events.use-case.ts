import { Injectable } from '@nestjs/common';
import { GetAiProviderEventsDto } from '../dto/get-ai-provider-events.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class GetAllAiProviderEventsUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(dto: GetAiProviderEventsDto) {
    return this.aiProviderService.findAllEvents(dto);
  }
}
