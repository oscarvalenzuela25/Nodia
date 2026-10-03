import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GeminiService,
  type GeminiLoginJob,
} from '../../common/ai/gemini.service.js';
import { envs } from '../../config/envs.config.js';

@Injectable()
export class ManageGeminiLoginUseCase {
  private readonly logger = new Logger(ManageGeminiLoginUseCase.name);
  constructor(private readonly geminiService: GeminiService) {}

  private assertLocalDevelopment(): void {
    let localUrl = false;
    try {
      const url = new URL(envs.GEMINI_MICROSERVICE_URL);
      localUrl =
        url.protocol === 'http:' &&
        (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
    } catch {
      // Invalid configuration is not a supported local login target.
    }
    if (process.env.NODE_ENV !== 'development' || !localUrl) {
      throw new NotFoundException('El login local de Gemini no está disponible.');
    }
  }

  private assertJobId(jobId: string): void {
    if (!/^[0-9a-f]{32}$/.test(jobId)) {
      throw new BadRequestException('Identificador de login inválido.');
    }
  }

  async start(actorUserId: string): Promise<GeminiLoginJob> {
    this.assertLocalDevelopment();
    const job = await this.geminiService.startInteractiveLogin();
    this.logger.log(`Gemini login started: job=${job.id} actor=${actorUserId}`);
    return job;
  }

  status(jobId: string): Promise<GeminiLoginJob> {
    this.assertLocalDevelopment();
    this.assertJobId(jobId);
    return this.geminiService.getInteractiveLoginStatus(jobId);
  }

  async cancel(jobId: string, actorUserId: string): Promise<GeminiLoginJob> {
    this.assertLocalDevelopment();
    this.assertJobId(jobId);
    const job = await this.geminiService.cancelInteractiveLogin(jobId);
    this.logger.log(`Gemini login cancelled: job=${job.id} actor=${actorUserId}`);
    return job;
  }
}
