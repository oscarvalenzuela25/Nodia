import { Injectable } from '@nestjs/common';
import { UpdateAiProviderDto } from '../dto/update-ai-provider.dto.js';
import { AiProviderService } from '../ai-provider.service.js';

@Injectable()
export class UpdateAiProviderUseCase {
  constructor(private readonly aiProviderService: AiProviderService) {}

  async execute(id: string, dto: UpdateAiProviderDto) {
    return this.aiProviderService.updateProvider(id, dto);
  }
}
