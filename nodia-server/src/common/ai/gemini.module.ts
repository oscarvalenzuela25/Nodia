import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service.js';
import { MistralService } from './mistral.service.js';

@Module({
  providers: [GeminiService, MistralService],
  exports: [GeminiService, MistralService],
})
export class GeminiModule {}
