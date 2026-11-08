import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service.js';
import { MistralService } from './mistral.service.js';
import { ApiProviderModule } from './api-provider.module.js';

@Module({
  imports: [ApiProviderModule],
  providers: [GeminiService, MistralService],
  exports: [GeminiService, MistralService, ApiProviderModule],
})
export class GeminiModule {}
