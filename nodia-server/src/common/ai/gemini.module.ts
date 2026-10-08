import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service.js';
import { MistralService } from './mistral.service.js';
import { ApiProviderService } from './api-provider.service.js';

@Module({
  providers: [GeminiService, MistralService, ApiProviderService],
  exports: [GeminiService, MistralService, ApiProviderService],
})
export class GeminiModule {}
