import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { isFinanceBigint } from '../../finance-common/validation/finance-validation.js';
import { CreateFinanceMovementUseCase } from '../../finance-movement/use-case/create-finance-movement.use-case.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { PrepareNodiaAiFinanceMovementUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.js';

/** Native domain effect only. The caller commits its witness/outbox with this same manager. */
@Injectable()
export class ExecuteNodiaAiFinanceMovementEffectUseCase {
  constructor(
    private readonly preparer: PrepareNodiaAiFinanceMovementUseCase,
    private readonly create: CreateFinanceMovementUseCase,
  ) {}

  async execute(
    step: StoredProposalStep,
    context: ProposalPreparerContext,
  ): Promise<{ id: string; ownerId: string }> {
    const { dto, ownerId } = await this.preparer.resolveConfirmedCommand(
      step,
      context,
    );
    const movement = await this.create.execute(
      {
        userId: context.actor.actorId,
        sessionId: context.actor.sessionId,
        ownerId,
        transaction: context.manager,
        statementTimeoutMs: context.statementTimeoutMs,
      },
      dto,
    );
    if (!isFinanceBigint(movement.id) || movement.user_id !== ownerId)
      throw new InternalServerErrorException('nodia_ai:invalid_output');
    return { id: movement.id, ownerId };
  }
}
