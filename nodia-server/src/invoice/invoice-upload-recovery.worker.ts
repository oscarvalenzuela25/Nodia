import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { RecoverInvoiceUploadsUseCase } from './use-case/recover-invoice-uploads.use-case.js';

/** Transport/lifecycle only; recovery rules and tests live in the use case. */
@Injectable()
export class InvoiceUploadRecoveryWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(InvoiceUploadRecoveryWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;

  constructor(private readonly recovery: RecoverInvoiceUploadsUseCase) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => this.tick(), 60_000);
    this.timer.unref();
    this.tick();
  }

  private tick(): void {
    if (this.running) return;
    this.running = this.recovery
      .execute()
      .then(() => undefined)
      .catch(() => {
        this.logger.error({ event: 'invoice_upload_recovery_unavailable' });
      })
      .finally(() => {
        this.running = undefined;
      });
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }
}
