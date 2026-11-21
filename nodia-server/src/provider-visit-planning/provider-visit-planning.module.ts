import { Module } from '@nestjs/common';
import { ProviderVisitPlanningWorker } from './provider-visit-planning.worker.js';
import { ReconcileProviderVisitPlanningUseCase } from './use-case/reconcile-provider-visit-planning.use-case.js';

@Module({
  providers: [
    ReconcileProviderVisitPlanningUseCase,
    ProviderVisitPlanningWorker,
  ],
})
export class ProviderVisitPlanningModule {}
