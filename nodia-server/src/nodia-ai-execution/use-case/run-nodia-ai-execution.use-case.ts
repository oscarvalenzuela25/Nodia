import { HttpException, Injectable, Optional } from '@nestjs/common';
import { ClaimNodiaAiExecutionUseCase } from './claim-nodia-ai-execution.use-case.js';
import { ExecuteNodiaAiLocalExecutionUseCase } from './execute-nodia-ai-local-execution.use-case.js';
import { RecoverNodiaAiExecutionsUseCase } from './recover-nodia-ai-executions.use-case.js';
import { PauseNodiaAiSecureFlowUseCase } from '../../nodia-ai-secure-flow/use-case/pause-nodia-ai-secure-flow.use-case.js';
import { StageNodiaAiInvoiceAttachmentUseCase } from '../../nodia-ai-invoice-attachment/use-case/stage-nodia-ai-invoice-attachment.use-case.js';

@Injectable()
export class RunNodiaAiExecutionUseCase {
  constructor(
    private readonly claim: ClaimNodiaAiExecutionUseCase,
    private readonly effect: ExecuteNodiaAiLocalExecutionUseCase,
    private readonly recover: RecoverNodiaAiExecutionsUseCase,
    @Optional() private readonly secure?: PauseNodiaAiSecureFlowUseCase,
    @Optional()
    private readonly invoiceAttachment?: StageNodiaAiInvoiceAttachmentUseCase,
  ) {}
  async execute(workerId: string, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    const claim = await this.claim.execute(workerId);
    if (!claim) return false;
    try {
      if (signal.aborted)
        await this.recover.execute(claim, 'nodia_ai:lease_lost');
      else if (!(await this.secure?.execute(claim))) {
        await this.invoiceAttachment?.execute(claim, signal);
        await this.effect.execute(claim.identity, claim.executionId, claim);
      }
    } catch (error) {
      // A lost COMMIT acknowledgement is observed under the same SQL locks.
      // Completed receipts remain untouched; absent receipts prove rollback.
      const message =
        error instanceof HttpException
          ? error.message
          : 'nodia_ai:execution_conflict';
      await this.recover.execute(claim, message);
    }
    return true;
  }
}
