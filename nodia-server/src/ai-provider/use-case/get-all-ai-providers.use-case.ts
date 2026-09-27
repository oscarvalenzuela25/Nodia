import { Injectable } from '@nestjs/common';
import { GetAiProvidersDto } from '../dto/get-ai-providers.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class GetAllAiProvidersUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(dto: GetAiProvidersDto) {
    return this.aiProviderService.findAllProviders(dto);
  }
}
