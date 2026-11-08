import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { GenerationWorkerSourceRegistry } from '../../ai-generation/worker-source-registry.js';
import { RunNodiaAiExecutionUseCase } from '../../nodia-ai-execution/use-case/run-nodia-ai-execution.use-case.js';
import { RecoverNodiaAiExecutionsUseCase } from '../../nodia-ai-execution/use-case/recover-nodia-ai-executions.use-case.js';
import { ReportNodiaAiOperationsUseCase } from '../../nodia-ai-operations/use-case/report-nodia-ai-operations.use-case.js';
import { RunNodiaAiStageUseCase } from './run-nodia-ai-stage.use-case.js';
import { RecoverNodiaAiJobsUseCase } from './recover-nodia-ai-jobs.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import {
  NODIA_AI_MAINTENANCE_HANDLER,
  type NodiaAiMaintenanceHandler,
} from '../types/worker.types.js';

/** Process lifecycle coordinator. Capacity and work identity remain durable in PostgreSQL. */
@Injectable()
export class RunNodiaAiWorkerUseCase {
  private readonly logger = new Logger(RunNodiaAiWorkerUseCase.name);
  private stopping = false;
  private started = false;
  private readonly abort = new AbortController();
  private loops: Promise<void>[] = [];
  private wakes = new Set<() => void>();
  constructor(
    private readonly stage: RunNodiaAiStageUseCase,
    private readonly recover: RecoverNodiaAiJobsUseCase,
    @Inject(NODIA_AI_MAINTENANCE_HANDLER)
    private readonly maintenance: NodiaAiMaintenanceHandler,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly execution: RunNodiaAiExecutionUseCase,
    private readonly recoverExecutions: RecoverNodiaAiExecutionsUseCase,
    @Inject(ReportNodiaAiOperationsUseCase)
    private readonly operations: Pick<ReportNodiaAiOperationsUseCase, 'execute'>,
    @Optional() private readonly generation?: GenerationWorkerSourceRegistry,
  ) {}
  start(): void {
    if (this.started) return;
    this.started = true;
    this.loops = [
      ...Array.from({ length: this.policy.queue.foreground_workers }, () =>
        this.foreground(randomUUID()),
      ),
      this.maintain(),
    ];
  }
  async stop(): Promise<void> {
    this.stopping = true;
    this.wake();
    const running = Promise.allSettled(this.loops);
    const initial =
      Math.max(
        0,
        this.policy.timing.drain_seconds -
          this.policy.timing.cancellation_seconds -
          this.policy.timing.flush_seconds,
      ) * 1000;
    if (!(await this.bounded(running, initial))) {
      this.abort.abort(new Error('nodia_ai:worker_draining'));
      await this.bounded(
        running,
        (this.policy.timing.cancellation_seconds +
          this.policy.timing.flush_seconds) *
          1000,
      );
    }
  }
  private async foreground(workerId: string): Promise<void> {
    let sourceIndex = 0;
    let claimUnavailable = false;
    while (!this.stopping) {
      let worked = false;
      try {
        const sources = [this.execution,this.stage,...(this.generation?[this.generation]:[])];
        for(let offset=0;offset<sources.length&&!worked&&!this.stopping;offset++) {
          worked=await sources[(sourceIndex+offset)%sources.length].execute(workerId,this.abort.signal);
        }
        if (this.stopping) break;
        sourceIndex=(sourceIndex+1)%sources.length;
        if (claimUnavailable) {
          this.logger.log({ event: 'nodia_ai_claim_recovered' });
          claimUnavailable = false;
        }
      } catch {
        if (!claimUnavailable)
          this.logger.warn({ event: 'nodia_ai_claim_unavailable' });
        claimUnavailable = true;
      }
      if (!worked && !this.stopping)
        await this.pause(this.policy.timing.heartbeat_seconds * 1000);
    }
  }
  private async maintain(): Promise<void> {
    let maintenanceUnavailable = false;
    while (!this.stopping) {
      let unavailable = false;
      // Failure in recovery must not starve retention, cleanup or observation.
      // Keep these ordered rather than adding concurrent database writers.
      for (const action of [
        () => this.recover.execute(),
        () => this.recoverExecutions.execute(),
        () => this.maintenance.execute(),
        () => this.operations.execute(),
        () => this.generation?.recover() ?? Promise.resolve(),
      ]) {
        if (this.stopping) break;
        try { await action(); } catch { unavailable = true; }
      }
      if (this.stopping) break;
      if (unavailable && !maintenanceUnavailable) {
        this.logger.warn({ event: 'nodia_ai_maintenance_unavailable' });
      } else if (!unavailable && maintenanceUnavailable) {
        this.logger.log({ event: 'nodia_ai_maintenance_recovered' });
      }
      maintenanceUnavailable = unavailable;
      if (!this.stopping)
        await this.pause(this.policy.timing.heartbeat_seconds * 1000);
    }
  }
  private pause(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        this.wakes.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, milliseconds);
      this.wakes.add(wake);
    });
  }
  private wake(): void {
    for (const wake of this.wakes) wake();
  }
  private async bounded(
    work: Promise<unknown>,
    milliseconds: number,
  ): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), milliseconds);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
