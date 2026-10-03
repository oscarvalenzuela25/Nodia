import { Injectable } from '@nestjs/common';
import { UpdateAiApiKeyDto } from '../dto/update-ai-api-key.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class UpdateAiApiKeyUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(id: string, dto: UpdateAiApiKeyDto) {
    const key = await this.aiProviderService.updateApiKey(id, dto);
    const {
      secret_ciphertext: _ciphertext,
      secret_fingerprint: _fingerprint,
      ...safe
    } = key;
    return safe;
  }
}
