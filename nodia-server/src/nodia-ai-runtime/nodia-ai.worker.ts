import {
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { RunNodiaAiWorkerUseCase } from './use-case/run-nodia-ai-worker.use-case.js';

/** Registered only in the explicit worker composition, never the HTTP application. */
@Injectable()
export class NodiaAiWorker implements OnApplicationBootstrap, OnModuleDestroy {
  constructor(private readonly worker: RunNodiaAiWorkerUseCase) {}
  onApplicationBootstrap(): void {
    this.worker.start();
  }
  async onModuleDestroy(): Promise<void> {
    await this.worker.stop();
  }
}
