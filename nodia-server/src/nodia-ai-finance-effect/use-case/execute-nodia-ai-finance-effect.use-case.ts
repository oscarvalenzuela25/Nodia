import { Inject, Injectable, ConflictException } from '@nestjs/common';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import {
  NODIA_AI_FINANCE_OPERATIONS,
  nodiaAiFinanceOperationIdentity,
  type NodiaAiFinanceOperation,
} from '../types/financial-operation.types.js';
import { ExecuteNodiaAiFinanceMovementEffectUseCase } from './execute-nodia-ai-finance-movement-effect.use-case.js';

/** Routes a frozen native command. No string-based class resolution or generic SQL. */
@Injectable()
export class ExecuteNodiaAiFinanceEffectUseCase {
  private readonly operations: ReadonlyMap<string, NodiaAiFinanceOperation>;
  constructor(
    private readonly legacy: ExecuteNodiaAiFinanceMovementEffectUseCase,
    @Inject(NODIA_AI_FINANCE_OPERATIONS)
    operations: readonly NodiaAiFinanceOperation[],
  ) {
    const registered = new Map<string, NodiaAiFinanceOperation>();
    for (const port of operations) {
      const identity = nodiaAiFinanceOperationIdentity(port.toolName);
      if (
        !identity ||
        identity.resourceKey !== port.resourceKey ||
        identity.operation !== port.operation ||
        port.toolName === 'nodia_finance_movements_prepare_create' ||
        registered.has(port.toolName)
      )
        throw new Error('nodia_ai:invalid_financial_operation');
      registered.set(port.toolName, port);
    }
    this.operations = registered;
  }
  async execute(step: StoredProposalStep, context: ProposalPreparerContext) {
    if (step.toolName === 'nodia_finance_movements_prepare_create')
      return this.legacy.execute(step, context);
    const port = this.operations.get(step.toolName);
    if (!port || port.contractHash !== step.contractHash)
      throw new ConflictException('nodia_ai:catalog_changed');
    return port.executeConfirmed(step, context);
  }
}
