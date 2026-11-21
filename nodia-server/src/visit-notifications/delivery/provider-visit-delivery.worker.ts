import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { DeliverProviderVisitsUseCase } from './deliver-provider-visits.use-case.js';

const tickIntervalMs = 5_000;

/** Installed only in the standalone worker composition. */
@Injectable()
export class ProviderVisitDeliveryWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProviderVisitDeliveryWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;

  constructor(private readonly delivery: DeliverProviderVisitsUseCase) {}

  onModuleInit(): void {
    this.timer = setInterval(() => this.tick(), tickIntervalMs);
    this.timer.unref();
    this.tick();
  }

  private tick(): void {
    if (this.running || this.stopping) return;
    this.running = this.run().finally(() => {
      this.running = undefined;
    });
  }

  private async run(): Promise<void> {
    try {
      await this.delivery.execute(undefined, () => this.stopping);
    } catch {
      this.logger.warn({ event: 'provider_visit_delivery_cycle_deferred' });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
