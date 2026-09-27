import { Injectable } from '@nestjs/common';
import { GetAiApiKeysDto } from '../dto/get-ai-api-keys.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class GetAllAiApiKeysUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(dto: GetAiApiKeysDto) {
    return this.aiProviderService.findAllApiKeys(dto);
  }
}
