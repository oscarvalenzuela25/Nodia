import { Injectable } from '@nestjs/common';
import { CreateAiApiKeyDto } from '../dto/create-ai-api-key.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class CreateAiApiKeyUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(dto: CreateAiApiKeyDto) {
    const key = await this.aiProviderService.createApiKey(dto);
    const {
      secret_ciphertext: _ciphertext,
      secret_fingerprint: _fingerprint,
      ...safe
    } = key;
    return safe;
  }
}
