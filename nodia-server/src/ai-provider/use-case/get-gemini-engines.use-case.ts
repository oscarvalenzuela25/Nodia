import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../common/ai/gemini.service.js';

@Injectable()
export class GetGeminiEnginesUseCase {
  constructor(private readonly geminiService: GeminiService) {}

  async execute() {
    return this.geminiService.getDualEngineStatus();
  }
}
