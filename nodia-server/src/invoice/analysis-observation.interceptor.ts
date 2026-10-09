import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { catchError, finalize, tap, throwError } from 'rxjs';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/types/auth.types.js';
import type { AnalysisProgress } from '../common/ai/analysis-progress.js';
import { AnalysisObservationsUseCase } from './use-case/analysis-observations.use-case.js';

export type ObservedAnalysisRequest = AuthRequest & { analysisProgress?: AnalysisProgress; analysisSignal?: AbortSignal };
@Injectable()
export class AnalysisObservationInterceptor implements NestInterceptor {
  constructor(private readonly observations: AnalysisObservationsUseCase) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<ObservedAnalysisRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    const id = request.get('X-Nodia-Analysis-Id');
    const actor = request.auth.user.id;
    // Runs before Multer and DTO validation. Claim is synchronous and cannot race another POST.
    if (id) request.analysisProgress = this.observations.claim(actor, id);
    const cancellation = new AbortController();
    request.analysisSignal = cancellation.signal;
    const onClose = () => {
      if (!response.writableFinished) {
        cancellation.abort();
        if (id) this.observations.finish(actor, id, 'cancelled');
      }
    };
    response.once('close', onClose);
    return next.handle().pipe(
      tap({ next: () => { if (id) this.observations.finish(actor, id, 'succeeded'); } }),
      catchError((error: unknown) => {
        if (id) this.observations.finish(actor, id, cancellation.signal.aborted ? 'cancelled' : 'failed');
        return throwError(() => error);
      }),
      finalize(() => response.off('close', onClose)),
    );
  }
}
