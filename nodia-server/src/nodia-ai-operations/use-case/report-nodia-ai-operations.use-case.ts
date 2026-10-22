import { Inject, Injectable, Logger } from '@nestjs/common';
import { ObserveNodiaAiOperationsUseCase } from './observe-nodia-ai-operations.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';

/** Per worker process, bounded frequency and memory; never retries generation or changes jobs. */
@Injectable()
export class ReportNodiaAiOperationsUseCase {
  private readonly logger = new Logger(ReportNodiaAiOperationsUseCase.name);
  private nextObservation = 0;
  private pending: Promise<void> | null = null;
  private lastAlerts = '';
  constructor(
    private readonly observe: ObserveNodiaAiOperationsUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(): Promise<void> {
    if (this.pending) return this.pending;
    if (Date.now() < this.nextObservation) return;
    this.nextObservation =
      Date.now() + this.policy.retention.sweep_seconds * 1000;
    this.pending = this.report();
    try {
      await this.pending;
    } finally {
      this.pending = null;
    }
  }
  private async report(): Promise<void> {
    try {
      const snapshot = await this.observe.execute();
      this.logger.log({ event: 'nodia_ai_operations_snapshot', ...snapshot });
      const signature = snapshot.alerts.join(',');
      if (signature !== this.lastAlerts) {
        this.logger.warn({
          event: 'nodia_ai_operations_alerts_changed',
          alerts: snapshot.alerts,
          operational_state: snapshot.operational_state,
        });
        this.lastAlerts = signature;
      }
    } catch {
      // Raw SQL/SDK errors and arbitrary objects never enter the log.
      if (this.lastAlerts !== 'observation_unavailable') {
        this.logger.warn({
          event: 'nodia_ai_operations_unavailable',
          database_observed: false,
          provider_ready: null,
          external_cost: null,
        });
        this.lastAlerts = 'observation_unavailable';
      }
    }
  }
}
