import { Injectable } from '@nestjs/common';
import { CreateAiProviderDto } from '../dto/create-ai-provider.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class CreateAiProviderUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(dto: CreateAiProviderDto) {
    return this.aiProviderService.createProvider(dto);
  }
}
