import { Injectable } from '@nestjs/common';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class DeleteAiApiKeyUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(id: string): Promise<void> {
    return this.aiProviderService.deleteApiKey(id);
  }
}
