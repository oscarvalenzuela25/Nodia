import { Injectable } from '@nestjs/common';
import { CreateAiProviderEventDto } from '../dto/create-ai-provider-event.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class CreateAiProviderEventUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(dto: CreateAiProviderEventDto) {
    return this.aiProviderService.createEvent(dto);
  }
}
