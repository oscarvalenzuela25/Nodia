import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../common/ai/gemini.service.js';
import type { SubmitGeminiAgenticCodeDto } from '../dto/submit-gemini-agentic-code.dto.js';

@Injectable()
export class ManageGeminiAgenticLoginUseCase {
  private readonly logger = new Logger(ManageGeminiAgenticLoginUseCase.name);
  constructor(private readonly geminiService: GeminiService) {}

  private validateJobId(jobId: string): void {
    if (!/^[0-9a-f]{32}$/.test(jobId)) {
      throw new BadRequestException('Identificador de login inválido.');
    }
  }

  async start(actorUserId: string) {
    const job = await this.geminiService.agenticLoginRequest('POST', '/start', actorUserId);
    this.logger.log(`Agentic login started: actor=${actorUserId}`);
    return job;
  }

  async current(actorUserId: string) {
    // Nest sends an empty body for a bare null. Keep absence explicit JSON.
    return { job: await this.geminiService.agenticLoginRequest('GET', '/current', actorUserId) };
  }

  status(jobId: string, actorUserId: string) {
    this.validateJobId(jobId);
    return this.geminiService.agenticLoginRequest('GET', `/${jobId}`, actorUserId);
  }

  submit(jobId: string, actorUserId: string, payload: SubmitGeminiAgenticCodeDto) {
    this.validateJobId(jobId);
    if (typeof payload.code !== 'string' || !/^[A-Za-z0-9_./+~-]{8,2048}$/.test(payload.code)) {
      throw new BadRequestException('Código de autorización inválido.');
    }
    return this.geminiService.agenticLoginRequest('POST', `/${jobId}/code`, actorUserId, { code: payload.code });
  }

  async cancel(jobId: string, actorUserId: string) {
    this.validateJobId(jobId);
    const job = await this.geminiService.agenticLoginRequest('POST', `/${jobId}/cancel`, actorUserId);
    this.logger.log(`Agentic login cancelled: actor=${actorUserId}`);
    return job;
  }
}
