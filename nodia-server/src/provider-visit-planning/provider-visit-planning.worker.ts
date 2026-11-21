import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { sweepWebPushInstallations } from '../visit-notifications/visit-notifications.service.js';
import { ReconcileProviderVisitPlanningUseCase } from './use-case/reconcile-provider-visit-planning.use-case.js';

const tickIntervalMs = 15_000;
const maintenanceIntervalMs = 60_000;
const maxClaims = 12;

@Injectable()
export class ProviderVisitPlanningWorker
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;
  private maintenanceAt = 0;
  private readonly logger = new Logger(ProviderVisitPlanningWorker.name);

  constructor(
    private readonly planner: ReconcileProviderVisitPlanningUseCase,
    private readonly source: DataSource,
  ) {}

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
      for (let count = 0; count < maxClaims && !this.stopping; count++) {
        if (!(await this.planner.executeNext())) break;
      }
    } catch {
      this.logger.warn({ event: 'provider_visit_planning_deferred' });
    }

    if (this.stopping || Date.now() < this.maintenanceAt) return;
    this.maintenanceAt = Date.now() + maintenanceIntervalMs;
    try {
      await this.planner.sweepOccurrences();
    } catch {
      this.logger.warn({ event: 'provider_visit_occurrence_cleanup_deferred' });
    }

    if (this.stopping) return;
    try {
      await this.source.transaction(async (manager) => {
        await manager.query(`SET LOCAL statement_timeout TO '3s'`);
        await sweepWebPushInstallations(manager);
      });
    } catch {
      this.logger.warn({ event: 'web_push_installation_cleanup_deferred' });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
